const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        status: {
            type: String,
            enum: [
                "todo",
                "in_progress",
                "blocked",
                "completed"
            ],
            default: "todo"
        },

        priority: {
            type: String,
            enum: [
                "low",
                "medium",
                "high",
                "critical"
            ],
            default: "medium"
        },

        assignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        milestone: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Milestone",
            default: null
        },

        dueDate: {
            type: Date,
            default: null
        },

        progress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        startedAt: {
            type: Date,
            default: null
        },

        completedAt: {
            type: Date,
            default: null
        },

        lastActivityAt: {
            type: Date,
            default: Date.now
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        version: {
            type: Number,
            default: 1
        }
    },
    {
        timestamps: true
    }
);

// Task filtering by project and status.
taskSchema.index({
    project: 1,
    status: 1
});

// Default API sort: dueDate ascending,
// then createdAt descending, then _id ascending.
taskSchema.index({
    project: 1,
    dueDate: 1,
    createdAt: -1,
    _id: 1
});

// API sort: newest created tasks first.
taskSchema.index({
    project: 1,
    createdAt: -1,
    _id: 1
});

// API sort: recently updated tasks first.
taskSchema.index({
    project: 1,
    updatedAt: -1,
    _id: 1
});

// Contributor/status filtering.
taskSchema.index({
    project: 1,
    assignee: 1,
    status: 1
});

// Used by stagnation/risk-related queries.
taskSchema.index({
    project: 1,
    lastActivityAt: 1
});

module.exports = mongoose.model("Task", taskSchema);