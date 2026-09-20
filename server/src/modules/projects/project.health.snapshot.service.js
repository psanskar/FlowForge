const mongoose = require("mongoose");

const {
    loadProjectRiskData
} = require("../risks/risk.service");

const {
    analyzeProject
} = require("../risks/risk.engine");

const {
    aggregateProjectHealth
} = require("../risks/health.aggregator");

const {
    updateProjectRiskHistory
} = require("../risks/risk.history.service");

const ProjectHealthSnapshot =
    require("./project.health.snapshot.model");

const ProjectRiskHistory =
    require("../risks/project.risk.history.model");

const countRisksBySeverity = (risks) => {
    return risks.reduce(
        (counts, risk) => {
            if (risk.severity === "HIGH") {
                counts.high++;
            }

            if (risk.severity === "MEDIUM") {
                counts.medium++;
            }

            return counts;
        },
        { high: 0, medium: 0 }
    );
};

const calculateMilestoneSummary = (
    milestones,
    tasks
) => {
    const milestoneTaskIds = new Set(
        milestones.map((milestone) =>
            milestone._id.toString()
        )
    );

    const milestoneTasks = tasks.filter(
        (task) =>
            task.milestone &&
            milestoneTaskIds.has(
                task.milestone.toString()
            )
    );

    const completedMilestones =
        milestones.filter(
            (milestone) =>
                milestone.status === "completed"
        ).length;

    const completedMilestoneTasks =
        milestoneTasks.filter(
            (task) =>
                task.status === "completed"
        ).length;

    return {
        totalMilestones: milestones.length,
        completedMilestones,
        totalMilestoneTasks:
            milestoneTasks.length,
        completedMilestoneTasks
    };
};

const formatSnapshotDate = (date) => {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const buildSnapshotData = ({
    tasks = [],
    milestones = [],
    risks = [],
    health,
    capturedAt
}) => {
    if (!health) {
        throw new Error(
            "Health data is required to build a snapshot"
        );
    }

    if (!capturedAt) {
        throw new Error(
            "Captured timestamp is required to build a snapshot"
        );
    }

    return {
        healthScore: health.score,

        healthStatus: health.health,

        riskCounts:
            countRisksBySeverity(risks),

        taskSummary: {
            totalTasks:
                health.summary.totalTasks,

            completedTasks:
                health.summary.completedTasks,

            overdueTasks:
                health.summary.overdueTasks,

            blockedTasks:
                health.summary.blockedTasks,

            stagnantTasks:
                health.summary.stagnantTasks,

            workloadRisks:
                health.summary.workloadRisks
        },

        milestoneSummary:
            calculateMilestoneSummary(
                milestones,
                tasks
            ),

        snapshotDate:
            formatSnapshotDate(capturedAt),

        capturedAt
    };
};

const loadPreviousActiveRisks =
    async (projectId) => {
        const history =
            await ProjectRiskHistory.find({
                project: projectId,
                status: "ACTIVE"
            })
                .select(
                    "identity type currentSeverity evidence"
                )
                .lean();

        return history.map((risk) => ({
            identity: risk.identity,
            type: risk.type,
            severity: risk.currentSeverity,
            evidence: risk.evidence || null
        }));
    };

        const captureProjectHealthSnapshot =
            async ({
                projectId,
                userId,
                now = new Date()
            }) => {
                if (
            !mongoose.Types.ObjectId.isValid(
                projectId
            )
        ) {
            const error = new Error(
                "Invalid project id"
            );

            error.statusCode = 400;
            error.code = "INVALID_PROJECT_ID";

            throw error;
        }

        const snapshotDate =
            formatSnapshotDate(now);

        /*
         * If this day's snapshot already exists,
         * return it immediately.
         *
         * This prevents repeated snapshot requests
         * from re-running lifecycle processing.
         */
        const existingSnapshot =
            await ProjectHealthSnapshot.findOne({
                project: projectId,
                snapshotDate
            });

        if (existingSnapshot) {
            return existingSnapshot;
        }

        const {
            project,
            tasks,
            dependencies,
            milestones,
            githubSignals
        } =
            await loadProjectRiskData(
                projectId,
                userId
            );

        const risks =
            analyzeProject({
                project,
                tasks,
                dependencies,
                milestones,
                githubSignals,
                now
            });

        const health =
            aggregateProjectHealth({
                tasks,
                risks,
                now
            });

        /*
         * Existing ACTIVE risk history becomes
         * the previous risk state.
         */
        const previousRisks =
            await loadPreviousActiveRisks(
                project._id
            );

        /*
         * Compare previous and current risks,
         * then persist NEW / PERSISTENT /
         * ESCALATED / DE_ESCALATED / RESOLVED.
         */
        await updateProjectRiskHistory({
            projectId: project._id,
            previousRisks,
            currentRisks: risks,
            capturedAt: now,
            snapshotDate
        });

        const snapshotData =
            buildSnapshotData({
                tasks,
                milestones,
                risks,
                health,
                capturedAt: now
            });

        try {
            return await ProjectHealthSnapshot.create({
                project: project._id,
                ...snapshotData
            });
        } catch (error) {
            /*
             * Another worker may have created
             * today's snapshot concurrently.
             *
             * Risk history is already idempotent
             * through snapshotKey, so safely return
             * the snapshot that won the race.
             */
            if (error?.code !== 11000) {
                throw error;
            }

            const concurrentSnapshot =
                await ProjectHealthSnapshot.findOne({
                    project: project._id,
                    snapshotDate
                });

            if (!concurrentSnapshot) {
                throw error;
            }

            return concurrentSnapshot;
        }
    };

module.exports = {
    countRisksBySeverity,
    calculateMilestoneSummary,
    formatSnapshotDate,
    buildSnapshotData,
    loadPreviousActiveRisks,
    captureProjectHealthSnapshot
};