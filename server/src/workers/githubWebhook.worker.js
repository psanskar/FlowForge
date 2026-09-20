const {
    Worker
} = require("bullmq");

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
            payload
        } = job.data;

        const delivery =
            await markDeliveryProcessing(
                deliveryId
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

            await markDeliveryProcessed(
                deliveryId
            );

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
                    error.message
                );
            } else {
                await resetDeliveryToQueued(
                    deliveryId
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
    }
);

const closeGithubWebhookWorker =
    async () => {
        await githubWebhookWorker.close();
    };

const startGithubWebhookWorker = () => {
    console.log(
        "FlowForge GitHub webhook worker running"
    );

    return githubWebhookWorker;
};

if (require.main === module) {
    startGithubWebhookWorker();

    const shutdown = async (
        signal
    ) => {
        console.log(
            `Received ${signal}. Shutting down GitHub webhook worker...`
        );

        await closeGithubWebhookWorker();

        console.log(
            "GitHub webhook worker stopped"
        );

        process.exit(0);
    };

    process.on(
        "SIGINT",
        () => shutdown("SIGINT")
    );

    process.on(
        "SIGTERM",
        () => shutdown("SIGTERM")
    );
}

module.exports = {
    githubWebhookWorker,
    closeGithubWebhookWorker,
    startGithubWebhookWorker
};