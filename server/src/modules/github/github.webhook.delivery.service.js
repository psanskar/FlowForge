const GithubWebhookDelivery =
    require("./github.webhook.delivery.model");

const getDelivery =
    async (deliveryId) => {
        return GithubWebhookDelivery.findOne({
            deliveryId
        });
    };

const recordDelivery =
    async ({
        deliveryId,
        event
    }) => {
        try {
            return await GithubWebhookDelivery.create({
                deliveryId,
                event,
                status: "PROCESSING"
            });
        } catch (error) {
            if (error.code === 11000) {
                return null;
            }

            throw error;
        }
    };

const markDeliveryProcessed =
    async (deliveryId) => {
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

const markDeliveryFailed =
    async (
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

const claimFailedDelivery =
    async ({
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
                    status: "PROCESSING",
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
    markDeliveryProcessed,
    markDeliveryFailed,
    claimFailedDelivery
};