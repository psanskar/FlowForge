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

describe(
    "GitHub webhook idempotency and retry",
    () => {
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
                            "delivery-idempotent"
                    });

                expect(
                    firstResponse.status
                ).toBe(200);

                expect(
                    firstResponse.body.data.processed
                ).toBe(true);

                const secondResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            "delivery-idempotent"
                    });

                expect(
                    secondResponse.status
                ).toBe(200);

                expect(
                    secondResponse.body.data.duplicate
                ).toBe(true);

                const signals =
                    await GithubSignal.find({
                        externalId:
                            "issue:98765:opened"
                    });

                expect(
                    signals
                ).toHaveLength(1);

                const deliveries =
                    await GithubWebhookDelivery.find({
                        deliveryId:
                            "delivery-idempotent"
                    });

                expect(
                    deliveries
                ).toHaveLength(1);

                expect(
                    deliveries[0].status
                ).toBe("PROCESSED");
            }
        );

        test(
            "retries a failed delivery after the repository becomes available",
            async () => {
                const payload =
                    createIssuePayload(
                        55555
                    );

                /*
                 * First attempt:
                 * No connected repository exists.
                 *
                 * The webhook should be recorded
                 * as PROCESSING and then become FAILED.
                 */
                const firstResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            "delivery-retry"
                    });

                expect(
                    firstResponse.status
                ).toBe(404);

                expect(
                    firstResponse.body.error.code
                ).toBe(
                    "GITHUB_REPOSITORY_NOT_CONNECTED"
                );

                let delivery =
                    await GithubWebhookDelivery.findOne({
                        deliveryId:
                            "delivery-retry"
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
                 * before GitHub retries the delivery.
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
                 * Second attempt with the
                 * SAME delivery ID.
                 */
                const retryResponse =
                    await sendWebhook({
                        payload,
                        deliveryId:
                            "delivery-retry"
                    });

                expect(
                    retryResponse.status
                ).toBe(200);

                expect(
                    retryResponse.body.data.processed
                ).toBe(true);

                expect(
                    retryResponse.body.data.deliveryId
                ).toBe(
                    "delivery-retry"
                );

                expect(
                    retryResponse.body.data.signalCount
                ).toBe(1);

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
                            "delivery-retry"
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
            }
        );
    }
);