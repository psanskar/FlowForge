const validateEnvironment = require("../../src/config/validateEnvironment");

const validEnvironment = {
    NODE_ENV: "development",
    MONGO_URI: "mongodb://127.0.0.1:27017/flowforge",
    REDIS_URL: "redis://127.0.0.1:6379",
    JWT_SECRET: "a-valid-development-secret-with-32-characters",
    GITHUB_WEBHOOK_SECRET: "a-valid-webhook-secret-with-32-characters",
    PORT: "5000"
};

describe("validateEnvironment", () => {
    test("accepts a complete API environment", () => {
        expect(() =>
            validateEnvironment("api", validEnvironment)
        ).not.toThrow();
    });

    test("reports all missing required API settings", () => {
        expect(() => validateEnvironment("api", {})).toThrow(
            /MONGO_URI is required[\s\S]*REDIS_URL is required[\s\S]*JWT_SECRET is required[\s\S]*GITHUB_WEBHOOK_SECRET is required/
        );
    });

    test("rejects short secrets and malformed service URLs", () => {
        expect(() => validateEnvironment("api", {
            ...validEnvironment,
            MONGO_URI: "http://localhost/db",
            REDIS_URL: "not-a-url",
            JWT_SECRET: "short",
            GITHUB_WEBHOOK_SECRET: "short"
        })).toThrow(/JWT_SECRET must contain at least 32 characters/);

        expect(() => validateEnvironment("api", {
            ...validEnvironment,
            MONGO_URI: "http://localhost/db",
            REDIS_URL: "not-a-url"
        })).toThrow(/MONGO_URI must use mongodb: or mongodb\+srv:/);
    });

    test("requires MongoDB and Redis for workers", () => {
        expect(() => validateEnvironment("worker", {
            MONGO_URI: validEnvironment.MONGO_URI,
            REDIS_URL: validEnvironment.REDIS_URL
        })).not.toThrow();

        expect(() => validateEnvironment("worker", {})).toThrow(
            /MONGO_URI is required[\s\S]*REDIS_URL is required/
        );
    });

    test("rejects example secrets in production", () => {
        expect(() => validateEnvironment("api", {
            ...validEnvironment,
            NODE_ENV: "production",
            JWT_SECRET: "replace-with-a-long-random-secret"
        })).toThrow(/Replace example secrets before starting in production/);
    });

    test("accepts comma-separated browser origins and rejects URL paths", () => {
        expect(() => validateEnvironment("api", {
            ...validEnvironment,
            CLIENT_URL: "http://localhost:5173,https://flowforge.example"
        })).not.toThrow();

        expect(() => validateEnvironment("api", {
            ...validEnvironment,
            CLIENT_URL: "https://flowforge.example/app"
        })).toThrow(/CLIENT_URL entries must be HTTP or HTTPS origins/);
    });
});
