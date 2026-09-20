const mongoose = require("mongoose");

const Project =
    require("./project.model");

const ProjectHealthSnapshot =
    require("./project.health.snapshot.model");

const ProjectRiskHistory =
    require("../risks/project.risk.history.model");

const {
    analyzeExecutionTrend
} =
    require("../risks/execution.trend.engine");

const MIN_PERSISTENCE_DETECTIONS = 3;

const HIGH_PERSISTENCE_DETECTIONS = 5;

const getRiskPersistenceSignal = (
    riskHistory
) => {
    const persistentRisks =
        riskHistory.filter(
            (risk) =>
                risk.status === "ACTIVE" &&
                risk.detectionCount >=
                    MIN_PERSISTENCE_DETECTIONS
        );

    if (!persistentRisks.length) {
        return null;
    }

    const highPersistenceCount =
        persistentRisks.filter(
            (risk) =>
                risk.detectionCount >=
                HIGH_PERSISTENCE_DETECTIONS
        ).length;

    return {
        type:
            "RISK_PERSISTENCE_INCREASING",

        severity:
            highPersistenceCount >= 1
                ? "HIGH"
                : "MEDIUM",

        evidence: {
            persistentRiskCount:
                persistentRisks.length,

            highPersistenceRiskCount:
                highPersistenceCount,

            minimumDetectionCount:
                MIN_PERSISTENCE_DETECTIONS,

            risks:
                persistentRisks.map(
                    (risk) => ({
                        identity:
                            risk.identity,

                        type:
                            risk.type,

                        severity:
                            risk.currentSeverity,

                        detectionCount:
                            risk.detectionCount,

                        firstDetectedAt:
                            risk.firstDetectedAt,

                        lastDetectedAt:
                            risk.lastDetectedAt
                    })
                )
        }
    };
};

const getExecutionTrend = async ({
    projectId,
    userId,
    days = 30
}) => {
    if (!mongoose.isValidObjectId(projectId)) {
        const error = new Error(
            "Invalid project id"
        );

        error.statusCode = 400;
        error.code = "INVALID_PROJECT_ID";

        throw error;
    }

    const project =
        await Project.findOne({
            _id: projectId,
            $or: [
                { owner: userId },
                {
                    "members.user":
                        userId
                }
            ]
        })
            .select("_id")
            .lean();

    if (!project) {
        const error = new Error(
            "Project not found or access denied"
        );

        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";

        throw error;
    }

    const snapshots =
        await ProjectHealthSnapshot.find({
            project: projectId
        })
            .sort({
                capturedAt: -1
            })
            .limit(days)
            .select(
                [
                    "snapshotDate",
                    "healthScore",
                    "healthStatus",
                    "riskCounts",
                    "taskSummary",
                    "milestoneSummary",
                    "capturedAt"
                ].join(" ")
            )
            .lean();

    snapshots.reverse();

    const trend =
        analyzeExecutionTrend({
            snapshots
        });

    const riskHistory =
        await ProjectRiskHistory.find({
            project: projectId,
            status: "ACTIVE"
        })
            .sort({
                lastDetectedAt: -1
            })
            .select(
                [
                    "identity",
                    "type",
                    "status",
                    "currentSeverity",
                    "firstDetectedAt",
                    "lastDetectedAt",
                    "detectionCount"
                ].join(" ")
            )
            .lean();

    const riskPersistence =
        getRiskPersistenceSignal(
            riskHistory
        );

    const signals = [
        ...trend.signals
    ];

    if (riskPersistence) {
        signals.push(
            riskPersistence
        );
    }

    return {
        projectId:
            project._id.toString(),

        range: `${days}d`,

        snapshots,

        signals
    };
};

module.exports = {
    getExecutionTrend,
    getRiskPersistenceSignal
};