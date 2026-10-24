const { spawn } = require("child_process");
const net = require("net");
const express = require("express");
const {
    createAuthRateLimiter,
    closeAuthRateLimitStore
} = require("../src/middleware/authRateLimit.middleware");

const findAvailablePort = () => new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
        const { port } = probe.address();
        probe.close((error) => error ? reject(error) : resolve(port));
    });
});

const waitForExit = (child, timeoutMs = 5000) => new Promise((resolve) => {
    if (child.exitCode !== null) {
        resolve();
        return;
    }

    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
    }, timeoutMs);

    child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
    });
});

const checkRedisBackedRateLimit = async () => {
    const app = express();
    const limiter = createAuthRateLimiter({
        name: `smoke-${process.pid}-${Date.now()}`,
        limit: 2,
        windowMs: 60_000,
        skip: () => false
    });

    app.post("/limit-check", limiter, (req, res) => {
        res.status(200).json({ success: true });
    });

    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    try {
        const url = `http://127.0.0.1:${server.address().port}/limit-check`;
        const first = await fetch(url, { method: "POST" });
        const second = await fetch(url, { method: "POST" });
        const limited = await fetch(url, { method: "POST" });

        if (first.status !== 200 || second.status !== 200 || limited.status !== 429) {
            throw new Error("Redis-backed authentication rate-limit smoke check failed");
        }

        console.log("Redis-backed authentication rate-limit smoke check passed");
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
};

const run = async () => {
    const port = await findAvailablePort();
    const child = spawn(process.execPath, ["src/server.js"], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });

    const deadline = Date.now() + 20_000;

    try {
        while (Date.now() < deadline) {
            if (child.exitCode !== null) {
                throw new Error(`API exited before becoming healthy.\n${output}`);
            }

            try {
                const response = await fetch(
                    `http://127.0.0.1:${port}/api/v1/health`,
                    { signal: AbortSignal.timeout(1000) }
                );
                const body = await response.json();

                if (
                    response.ok &&
                    body.success === true &&
                    body.data?.status === "ok"
                ) {
                    console.log("API startup and health smoke check passed");
                    await checkRedisBackedRateLimit();
                    return;
                }
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }

        throw new Error(`API did not become healthy within 20 seconds.\n${output}`);
    } finally {
        if (child.exitCode === null) {
            child.kill("SIGTERM");
            await waitForExit(child);
        }

        await closeAuthRateLimitStore();
    }
};

run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
