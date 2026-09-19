const request = require("supertest");

const mongoose = require("mongoose");

const app = require(
    "../../src/app"
);

const {
    createWebhookSignature
} = require(
    "../../src/modules/github/github.webhook"
);

const GithubRepository =
    require(
        "../../src/modules/github/github.model"
    );

const GithubSignal =
    require(
        "../../src/modules/github/github.signal.model"
    );

const GithubWebhookDelivery =
    require(
        "../../src/modules/github/github.webhook.delivery.model"
    );

const {
    githubWebhookWorker
} = require(
    "../../src/workers/githubWebhook.worker"
);

const {
    closeGithubWebhookQueue
} = require(
    "../../src/queues/githubWebhook.queue"
);

describe(
    "GitHub webhook idempotency and retry",
    () => {
        const idempotentDeliveryId =
            `delivery-idempotent-${Date.now()}`;

        const retryDeliveryId =
            `delivery-retry-${Date.now()}`;

        const secret =
            "test-webhook-secret";

        let projectId;

        beforeAll(() => {
            process.env.GITHUB_WEBHOOK_SECRET =
                secret;
        });

        beforeEach(async () => {
            await GithubSignal.deleteMany({});
            await GithubRepository.deleteMany({});
            await GithubWebhookDelivery.deleteMany({});

            projectId =
                new mongoose.Types.ObjectId();
        });

        afterAll(async () => {
            await githubWebhookWorker.close();
            await closeGithubWebhookQueue();
        });

        const createIssuePayload = (
            issueId = 98765
        ) => {
            return JSON.stringify({
                action: "opened",

                repository: {
                    id: 12345,
                    name: "backend"
                },

                issue: {
                    id: issueId,
                    number: 12,
                    title:
                        "Fix deployment issue",
                    state: "open",
                    created_at:
                        "2026-09-17T10:00:00Z",
                    updated_at:
                        "2026-09-17T10:00:00Z",
                    user: {
                        id: 100,
                        login: "developer"
                    }
                },

                sender: {
                    id: 100,
                    login: "developer"
                }
            });
        };

        const sendWebhook = async ({
            payload,
            deliveryId
        }) => {
            const signature =
                createWebhookSignature(
                    payload,
                    secret
                );

            return request(app)
                .post(
                    "/api/v1/github/webhook"
                )
                .set(
                    "X-GitHub-Event",
                    "issues"
                )
                .set(
                    "X-GitHub-Delivery",
                    deliveryId
                )
                .set(
                    "X-Hub-Signature-256",
                    signature
                )
                .set(
                    "Content-Type",
                    "application/json"
                )
                .send(payload);
        };

        test(
            "does not process the same delivery twice",
            async () => {
                await GithubRepository.create({
                    project: projectId,
                    owner: "flowforge",
                    repo: "backend",
                    fullName:
                        "flowforge/backend",
                    githubId: 12345,
                    defaultBranch:
                        "main",
                    private: false
                });

                const payload =
                    createIssuePayload();

                const firstResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            idempotentDeliveryId
                    });

                expect(
                    firstResponse.status
                ).toBe(202);

                expect(
                    firstResponse.body.data.queued
                ).toBe(true);

                const secondResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            idempotentDeliveryId
                    });

                expect(
                    secondResponse.status
                ).toBe(200);

                expect(
                    secondResponse.body.data.duplicate
                ).toBe(true);

                /*
                 * The same delivery must only
                 * produce one database record.
                 */
                const deliveries =
                    await GithubWebhookDelivery.find({
                        deliveryId:
                            idempotentDeliveryId
                    });

                expect(
                    deliveries
                ).toHaveLength(1);

                /*
                 * Wait until the worker has processed
                 * the queued job.
                 */
                await waitForDeliveryStatus(
                    idempotentDeliveryId,
                    "PROCESSED"
                );

                const signals =
                    await GithubSignal.find({
                        externalId:
                            "issue:98765:opened"
                    });

                expect(
                    signals
                ).toHaveLength(1);

                expect(
                    signals[0].type
                ).toBe("ISSUE_OPENED");

                expect(
                    deliveries
                ).toHaveLength(1);
            },
            15000
        );

        test(
            "retries a failed delivery after the repository becomes available",
            async () => {
                const payload =
                    createIssuePayload(
                        55555
                    );

                /*
                 * No repository exists yet.
                 *
                 * The HTTP request should still
                 * return 202 because processing is
                 * asynchronous.
                 */
                const firstResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            retryDeliveryId
                    });

                expect(
                    firstResponse.status
                ).toBe(202);

                expect(
                    firstResponse.body.data.queued
                ).toBe(true);

                /*
                 * The worker will retry the job.
                 *
                 * Because the repository is missing,
                 * the delivery will eventually become
                 * FAILED after the configured attempts.
                 */
                await waitForDeliveryStatus(
                    retryDeliveryId,
                    "FAILED",
                    25000
                );

                let delivery =
                    await GithubWebhookDelivery.findOne({
                        deliveryId:
                            retryDeliveryId
                    });

                expect(delivery).not.toBeNull();

                expect(
                    delivery.status
                ).toBe("FAILED");

                expect(
                    delivery.failureReason
                ).toBe(
                    "GitHub repository is not connected to FlowForge"
                );

                /*
                 * Repository becomes available
                 * before GitHub sends the delivery again.
                 */
                await GithubRepository.create({
                    project: projectId,
                    owner: "flowforge",
                    repo: "backend",
                    fullName:
                        "flowforge/backend",
                    githubId: 12345,
                    defaultBranch:
                        "main",
                    private: false
                });

                /*
                 * Same GitHub delivery ID.
                 *
                 * The API should reclaim the FAILED
                 * delivery and queue it again.
                 */
                const retryResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            retryDeliveryId
                    });

                expect(
                    retryResponse.status
                ).toBe(202);

                expect(
                    retryResponse.body.data.queued
                ).toBe(true);

                /*
                 * Worker should now process it
                 * successfully.
                 */
                await waitForDeliveryStatus(
                    retryDeliveryId,
                    "PROCESSED"
                );

                const signals =
                    await GithubSignal.find({
                        externalId:
                            "issue:55555:opened"
                    });

                expect(
                    signals
                ).toHaveLength(1);

                expect(
                    signals[0].type
                ).toBe("ISSUE_OPENED");

                delivery =
                    await GithubWebhookDelivery.findOne({
                        deliveryId:
                            retryDeliveryId
                    });

                expect(
                    delivery.status
                ).toBe("PROCESSED");

                expect(
                    delivery.failureReason
                ).toBeNull();

                expect(
                    delivery.processedAt
                ).not.toBeNull();
            },
            30000
        );
    },
);

const waitForDeliveryStatus = async (
    deliveryId,
    expectedStatus,
    timeout = 10000
) => {
    const start =
        Date.now();

    while (
        Date.now() - start <
        timeout
    ) {
        const delivery =
            await GithubWebhookDelivery.findOne({
                deliveryId
            });

        if (
            delivery?.status ===
            expectedStatus
        ) {
            return delivery;
        }

        await new Promise(
            (resolve) =>
                setTimeout(resolve, 100)
        );
    }

    throw new Error(
        `Timed out waiting for delivery ${deliveryId} to become ${expectedStatus}`
    );
};