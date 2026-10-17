const mongoose = require("mongoose");
const GithubSignal = require(
    "../modules/github/github.signal.model"
);
const GithubPullRequestState = require(
    "../modules/github/github.pullRequestState.model"
);

const ensureGithubIndexes = async () => {
    await Promise.all([
        GithubSignal.collection.createIndex({
            project: 1,
            type: 1,
            occurredAt: -1
        }),
        GithubPullRequestState.collection.createIndex(
            {
                repository: 1,
                githubId: 1
            },
            {
                unique: true
            }
        ),
        GithubPullRequestState.collection.createIndex({
            project: 1,
            latestEventType: 1
        }),
        GithubPullRequestState.collection.createIndex({
            project: 1,
            githubId: 1
        })
    ]);
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await ensureGithubIndexes();

        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
