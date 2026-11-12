const {
    verifyWebhookSignature
} = require("./github.webhook");

const {
    getDelivery,
    recordDelivery,
    claimFailedDelivery,
    recoverProcessingDelivery
} = require("./github.webhook.delivery.service");

const {
    getSupportedEvents
} = require("./github.webhook.service");

const githubWebhookQueue =
    require("../../queues/githubWebhook.queue");

const handleGithubWebhook =
    async (req, res, next) => {
        try {
            const signature =
                req.headers[
                    "x-hub-signature-256"
                ];

            const secret =
                process.env
                    .GITHUB_WEBHOOK_SECRET;

            const isValid =
                verifyWebhookSignature(
                    req.body,
                    signature,
                    secret
                );

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code:
                            "GITHUB_WEBHOOK_SIGNATURE_INVALID",
                        message:
                            "Invalid GitHub webhook signature"
                    }
                });
            }

            let payload;

            try {
                payload = JSON.parse(
                    req.body.toString("utf8")
                );
            } catch {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            "GITHUB_WEBHOOK_INVALID_PAYLOAD",
                        message:
                            "Invalid JSON webhook payload"
                    }
                });
            }

            const event =
                req.headers[
                    "x-github-event"
                ];

            const deliveryId =
                req.headers[
                    "x-github-delivery"
                ];

            if (!event) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            "GITHUB_WEBHOOK_EVENT_MISSING",
                        message:
                            "GitHub event header is required"
                    }
                });
            }

            if (!deliveryId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            "GITHUB_WEBHOOK_DELIVERY_MISSING",
                        message:
                            "GitHub delivery ID is required"
                    }
                });
            }

            if (
                !getSupportedEvents().includes(
                    event
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            "GITHUB_WEBHOOK_EVENT_UNSUPPORTED",
                        message:
                            `Unsupported GitHub webhook event: ${event}`
                    }
                });
            }

            let delivery =
                await recordDelivery({
                    deliveryId,
                    event
                });
            const isRedelivery = !delivery;

            /*
             * recordDelivery() returns null when
             * this delivery ID already exists.
             */
            if (!delivery) {
                delivery =
                    await getDelivery(
                        deliveryId
                    );

                if (!delivery) {
                    const error = new Error(
                        "Webhook delivery could not be resolved"
                    );

                    error.statusCode = 500;
                    error.code =
                        "GITHUB_WEBHOOK_DELIVERY_STATE_ERROR";

                    throw error;
                }

                if (delivery.event !== event) {
                    return res.status(409).json({
                        success: false,
                        error: {
                            code: "GITHUB_WEBHOOK_DELIVERY_CONFLICT",
                            message: "Delivery ID was already used for another event"
                        }
                    });
                }

                /*
                 * Already successfully processed.
                 */
                if (
                    delivery.status ===
                    "PROCESSED"
                ) {
                    return res.status(200).json({
                        success: true,
                        data: {
                            received: true,
                            duplicate: true,
                            deliveryId
                        }
                    });
                }

                /*
                 * Worker is currently processing
                 * this delivery. If the queue job no longer exists, recover
                 * the durable MongoDB record and enqueue a new generation.
                 */
                if (
                    delivery.status ===
                    "PROCESSING"
                ) {
                    const processingJob = delivery.processingJobId
                        ? await githubWebhookQueue.githubWebhookQueue.getJob(
                              delivery.processingJobId
                          )
                        : null;
                    const processingJobState = processingJob
                        ? await processingJob.getState()
                        : null;

                    if (
                        processingJob &&
                        ["waiting", "active", "delayed", "paused", "waiting-children"]
                            .includes(processingJobState)
                    ) {
                        return res.status(200).json({
                            success: true,
                            data: {
                                received: true,
                                duplicate: true,
                                processing: true,
                                deliveryId
                            }
                        });
                    }

                    delivery = await recoverProcessingDelivery({
                        deliveryId,
                        processingJobId: delivery.processingJobId,
                        queueGeneration: delivery.queueGeneration ?? 0
                    }) || await getDelivery(deliveryId);
                }

                /*
                 * Previous worker attempt failed.
                 *
                 * Atomically reclaim the delivery
                 * by moving it back to QUEUED.
                 */
                if (
                    delivery.status ===
                    "FAILED"
                ) {
                    delivery = await claimFailedDelivery({
                            deliveryId,
                            event
                        }) || await getDelivery(deliveryId);

                    /*
                     * Another request may have
                     * claimed it first.
                     */
                    if (!delivery || delivery.status === "FAILED") {
                        return res.status(200).json({
                            success: true,
                            data: {
                                received: true,
                                duplicate: true,
                                deliveryId
                            }
                        });
                    }
                }

                if (delivery.status === "PROCESSED") {
                    return res.status(200).json({
                        success: true,
                        data: {
                            received: true,
                            duplicate: true,
                            deliveryId
                        }
                    });
                }

                if (delivery.status === "PROCESSING") {
                    return res.status(200).json({
                        success: true,
                        data: {
                            received: true,
                            duplicate: true,
                            processing: true,
                            deliveryId
                        }
                    });
                }
            }

            /*
             * At this point the delivery should be
             * QUEUED and ready for BullMQ.
             */
            try {
                await githubWebhookQueue.enqueueGithubWebhook({
                    deliveryId,
                    event: delivery.event,
                    payload,
                    queueGeneration: delivery.queueGeneration ?? 0,
                    jobId: `${deliveryId}-${delivery.queueGeneration ?? 0}`
                });
            } catch (error) {
                const queueError = new Error(
                    "GitHub webhook could not be queued"
                );

                queueError.statusCode = 503;
                queueError.code =
                    "GITHUB_WEBHOOK_QUEUE_UNAVAILABLE";

                throw queueError;
            }


            return res.status(isRedelivery ? 200 : 202).json({
                success: true,
                data: {
                    received: true,
                    ...(isRedelivery ? { duplicate: true } : {}),
                    queued: true,
                    processed: false,
                    deliveryId,
                    event
                }
            });
        } catch (error) {
            next(error);
        }
    };

module.exports = {
    handleGithubWebhook
};
