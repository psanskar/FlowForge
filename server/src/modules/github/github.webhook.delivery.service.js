const GithubWebhookDelivery = require(
    "./github.webhook.delivery.model"
);

const getDelivery = async (deliveryId) => {
    return GithubWebhookDelivery.findOne({ deliveryId });
};

const recordDelivery = async ({ deliveryId, event }) => {
    try {
        return await GithubWebhookDelivery.create({
            deliveryId,
            event,
            status: "QUEUED",
            queueGeneration: 0
        });
    } catch (error) {
        if (error.code === 11000) {
            return null;
        }

        throw error;
    }
};

const generationFilter = (queueGeneration) => ({
    $or: [
        { queueGeneration },
        { queueGeneration: { $exists: false } }
    ]
});

const markDeliveryProcessing = async (
    deliveryId,
    processingJobId,
    queueGeneration = 0
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            ...generationFilter(queueGeneration),
            $and: [
                {
                    $or: [
                        { status: "QUEUED" },
                        {
                            status: "PROCESSING",
                            processingJobId
                        }
                    ]
                }
            ]
        },
        {
            $set: {
                status: "PROCESSING",
                processingJobId,
                processingStartedAt: new Date(),
                failureReason: null
            }
        },
        { returnDocument: "after" }
    );
};

const markDeliveryProcessed = async (
    deliveryId,
    processingJobId,
    queueGeneration = 0
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING",
            processingJobId,
            ...generationFilter(queueGeneration)
        },
        {
            $set: {
                status: "PROCESSED",
                processedAt: new Date(),
                failureReason: null
            },
            $unset: {
                processingJobId: 1,
                processingStartedAt: 1
            }
        },
        { returnDocument: "after" }
    );
};

const markDeliveryFailed = async (
    deliveryId,
    failureReason,
    processingJobId,
    queueGeneration = 0
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING",
            processingJobId,
            ...generationFilter(queueGeneration)
        },
        {
            $set: {
                status: "FAILED",
                failureReason,
                processedAt: null
            },
            $unset: {
                processingJobId: 1,
                processingStartedAt: 1
            }
        },
        { returnDocument: "after" }
    );
};

const resetDeliveryToQueued = async (
    deliveryId,
    processingJobId,
    queueGeneration = 0
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING",
            processingJobId,
            ...generationFilter(queueGeneration)
        },
        {
            $set: {
                status: "QUEUED",
                failureReason: null
            },
            $unset: {
                processingJobId: 1,
                processingStartedAt: 1
            }
        },
        { returnDocument: "after" }
    );
};

const recoverProcessingDelivery = async ({
    deliveryId,
    processingJobId,
    queueGeneration = 0
}) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING",
            processingJobId: processingJobId ?? null,
            ...generationFilter(queueGeneration)
        },
        {
            $set: {
                status: "QUEUED",
                failureReason: null,
                processedAt: null
            },
            $inc: {
                queueGeneration: 1
            },
            $unset: {
                processingJobId: 1,
                processingStartedAt: 1
            }
        },
        { returnDocument: "after" }
    );
};

const claimFailedDelivery = async ({ deliveryId, event }) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            event,
            status: "FAILED"
        },
        {
            $set: {
                status: "QUEUED",
                receivedAt: new Date(),
                processedAt: null,
                failureReason: null
            },
            $inc: {
                queueGeneration: 1
            },
            $unset: {
                processingJobId: 1,
                processingStartedAt: 1
            }
        },
        { returnDocument: "after" }
    );
};

module.exports = {
    getDelivery,
    recordDelivery,
    markDeliveryProcessing,
    markDeliveryProcessed,
    markDeliveryFailed,
    resetDeliveryToQueued,
    recoverProcessingDelivery,
    claimFailedDelivery
};
