const mongoose = require("mongoose");

const projectMemberSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }

    },
    {
        _id: false
    }
);

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        mutationRevision: {
            type: Number,
            default: 0,
            select: false
        },

        members: {
            type: [projectMemberSchema],
            default: []
        },

        status: {
            type: String,
            enum: [
                "planning",
                "active",
                "completed",
                "archived"
            ],
            default: "planning"
        },

        statusBeforeArchive: {
            type: String,
            enum: ["planning", "active", "completed"],
            default: null,
            select: false
        },

        startDate: {
            type: Date,
            default: null
        },

        targetDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

projectSchema.index({
    "members.user": 1,
    updatedAt: -1,
    _id: 1
});

projectSchema.index({
    owner: 1
});

module.exports = mongoose.model("Project", projectSchema);
