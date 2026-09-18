const mongoose = require("mongoose");

const githubRepositorySchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            unique: true,
            index: true
        },

        owner: {
            type: String,
            required: true,
            trim: true
        },

        repo: {
            type: String,
            required: true,
            trim: true
        },

        fullName: {
            type: String,
            required: true,
            trim: true
        },

        githubId: {
            type: Number,
            required: true
        },

        defaultBranch: {
            type: String,
            required: true,
            trim: true
        },

        private: {
            type: Boolean,
            required: true
        }
    },
    {
        timestamps: true
    }
);

githubRepositorySchema.index(
    { owner: 1, repo: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "GithubRepository",
    githubRepositorySchema
);