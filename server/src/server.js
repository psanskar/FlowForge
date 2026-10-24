require("dotenv").config();

const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const validateEnvironment = require("./config/validateEnvironment");
const {
    connectAuthRateLimitStore,
    closeAuthRateLimitStore
} = require("./middleware/authRateLimit.middleware");
const { initializeSocket } = require("./realtime/socket");

const PORT = process.env.PORT || 5000;

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

                await new Promise((resolve) => {
                    httpServer.close(resolve);
                });

                await Promise.all([
                    require("mongoose").disconnect(),
                    closeAuthRateLimitStore()
                ]);

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
    startServer
};
