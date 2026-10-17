const mongoose = require("mongoose");

const githubPullRequestStateSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        repository: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GithubRepository",
            required: true
        },
        githubId: {
            type: String,
            required: true
        },
        firstOpenedAt: {
            type: Date,
            default: null
        },
        lastOpenedAt: {
            type: Date,
            default: null
        },
        latestEventAt: {
            type: Date,
            required: true
        },
        latestEventType: {
            type: String,
            enum: [
                "PULL_REQUEST_OPENED",
                "PULL_REQUEST_MERGED",
                "PULL_REQUEST_CLOSED"
            ],
            required: true
        },
        latestEventId: {
            type: String,
            required: true
        },
        latestEventMetadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

githubPullRequestStateSchema.index(
    {
        repository: 1,
        githubId: 1
    },
    {
        unique: true
    }
);

githubPullRequestStateSchema.index({
    project: 1,
    latestEventType: 1
});

githubPullRequestStateSchema.index({
    project: 1,
    githubId: 1
});

module.exports = mongoose.model(
    "GithubPullRequestState",
    githubPullRequestStateSchema
);
