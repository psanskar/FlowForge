const mongoose = require("mongoose");

const githubSignalSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },

        repository: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GithubRepository",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: [
                "COMMIT",
                "PULL_REQUEST_OPENED",
                "PULL_REQUEST_MERGED",
                "PULL_REQUEST_CLOSED",
                "ISSUE_OPENED",
                "ISSUE_CLOSED"
            ],
            required: true
        },

        externalId: {
            type: String,
            required: true,
            trim: true
        },

        occurredAt: {
            type: Date,
            required: true,
            index: true
        },

        actor: {
            id: {
                type: Number,
                default: null
            },

            login: {
                type: String,
                default: null,
                trim: true
            }
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

githubSignalSchema.index(
    {
        repository: 1,
        externalId: 1
    },
    {
        unique: true
    }
);

githubSignalSchema.index({
    project: 1,
    occurredAt: -1
});

module.exports = mongoose.model(
    "GithubSignal",
    githubSignalSchema
);