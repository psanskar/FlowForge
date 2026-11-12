const request = require("supertest");

const app = require("../../src/app");

describe("Operations API", () => {
    let originalOperationsKey;

    beforeEach(() => {
        originalOperationsKey = process.env.OPERATIONS_API_KEY;
    });

    afterEach(() => {
        if (originalOperationsKey === undefined) delete process.env.OPERATIONS_API_KEY;
        else process.env.OPERATIONS_API_KEY = originalOperationsKey;
    });

    test("readiness reports MongoDB and Redis dependency status", async () => {
        const response = await request(app)
            .get("/api/v1/ready");

        expect(response.statusCode).toBe(200);
        expect(response.body).toMatchObject({
            success: true,
            data: {
                status: "ready",
                checks: {
                    mongodb: "ready",
                    redis: "ready"
                }
            }
        });
    });

    test("queue status requires the operations key and omits job payloads", async () => {
        process.env.OPERATIONS_API_KEY = "test-operations-key-with-at-least-32-characters";
        const denied = await request(app)
            .get("/api/v1/ops/queues");

        expect(denied.statusCode).toBe(401);

        const invalidKey = await request(app)
            .get("/api/v1/ops/queues")
            .set("X-FlowForge-Ops-Key", "wrong-operations-key");
        expect(invalidKey.statusCode).toBe(401);

        const response = await request(app)
            .get("/api/v1/ops/queues")
            .set("X-FlowForge-Ops-Key", process.env.OPERATIONS_API_KEY);

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toMatchObject({
            status: "degraded",
            queues: {
                githubWebhook: {
                    status: "available",
                    counts: {
                        waiting: 0,
                        active: 0,
                        completed: 0,
                        failed: 0,
                        delayed: 0,
                        paused: 0,
                        "waiting-children": 0
                    }
                },
                healthSnapshot: {
                    status: "available",
                    counts: {
                        waiting: 0,
                        active: 0,
                        completed: 0,
                        failed: 0,
                        delayed: 0,
                        paused: 0,
                        "waiting-children": 0
                    }
                }
            },
            failedWebhookDeliveries: 0
        });
        expect(JSON.stringify(response.body))
            .not.toContain("payload");

    });

    test("fails closed when no operations key is configured", async () => {
        delete process.env.OPERATIONS_API_KEY;
        const response = await request(app)
            .get("/api/v1/ops/queues");

        expect(response.statusCode).toBe(503);
        expect(response.body.error.code).toBe("OPERATIONS_KEY_NOT_CONFIGURED");
    });
});
