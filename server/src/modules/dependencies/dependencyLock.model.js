const mongoose = require("mongoose");

const dependencyLockSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        token: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

dependencyLockSchema.index({ project: 1 }, { unique: true });

module.exports = mongoose.model("DependencyLock", dependencyLockSchema);
