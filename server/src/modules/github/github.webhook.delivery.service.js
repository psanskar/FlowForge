const GithubWebhookDelivery =
    require(
        "./github.webhook.delivery.model"
    );

const getDelivery = async (
    deliveryId
) => {
    return GithubWebhookDelivery.findOne({
        deliveryId
    });
};

const recordDelivery = async ({
    deliveryId,
    event
}) => {
    try {
        return await GithubWebhookDelivery.create({
            deliveryId,
            event,
            status: "QUEUED"
        });
    } catch (error) {
        if (error.code === 11000) {
            return null;
        }

        throw error;
    }
};

const markDeliveryProcessing = async (
    deliveryId
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "QUEUED"
        },
        {
            $set: {
                status: "PROCESSING",
                failureReason: null
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const markDeliveryProcessed = async (
    deliveryId
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING"
        },
        {
            $set: {
                status: "PROCESSED",
                processedAt: new Date(),
                failureReason: null
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const markDeliveryFailed = async (
    deliveryId,
    failureReason
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING"
        },
        {
            $set: {
                status: "FAILED",
                failureReason
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const markQueuedDeliveryFailed = async (
    deliveryId,
    failureReason
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "QUEUED"
        },
        {
            $set: {
                status: "FAILED",
                failureReason,
                processedAt: null
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const resetDeliveryToQueued = async (
    deliveryId
) => {
    return GithubWebhookDelivery.findOneAndUpdate(
        {
            deliveryId,
            status: "PROCESSING"
        },
        {
            $set: {
                status: "QUEUED",
                failureReason: null
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const claimFailedDelivery = async ({
    deliveryId,
    event
}) => {
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
            }
        },
        {
            returnDocument: "after"
        }
    );
};

module.exports = {
    getDelivery,
    recordDelivery,
    markDeliveryProcessing,
    markDeliveryProcessed,
    markDeliveryFailed,
    resetDeliveryToQueued,
    claimFailedDelivery,
    markQueuedDeliveryFailed
};