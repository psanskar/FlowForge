require("dotenv").config();

const {
    Worker
} = require("bullmq");
const validateEnvironment = require("../config/validateEnvironment");
const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { startWorkerHeartbeat } = require("../operations/workerHeartbeat");

const {
    EventEmitter
} = require("events");

const {
    markDeliveryProcessing,
    markDeliveryProcessed,
    markDeliveryFailed,
    resetDeliveryToQueued
} = require(
    "../modules/github/github.webhook.delivery.service"
);

const {
    processGithubWebhook
} = require(
    "../modules/github/github.webhook.service"
);

const {
    githubWebhookQueue
} = require(
    "../queues/githubWebhook.queue"
);

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const processGithubWebhookJob =
    async (job) => {
        const {
            deliveryId,
            event,
            payload,
            queueGeneration = 0
        } = job.data;
        const processingJobId = String(
            job.id || `${deliveryId}-${queueGeneration}`
        );

        const delivery =
            await markDeliveryProcessing(
                deliveryId,
                processingJobId,
                queueGeneration
            );

        if (!delivery) {
            return {
                skipped: true,
                deliveryId
            };
        }

        try {
            const result =
                await processGithubWebhook({
                    event,
                    payload
                });

            const processedDelivery = await markDeliveryProcessed(
                deliveryId,
                processingJobId,
                queueGeneration
            );

            if (!processedDelivery) {
                throw new Error(
                    `Webhook processing claim was lost for ${deliveryId}`
                );
            }

            return {
                deliveryId,
                signalCount:
                    result.signals.length
            };
        } catch (error) {
            const isFinalAttempt =
                job.attemptsMade + 1 >=
                job.opts.attempts;

            if (isFinalAttempt) {
                await markDeliveryFailed(
                    deliveryId,
                    error.message,
                    processingJobId,
                    queueGeneration
                );
            } else {
                await resetDeliveryToQueued(
                    deliveryId,
                    processingJobId,
                    queueGeneration
                );
            }

            throw error;
        }
    };

const createTestWorker = () => {
    const testWorker =
        new EventEmitter();

    let closed = false;

    testWorker.close = async () => {
        closed = true;
    };

    githubWebhookQueue.setProcessor(
        async (job) => {
            if (closed) {
                return;
            }

            return processGithubWebhookJob(
                job
            );
        },
        testWorker
    );

    return testWorker;
};

const githubWebhookWorker =
    process.env.NODE_ENV === "test"
        ? createTestWorker()
        : new Worker(
              "github-webhook",
              processGithubWebhookJob,
              {
                  connection,
                  concurrency: 5
              }
          );

let stopWorkerHeartbeat = async () => {};

githubWebhookWorker.on(
    "completed",
    (job) => {
        console.log(
            `GitHub webhook job completed: ${job.id}`
        );
    }
);

githubWebhookWorker.on(
    "failed",
    (job, error) => {
        console.error(
            `GitHub webhook job failed: ${
                job?.id
            }`,
            error
        );

        if (job?.data?.deliveryId && job.id) {
            const queueGeneration = job.data.queueGeneration ?? 0;

            markDeliveryFailed(
                job.data.deliveryId,
                error.message,
                String(job.id),
                queueGeneration
            ).catch((failureError) => {
                console.error(
                    `Could not persist terminal webhook failure (${job.id}):`,
                    failureError.message
                );
            });
        }
    }
);

const closeGithubWebhookWorker =
    async () => {
        await githubWebhookWorker.close();
    };

const startGithubWebhookWorker = async () => {
    if (process.env.NODE_ENV !== "test") {
        await githubWebhookWorker.waitUntilReady();
        stopWorkerHeartbeat = await startWorkerHeartbeat(
            githubWebhookQueue,
            "github-worker"
        );
    }

    console.log(
        "FlowForge GitHub webhook worker running"
    );

    return githubWebhookWorker;
};

if (require.main === module) {
    const shutdown = async (signal) => {
        console.log(`Received ${signal}. Shutting down GitHub webhook worker...`);
        await stopWorkerHeartbeat();
        await closeGithubWebhookWorker();
        await mongoose.disconnect();
        console.log("GitHub webhook worker stopped");
        process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    (async () => {
        validateEnvironment("worker");
        await connectDB();
        await startGithubWebhookWorker();
    })().catch((error) => {
        console.error("Failed to start GitHub webhook worker:", error.message);
        process.exit(1);
    });
}

module.exports = {
    githubWebhookWorker,
    closeGithubWebhookWorker,
    startGithubWebhookWorker
};
