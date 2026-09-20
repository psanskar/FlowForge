const mongoose = require("mongoose");

const projectHealthSnapshotSchema =
    new mongoose.Schema(
        {
            project: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Project",
                required: true,
                index: true
            },

            // Calendar date represented by this snapshot.
            // Used to enforce one snapshot per project per day.
            snapshotDate: {
                type: String,
                required: true
            },

            healthScore: {
                type: Number,
                required: true,
                min: 0,
                max: 100
            },

            healthStatus: {
                type: String,
                enum: [
                    "HEALTHY",
                    "ON_TRACK",
                    "AT_RISK",
                    "CRITICAL"
                ],
                required: true
            },

            riskCounts: {
                high: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                medium: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                }
            },

            taskSummary: {
                totalTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                completedTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                overdueTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                blockedTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                stagnantTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                workloadRisks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                }
            },

            milestoneSummary: {
                totalMilestones: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                completedMilestones: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                totalMilestoneTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                },
                completedMilestoneTasks: {
                    type: Number,
                    required: true,
                    min: 0,
                    default: 0
                }
            },

            capturedAt: {
                type: Date,
                required: true,
                default: Date.now,
                index: true
            }
        },
        { timestamps: true }
    );

// Used for historical trend queries.
projectHealthSnapshotSchema.index({
    project: 1,
    capturedAt: -1
});

// Prevents multiple snapshots for the same project
// on the same calendar day.
projectHealthSnapshotSchema.index(
    {
        project: 1,
        snapshotDate: 1
    },
    {
        unique: true
    }
);

const ProjectHealthSnapshot =
    mongoose.model(
        "ProjectHealthSnapshot",
        projectHealthSnapshotSchema
    );

module.exports = ProjectHealthSnapshot;