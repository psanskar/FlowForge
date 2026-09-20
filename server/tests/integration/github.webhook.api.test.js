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

const githubWebhookQueue =
    require(
        "../../src/queues/githubWebhook.queue"
    );

const {
    closeGithubWebhookQueue
} = require(
    "../../src/queues/githubWebhook.queue"
);

const {
    githubWebhookWorker
} = require(
    "../../src/workers/githubWebhook.worker"
);

describe("GitHub webhook API", () => {
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

        await GithubRepository.create({
            project: projectId,
            owner: "flowforge",
            repo: "backend",
            fullName:
                "flowforge/backend",
            githubId: 12345,
            defaultBranch: "main",
            private: false
        });
    });

    afterAll(async () => {
        await githubWebhookWorker.close();
        await closeGithubWebhookQueue();
    });

    test(
        "accepts and queues a valid GitHub webhook",
        async () => {
            const payload =
                JSON.stringify({
                    action: "opened",

                    repository: {
                        id: 12345,
                        name: "backend"
                    },

                    issue: {
                        id: 98765,
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

            const signature =
                createWebhookSignature(
                    payload,
                    secret
                );

            const response =
                await request(app)
                    .post(
                        "/api/v1/github/webhook"
                    )
                    .set(
                        "X-GitHub-Event",
                        "issues"
                    )
                    .set(
                        "X-GitHub-Delivery",
                        "delivery-123"
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

            expect(
                response.status
            ).toBe(202);

            expect(
                response.body.success
            ).toBe(true);

            expect(
                response.body.data.received
            ).toBe(true);

            expect(
                response.body.data.queued
            ).toBe(true);

            expect(
                response.body.data.processed
            ).toBe(false);

            expect(
                response.body.data.event
            ).toBe("issues");

            expect(
                response.body.data.deliveryId
            ).toBe("delivery-123");

            /*
             * The HTTP request only confirms
             * that the webhook was accepted and
             * queued. Processing happens asynchronously.
             */
            const delivery =
                await GithubWebhookDelivery.findOne({
                    deliveryId:
                        "delivery-123"
                });

            expect(
                delivery
            ).not.toBeNull();

            expect(
                [
                    "QUEUED",
                    "PROCESSING",
                    "PROCESSED"
                ]
            ).toContain(
                delivery.status
            );
        }
    );

    test(
        "rejects an invalid signature",
        async () => {
            const payload =
                JSON.stringify({
                    action: "opened",
                    repository: {
                        id: 12345
                    }
                });

            const response =
                await request(app)
                    .post(
                        "/api/v1/github/webhook"
                    )
                    .set(
                        "X-GitHub-Event",
                        "issues"
                    )
                    .set(
                        "X-GitHub-Delivery",
                        "delivery-invalid"
                    )
                    .set(
                        "X-Hub-Signature-256",
                        "sha256=invalid"
                    )

                    .set(
                        "Content-Type",
                        "application/json"
                    )
                    .send(payload);

            expect(
                response.status
            ).toBe(401);

            expect(
                response.body.error.code
            ).toBe(
                "GITHUB_WEBHOOK_SIGNATURE_INVALID"
            );
        }
    );

    test(
        "rejects a missing signature",
        async () => {
            const payload =
                JSON.stringify({
                    action: "opened",
                    repository: {
                        id: 12345
                    }
                });

            const response =
                await request(app)
                    .post(
                        "/api/v1/github/webhook"
                    )
                    .set(
                        "X-GitHub-Event",
                        "issues"
                    )
                    .set(
                        "X-GitHub-Delivery",
                        "delivery-missing-signature"
                    )
                    .set(
                        "Content-Type",
                        "application/json"
                    )
                    .send(payload);

            expect(
                response.status
            ).toBe(401);
        }
    );

    test(
        "rejects a missing event header",
        async () => {
            const payload =
                JSON.stringify({
                    action: "opened",
                    repository: {
                        id: 12345
                    }
                });

            const signature =
                createWebhookSignature(
                    payload,
                    secret
                );

            const response =
                await request(app)
                    .post(
                        "/api/v1/github/webhook"
                    )
                    .set(
                        "X-Hub-Signature-256",
                        signature
                    )
                    .set(
                        "X-GitHub-Delivery",
                        "delivery-no-event"
                    )
                    .set(
                        "Content-Type",
                        "application/json"
                    )
                    .send(payload);

            expect(
                response.status
            ).toBe(400);

            expect(
                response.body.error.code
            ).toBe(
                "GITHUB_WEBHOOK_EVENT_MISSING"
            );
        }
    );

    test(
        "rejects a missing delivery ID",
        async () => {
            const payload =
                JSON.stringify({
                    action: "opened",
                    repository: {
                        id: 12345
                    }
                });

            const signature =
                createWebhookSignature(
                    payload,
                    secret
                );

            const response =
                await request(app)
                    .post(
                        "/api/v1/github/webhook"
                    )
                    .set(
                        "X-GitHub-Event",
                        "issues"
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

            expect(
                response.status
            ).toBe(400);

            expect(
                response.body.error.code
            ).toBe(
                "GITHUB_WEBHOOK_DELIVERY_MISSING"
            );
        }
    );

    test(
        "returns 503 and marks delivery FAILED when webhook queueing fails",
        async () => {
            const deliveryId =
                "delivery-queue-failure";

            const payload = {
                repository: {
                    id: 12345
                },
                ref: "refs/heads/main",
                commits: []
            };

            const body =
                JSON.stringify(payload);

            const signature =
                createWebhookSignature(
                    body,
                    secret
                );

            const enqueueSpy =
                jest
                    .spyOn(
                        githubWebhookQueue,
                        "enqueueGithubWebhook"
                    )
                    .mockRejectedValue(
                        new Error(
                            "Redis unavailable"
                        )
                    );

            try {
                const response =
                    await request(app)
                        .post(
                            "/api/v1/github/webhook"
                        )
                        .set(
                            "X-Hub-Signature-256",
                            signature
                        )
                        .set(
                            "X-GitHub-Event",
                            "push"
                        )
                        .set(
                            "X-GitHub-Delivery",
                            deliveryId
                        )
                        .set(
                            "Content-Type",
                            "application/json"
                        )
                        .send(body);

                expect(
                    response.status
                ).toBe(503);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "GITHUB_WEBHOOK_QUEUE_UNAVAILABLE"
                );

                const delivery =
                    await GithubWebhookDelivery.findOne({
                        deliveryId
                    });

                expect(
                    delivery
                ).not.toBeNull();

                expect(
                    delivery.status
                ).toBe("FAILED");

                expect(
                    delivery.failureReason
                ).toBe(
                    "Redis unavailable"
                );
            } finally {
                enqueueSpy.mockRestore();
            }
        }
    );
});