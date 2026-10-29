import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(clientDirectory, "../server");
const apiUrl = "http://127.0.0.1:5500";
const clientUrl = "http://127.0.0.1:5175";
const e2eMongoUri = process.env.E2E_MONGO_URI ??
    "mongodb://127.0.0.1:27018/flowforge_browser_test";
const e2eRedisUrl = process.env.E2E_REDIS_URL ??
    "redis://127.0.0.1:6380";

const parsedMongoUri = new URL(e2eMongoUri);
const e2eDatabaseName = decodeURIComponent(
    parsedMongoUri.pathname.replace(/^\/+/, "").split("/")[0]
);

if (
    parsedMongoUri.protocol !== "mongodb:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsedMongoUri.hostname) ||
    e2eDatabaseName !== "flowforge_browser_test"
) {
    throw new Error(
        "E2E_MONGO_URI must point to a local MongoDB service using the flowforge_browser_test database."
    );
}

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: clientUrl,
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    webServer: [
        {
            command: "npm start",
            cwd: serverDirectory,
            url: `${apiUrl}/api/v1/health`,
            reuseExistingServer: false,
            timeout: 30_000,
            env: {
                ...process.env,
                NODE_ENV: "test",
                MONGO_URI: e2eMongoUri,
                REDIS_URL: e2eRedisUrl,
                JWT_SECRET: process.env.E2E_JWT_SECRET ??
                    "flowforge-e2e-test-secret-with-more-than-32-characters",
                GITHUB_WEBHOOK_SECRET: process.env.E2E_GITHUB_WEBHOOK_SECRET ??
                    "flowforge-e2e-webhook-secret-with-more-than-32-characters",
                PORT: "5500",
                CLIENT_URL: clientUrl
            }
        },
        {
            command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
            cwd: clientDirectory,
            url: clientUrl,
            reuseExistingServer: false,
            timeout: 30_000,
            env: {
                ...process.env,
                VITE_API_BASE_URL: `${apiUrl}/api/v1`
            }
        }
    ]
});
