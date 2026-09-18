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

    test("accepts and processes a valid GitHub webhook", async () => {
        const payload = JSON.stringify({
            action: "opened",
            repository: {
                id: 12345,
                name: "backend"
            },
            issue: {
                id: 98765,
                number: 12,
                title: "Fix deployment issue",
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
        ).toBe(200);

        expect(
            response.body.success
        ).toBe(true);

        expect(
            response.body.data.received
        ).toBe(true);

        expect(
            response.body.data.processed
        ).toBe(true);

        expect(
            response.body.data.event
        ).toBe("issues");

        expect(
            response.body.data.deliveryId
        ).toBe("delivery-123");

        expect(
            response.body.data.signalCount
        ).toBe(1);

        const signal =
            await GithubSignal.findOne({
                externalId:
                    "issue:98765:opened"
            });

        expect(signal).not.toBeNull();

        expect(
            signal.type
        ).toBe("ISSUE_OPENED");

        expect(
            signal.project.toString()
        ).toBe(
            projectId.toString()
        );

        const delivery =
            await GithubWebhookDelivery.findOne({
                deliveryId:
                    "delivery-123"
            });

        expect(delivery).not.toBeNull();

        expect(
            delivery.status
        ).toBe("PROCESSED");
    });

    test("rejects an invalid signature", async () => {
        const payload = JSON.stringify({
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
    });

    test("rejects a missing signature", async () => {
        const payload = JSON.stringify({
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
    });

    test("rejects a missing event header", async () => {
        const payload = JSON.stringify({
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
                    "X-GitHub-Delivery",
                    "delivery-no-event"
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
            "GITHUB_WEBHOOK_EVENT_MISSING"
        );
    });

    test("rejects a missing delivery ID", async () => {
        const payload = JSON.stringify({
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
    });
});