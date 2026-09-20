const RISK_SEVERITY_ORDER = {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3
};

const TOP_RISKS_LIMIT = 5;

const getRiskImpact = (risk) => {
    switch (risk.type) {
        case "TASK_OVERDUE":
            return risk.daysOverdue || 0;

        case "TASK_STAGNANT":
            return risk.inactiveDays || 0;

        case "DEPENDENCY_BOTTLENECK":
            return risk.downstreamCount || 0;

        case "MILESTONE_RISK": {
            const urgency =
                risk.daysUntilDue <= 0
                    ? 1000 +
                      Math.abs(
                          risk.daysUntilDue
                      )
                    : 100 -
                      risk.daysUntilDue;

            return (
                urgency +
                (risk.unfinishedTaskCount || 0)
            );
        }

        case "WORKLOAD_IMBALANCE":
            return risk.activeTasks || 0;

        case "GITHUB_AGING_PR":
            return risk.ageDays || 0;

        case "GITHUB_ISSUE_BACKLOG":
            return risk.backlogGrowth || 0;

        case "GITHUB_LOW_MERGE_THROUGHPUT":
            return risk.openedCount || 0;

        default:
            return 0;
    }
};

const getTopRisks = (
    risks,
    limit = TOP_RISKS_LIMIT
) => {
    return [...risks]
        .sort((a, b) => {
            const severityA =
                RISK_SEVERITY_ORDER[
                    a.severity
                ] || 99;

            const severityB =
                RISK_SEVERITY_ORDER[
                    b.severity
                ] || 99;

            if (
                severityA !== severityB
            ) {
                return (
                    severityA -
                    severityB
                );
            }

            const impactA =
                getRiskImpact(a);

            const impactB =
                getRiskImpact(b);

            if (
                impactA !== impactB
            ) {
                return (
                    impactB -
                    impactA
                );
            }

            return a.type.localeCompare(
                b.type
            );
        })
        .slice(0, limit);
};

const getMilestoneProgress = (
    milestones,
    tasks
) => {
    const taskStatsByMilestone = new Map();

    for (const task of tasks) {
        if (!task.milestone) {
            continue;
        }

        const milestoneId =
            task.milestone.toString();

        let stats =
            taskStatsByMilestone.get(milestoneId);

        if (!stats) {
            stats = {
                totalTasks: 0,
                completedTasks: 0
            };

            taskStatsByMilestone.set(
                milestoneId,
                stats
            );
        }

        stats.totalTasks += 1;

        if (task.status === "completed") {
            stats.completedTasks += 1;
        }
    }

    return milestones.map((milestone) => {
        const stats =
            taskStatsByMilestone.get(
                milestone._id.toString()
            ) || {
                totalTasks: 0,
                completedTasks: 0
            };

        return {
            id: milestone._id,
            name: milestone.name,
            description: milestone.description,
            dueDate: milestone.dueDate,
            status: milestone.status,
            totalTasks: stats.totalTasks,
            completedTasks: stats.completedTasks,
            unfinishedTasks:
                stats.totalTasks -
                stats.completedTasks
        };
    });
};

const getWorkload = (
    tasks,
    users = []
) => {
    const workload = new Map();

    for (const task of tasks) {
        if (
            ![
                "todo",
                "in_progress",
                "blocked"
            ].includes(task.status) ||
            !task.assignee
        ) {
            continue;
        }

        const userId =
            task.assignee.toString();

        workload.set(
            userId,
            (workload.get(userId) || 0) +
                1
        );
    }

    const userMap = new Map(
        users.map((user) => [
            user._id.toString(),
            user
        ])
    );

    return Array.from(
        workload,
        ([userId, activeTasks]) => {
            const user =
                userMap.get(userId);

            return {
                userId,
                name:
                    user?.name ||
                    "Unknown",
                activeTasks
            };
        }
    ).sort(
        (a, b) =>
            b.activeTasks -
            a.activeTasks
    );
};

const buildDashboardData = ({
    project,
    health,
    tasks = [],
    milestones = [],
    risks = [],
    users = []
}) => {
    return {
        project: {
            id: project._id,
            name: project.name,
            description:
                project.description,
            status: project.status,
            startDate:
                project.startDate,
            targetDate:
                project.targetDate
        },

        health: {
            score: health.score,
            health: health.health
        },

        taskSummary: health.summary,

        milestones:
            getMilestoneProgress(
                milestones,
                tasks
            ),

        topRisks:
            getTopRisks(risks),

        workload:
            getWorkload(
                tasks,
                users
            )
    };
};

module.exports = {
    getTopRisks,
    getMilestoneProgress,
    getWorkload,
    buildDashboardData
};