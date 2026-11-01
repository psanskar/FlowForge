require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const validateEnvironment = require("./config/validateEnvironment");
const {
    connectAuthRateLimitStore,
    closeAuthRateLimitStore
} = require("./middleware/authRateLimit.middleware");
const { initializeSocket } = require("./realtime/socket");
const { closeGithubWebhookQueue } = require("./queues/githubWebhook.queue");

const PORT = process.env.PORT || 5000;

const closeSocketServer = (httpServer) => new Promise((resolve, reject) => {
    if (!httpServer.io?.close) {
        if (!httpServer.listening) {
            resolve();
            return;
        }

        httpServer.close((error) => error ? reject(error) : resolve());
        return;
    }

    httpServer.io.close((error) => error ? reject(error) : resolve());
});

const shutdownServer = async (httpServer) => {
    let shutdownError;

    try {
        await closeSocketServer(httpServer);
    } catch (error) {
        shutdownError = error;
    }

    try {
        await closeGithubWebhookQueue();
    } catch (error) {
        shutdownError ??= error;
    }

    const cleanupResults = await Promise.allSettled([
        closeAuthRateLimitStore(),
        mongoose.disconnect()
    ]);
    const cleanupError = cleanupResults.find((result) => result.status === "rejected");
    shutdownError ??= cleanupError?.reason;

    if (shutdownError) {
        throw shutdownError;
    }
};

const createServer = () => {
    const httpServer = http.createServer(app);

    initializeSocket(httpServer);

    return httpServer;
};

const startServer = async () => {
    validateEnvironment("api");
    await connectDB();
    await connectAuthRateLimitStore();

    const httpServer = createServer();

    httpServer.listen(PORT, () => {
        console.log(
            `FlowForge API running on port ${PORT}`
        );
    });

    return httpServer;
};

if (require.main === module) {
    startServer()
        .then((httpServer) => {
            const shutdown = async (signal) => {
                console.log(`Received ${signal}. Shutting down FlowForge API...`);

                await shutdownServer(httpServer);

                process.exit(0);
            };

            process.on("SIGINT", () => shutdown("SIGINT"));
            process.on("SIGTERM", () => shutdown("SIGTERM"));
        })
        .catch((error) => {
            console.error("Failed to start FlowForge API:", error.message);
            process.exitCode = 1;
        });
}

module.exports = {
    createServer,
    startServer,
    shutdownServer
};
