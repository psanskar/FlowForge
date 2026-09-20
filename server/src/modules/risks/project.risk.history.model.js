const mongoose = require("mongoose");

const projectRiskHistorySchema =
    new mongoose.Schema(
        {
            project: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Project",
                required: true,
                index: true
            },

            identity: {
                type: String,
                required: true
            },

            type: {
                type: String,
                required: true
            },

            status: {
                type: String,
                enum: [
                    "ACTIVE",
                    "RESOLVED"
                ],
                required: true,
                default: "ACTIVE"
            },

            currentSeverity: {
                type: String,
                enum: [
                    "MEDIUM",
                    "HIGH"
                ],
                required: true
            },

            previousSeverity: {
                type: String,
                enum: [
                    "MEDIUM",
                    "HIGH"
                ],
                default: null
            },

            firstDetectedAt: {
                type: Date,
                required: true
            },

            lastDetectedAt: {
                type: Date,
                required: true
            },

            resolvedAt: {
                type: Date,
                default: null
            },

            detectionCount: {
                type: Number,
                required: true,
                min: 1,
                default: 1
            },

            lastLifecycle: {
                type: String,
                enum: [
                    "NEW",
                    "PERSISTENT",
                    "ESCALATED",
                    "DE_ESCALATED",
                    "RESOLVED"
                ],
                required: true
            },

            evidence: {
                type: mongoose.Schema.Types.Mixed,
                default: null
            },

            snapshotKey: {
                type: String,
                required: true
            }
        },
        {
            timestamps: true
        }
    );

projectRiskHistorySchema.index(
    {
        project: 1,
        identity: 1
    },
    {
        unique: true
    }
);

projectRiskHistorySchema.index({
    project: 1,
    status: 1,
    lastDetectedAt: -1
});

projectRiskHistorySchema.index({
    project: 1,
    currentSeverity: 1,
    status: 1
});

const ProjectRiskHistory =
    mongoose.model(
        "ProjectRiskHistory",
        projectRiskHistorySchema
    );

module.exports = ProjectRiskHistory;