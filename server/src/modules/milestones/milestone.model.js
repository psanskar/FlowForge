const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

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

        dueDate: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: [
                "planned",
                "completed"
            ],
            default: "planned"
        }
    },
    {
        timestamps: true
    }
);

// Supports project-scoped milestone listing
// ordered by due date with deterministic tie-breaking.
milestoneSchema.index({
    project: 1,
    dueDate: 1,
    createdAt: 1,
    _id: 1
});

module.exports = mongoose.model(
    "Milestone",
    milestoneSchema
);