const {
    verifyWebhookSignature
} = require("./github.webhook");

const {
    getDelivery,
    recordDelivery,
    markDeliveryProcessed,
    markDeliveryFailed,
    claimFailedDelivery
} = require("./github.webhook.delivery.service");

const {
    getSupportedEvents,
    processGithubWebhook
} = require("./github.webhook.service");

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
                 * Another request is currently
                 * processing this delivery.
                 */
                if (
                    delivery.status ===
                    "PROCESSING"
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

                /*
                 * Previous attempt failed.
                 * Atomically reclaim the delivery
                 * for retry.
                 */
                if (
                    delivery.status ===
                    "FAILED"
                ) {
                    delivery =
                        await claimFailedDelivery({
                            deliveryId,
                            event
                        });

                    /*
                     * Another request may have
                     * claimed it first.
                     */
                    if (!delivery) {
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
            }

            try {
                const result =
                    await processGithubWebhook({
                        event,
                        payload
                    });

                await markDeliveryProcessed(
                    deliveryId
                );

                return res.status(200).json({
                    success: true,
                    data: {
                        received: true,
                        processed: true,
                        deliveryId,
                        event,
                        signalCount:
                            result.signals.length
                    }
                });
            } catch (error) {
                await markDeliveryFailed(
                    deliveryId,
                    error.message
                );

                throw error;
            }
        } catch (error) {
            next(error);
        }
    };

module.exports = {
    handleGithubWebhook
};