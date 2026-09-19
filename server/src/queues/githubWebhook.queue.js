const {
    Queue
} = require("bullmq");

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const githubWebhookQueue =
    new Queue(
        "github-webhook",
        {
            connection,

            defaultJobOptions: {
                attempts: 5,

                backoff: {
                    type: "exponential",
                    delay: 1000
                },

                removeOnComplete: {
                    age: 24 * 60 * 60,
                    count: 1000
                },

                removeOnFail: {
                    age: 7 * 24 * 60 * 60,
                    count: 5000
                }
            }
        }
    );

const enqueueGithubWebhook = async ({
    deliveryId,
    event,
    payload,
    jobId = deliveryId
}) => {
    return githubWebhookQueue.add(
        "process-webhook",
        {
            deliveryId,
            event,
            payload
        },
        {
            jobId
        }
    );
};

const closeGithubWebhookQueue =
    async () => {
        await githubWebhookQueue.close();
    };

module.exports = {
    githubWebhookQueue,
    enqueueGithubWebhook,
    closeGithubWebhookQueue
};