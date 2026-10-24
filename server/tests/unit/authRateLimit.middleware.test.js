const express = require("express");
const request = require("supertest");
const { MemoryStore } = require("express-rate-limit");

const {
    createAuthRateLimiter,
    closeAuthRateLimitStore
} = require("../../src/middleware/authRateLimit.middleware");

describe("authentication rate limit", () => {
    let store;

    afterEach(() => {
        store?.shutdown();
    });

    afterAll(async () => {
        await closeAuthRateLimitStore();
    });

    test("blocks requests after the configured attempt limit", async () => {
        const app = express();
        store = new MemoryStore();
        const limiter = createAuthRateLimiter({
            name: "test",
            limit: 2,
            windowMs: 60_000,
            store,
            skip: () => false
        });

        app.post("/login", limiter, (req, res) => {
            res.status(200).json({ success: true });
        });

        expect((await request(app).post("/login")).status).toBe(200);
        expect((await request(app).post("/login")).status).toBe(200);

        const limited = await request(app).post("/login");

        expect(limited.status).toBe(429);
        expect(limited.body.error.code).toBe("AUTH_RATE_LIMITED");
        expect(limited.headers.ratelimit).toBeDefined();
    });
});
