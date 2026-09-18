const mongoose = require("mongoose");

const dependencySchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        fromTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true
        },

        toTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

// Prevent duplicate dependency relationships.
dependencySchema.index(
    { project: 1, fromTask: 1, toTask: 1 },
    { unique: true }
);

// Useful for finding all dependencies involving a task.
dependencySchema.index({ project: 1, fromTask: 1 });
dependencySchema.index({ project: 1, toTask: 1 });

module.exports = mongoose.model("Dependency", dependencySchema);