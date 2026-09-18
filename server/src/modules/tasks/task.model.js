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

taskSchema.index({
    project: 1,
    status: 1
});

taskSchema.index({
    project: 1,
    dueDate: 1
});

taskSchema.index({
    project: 1,
    assignee: 1,
    status: 1
});

taskSchema.index({
    project: 1,
    lastActivityAt: 1
});

module.exports = mongoose.model("Task", taskSchema);