const mongoose = require("mongoose");

const githubWebhookDeliverySchema =
    new mongoose.Schema(
        {
            deliveryId: {
                type: String,
                required: true,
                trim: true
            },

            event: {
                type: String,
                required: true,
                trim: true
            },

            status: {
                type: String,
                enum: [
                    "QUEUED",
                    "PROCESSING",
                    "PROCESSED",
                    "FAILED"
                ],
                default: "QUEUED",
                required: true
            },

            receivedAt: {
                type: Date,
                default: Date.now,
                required: true
            },

            processedAt: {
                type: Date,
                default: null
            },

            failureReason: {
                type: String,
                default: null,
                trim: true
            }
        },
        {
            timestamps: true
        }
    );

githubWebhookDeliverySchema.index(
    { deliveryId: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "GithubWebhookDelivery",
    githubWebhookDeliverySchema
);