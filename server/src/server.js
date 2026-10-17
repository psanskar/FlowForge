require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const { initializeSocket } = require("./realtime/socket");
const {
    closeGithubWebhookQueue
} = require("./queues/githubWebhook.queue");

const PORT = process.env.PORT || 5000;

const createServer = () => {
    const httpServer = http.createServer(app);

    httpServer.io = initializeSocket(httpServer);

    return httpServer;
};

const shutdownServer = async (httpServer) => {
    if (httpServer?.io) {
        await new Promise((resolve, reject) => {
            httpServer.io.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    } else if (httpServer?.listening) {
        await new Promise((resolve, reject) => {
            httpServer.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    let shutdownError;

    try {
        await closeGithubWebhookQueue();
    } catch (error) {
        shutdownError = error;
    }

    try {
        await mongoose.disconnect();
    } catch (error) {
        shutdownError ||= error;
    }

    if (shutdownError) {
        throw shutdownError;
    }
};

const startServer = async () => {
    await connectDB();

    const httpServer = createServer();

    await new Promise((resolve, reject) => {
        const handleListenError = (error) => {
            reject(error);
        };

        httpServer.once("error", handleListenError);
        httpServer.listen(PORT, () => {
            httpServer.off("error", handleListenError);
            console.log(
                `FlowForge API running on port ${PORT}`
            );
            resolve();
        });
    });

    return httpServer;
};

if (require.main === module) {
    startServer()
        .then((httpServer) => {
            let shutdownPromise;

            const shutdown = (signal) => {
                if (shutdownPromise) {
                    return shutdownPromise;
                }

                console.log(
                    `Received ${signal}. Shutting down FlowForge API...`
                );

                shutdownPromise = shutdownServer(
                    httpServer
                )
                    .then(() => {
                        console.log(
                            "FlowForge API stopped"
                        );
                        process.exit(0);
                    })
                    .catch((error) => {
                        console.error(
                            "FlowForge API shutdown failed:",
                            error
                        );
                        process.exit(1);
                    });

                return shutdownPromise;
            };

            process.on("SIGINT", () => shutdown("SIGINT"));
            process.on("SIGTERM", () => shutdown("SIGTERM"));
        })
        .catch((error) => {
            console.error(
                "FlowForge API failed to start:",
                error
            );
            process.exit(1);
        });
}

module.exports = {
    createServer,
    startServer,
    shutdownServer
};
