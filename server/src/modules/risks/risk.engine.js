const STAGNANT_DAYS = 5;
const MILESTONE_WARNING_DAYS = 7;
const BOTTLENECK_THRESHOLD = 3;

const {
    analyzeGithubProject
} = require("./github.risk.engine");

const UNFINISHED_STATUSES = [
    "todo",
    "in_progress",
    "blocked"
];

const ACTIVE_STATUSES = [
    "todo",
    "in_progress",
    "blocked"
];

const getSeverityForBlockedTask = (task) => {
    if (
        task.priority === "high" ||
        task.priority === "critical"
    ) {
        return "HIGH";
    }

    return "MEDIUM";
};

const getSeverityForStagnantTask = (task) => {
    if (task.priority === "critical") {
        return "HIGH";
    }

    return "MEDIUM";
};

const getDaysDifference = (from, to) => {
    const millisecondsPerDay =
        1000 * 60 * 60 * 24;

    return Math.floor(
        (to.getTime() - from.getTime()) /
        millisecondsPerDay
    );
};

/*
 * Adds a stable identifier to a generated risk.
 *
 * The identifier represents the underlying risk rather
 * than the current ordering of the risk array.
 */
const addRiskIdentity = (risk) => {
    let entityId = null;

    if (risk.taskId) {
        entityId = risk.taskId;
    } else if (risk.milestoneId) {
        entityId = risk.milestoneId;
    } else if (risk.userId) {
        entityId = risk.userId;
    } else if (risk.githubPrId) {
        entityId = risk.githubPrId;
    }

    if (entityId !== null && entityId !== undefined) {
        entityId = entityId.toString();
    }

    const id = entityId
        ? `${risk.type}:${entityId}`
        : risk.type;

    return {
        ...risk,
        id
    };
};

const addRiskEvidence = (risk) => {
    if (risk.evidence) {
        return risk;
    }

    const evidence = [];

    switch (risk.type) {
        case "TASK_OVERDUE":
            evidence.push(
                `Task is ${risk.daysOverdue} day${
                    risk.daysOverdue === 1
                        ? ""
                        : "s"
                } overdue`
            );
            break;

        case "TASK_STAGNANT":
            evidence.push(
                `No activity detected for ${risk.inactiveDays} days`
            );
            break;

        case "TASK_BLOCKED":
            evidence.push(
                "Task status is currently blocked"
            );
            break;

        case "DEPENDENCY_BOTTLENECK":
            evidence.push(
                `Task is blocking ${risk.downstreamCount} unfinished tasks`
            );
            break;

        case "MILESTONE_RISK": {
            const unfinishedTaskLabel =
                risk.unfinishedTaskCount === 1
                    ? "task"
                    : "tasks";

            evidence.push(
                `${risk.unfinishedTaskCount} unfinished ${unfinishedTaskLabel} ${
                    risk.unfinishedTaskCount === 1
                        ? "remains"
                        : "remain"
                } before the milestone deadline`
            );

            const days =
                Math.abs(risk.daysUntilDue);

            const dayLabel =
                days === 1 ? "day" : "days";

            evidence.push(
                `Milestone deadline is ${
                    risk.daysUntilDue < 0
                        ? `${days} ${dayLabel} overdue`
                        : `within ${days} ${dayLabel}`
                }`
            );

            break;
        }

        case "WORKLOAD_IMBALANCE":
            evidence.push(
                `Contributor has ${risk.activeTasks} active tasks`
            );

            evidence.push(
                `Median contributor workload is ${risk.medianWorkload}`
            );
            break;

        case "GITHUB_AGING_PR":
            evidence.push(
                `Pull request has been open for ${risk.ageDays} days`
            );

            evidence.push(
                "Open pull request exceeded the configured aging threshold"
            );
            break;

        case "GITHUB_ISSUE_BACKLOG":
            evidence.push(
                `${risk.openedCount} issues were opened in the analysis window`
            );

            evidence.push(
                `${risk.closedCount} issues were closed in the analysis window`
            );

            evidence.push(
                `Net issue backlog growth is ${risk.backlogGrowth}`
            );
            break;

        case "GITHUB_LOW_MERGE_THROUGHPUT":
            evidence.push(
                `${risk.openedCount} pull requests were opened in the analysis window`
            );

            evidence.push(
                "No pull requests were merged in the analysis window"
            );
            break;

        
        case "GITHUB_HIGH_PR_CYCLE_TIME":
            evidence.push(
                `${risk.mergedPrCount} merged pull requests were analyzed`
            );

            evidence.push(
                `Median pull request cycle time is ${risk.medianCycleTimeHours} hours`
            );
            break;

        default:
            break;
    }

    return {
        ...risk,
        evidence
    };
};

const normalizeRisk = (risk) => {
    return addRiskEvidence(
        addRiskIdentity(risk)
    );
};

const analyzeOverdueTasks = (tasks, now) => {
    const risks = [];

    for (const task of tasks) {
        if (
            !task.dueDate ||
            task.status === "completed"
        ) {
            continue;
        }

        const dueDate = new Date(task.dueDate);

        if (dueDate >= now) {
            continue;
        }

        const daysOverdue = Math.max(
            1,
            getDaysDifference(dueDate, now)
        );

        risks.push({
            type: "TASK_OVERDUE",
            severity: "HIGH",
            taskId: task._id,
            daysOverdue,
            message: `Task is ${daysOverdue} day${
                daysOverdue === 1 ? "" : "s"
            } overdue`
        });
    }

    return risks;
};

const analyzeStagnantTasks = (tasks, now) => {
    const risks = [];

    for (const task of tasks) {
        if (
            task.status === "completed" ||
            !task.lastActivityAt
        ) {
            continue;
        }

        const lastActivityAt = new Date(
            task.lastActivityAt
        );

        const inactiveDays = getDaysDifference(
            lastActivityAt,
            now
        );

        if (inactiveDays < STAGNANT_DAYS) {
            continue;
        }

        risks.push({
            type: "TASK_STAGNANT",
            severity: getSeverityForStagnantTask(task),
            taskId: task._id,
            inactiveDays,
            message: `Task has had no activity for ${inactiveDays} days`
        });
    }

    return risks;
};

const analyzeBlockedTasks = (tasks) => {
    const risks = [];

    for (const task of tasks) {
        if (task.status !== "blocked") {
            continue;
        }

        risks.push({
            type: "TASK_BLOCKED",
            severity: getSeverityForBlockedTask(task),
            taskId: task._id,
            message: "Task is currently blocked"
        });
    }

    return risks;
};

const analyzeDependencyBottlenecks = (
    tasks,
    dependencies
) => {
    const risks = [];

    const unfinishedTaskIds = new Set(
        tasks
            .filter((task) =>
                UNFINISHED_STATUSES.includes(
                    task.status
                )
            )
            .map((task) =>
                task._id.toString()
            )
    );

    const downstreamCounts = new Map();

    for (const dependency of dependencies) {
        const fromTaskId =
            dependency.fromTask.toString();

        const toTaskId =
            dependency.toTask.toString();

        if (
            !unfinishedTaskIds.has(fromTaskId) ||
            !unfinishedTaskIds.has(toTaskId)
        ) {
            continue;
        }

        const currentCount =
            downstreamCounts.get(fromTaskId) || 0;

        downstreamCounts.set(
            fromTaskId,
            currentCount + 1
        );
    }

    for (
        const [
            taskId,
            downstreamCount
        ] of downstreamCounts
    ) {
        if (
            downstreamCount <
            BOTTLENECK_THRESHOLD
        ) {
            continue;
        }

        risks.push({
            type: "DEPENDENCY_BOTTLENECK",
            severity: "HIGH",
            taskId,
            downstreamCount,
            message: `Task is blocking ${downstreamCount} unfinished tasks`
        });
    }

    return risks;
};

const analyzeMilestoneRisks = (
    tasks,
    milestones,
    now
) => {
    const risks = [];

    for (const milestone of milestones) {
        if (
            milestone.status === "completed" ||
            !milestone.dueDate
        ) {
            continue;
        }

        const dueDate = new Date(
            milestone.dueDate
        );

        const daysUntilDue =
            getDaysDifference(
                now,
                dueDate
            );

        if (
            daysUntilDue >
            MILESTONE_WARNING_DAYS
        ) {
            continue;
        }

        const unfinishedTasks =
            tasks.filter(
                (task) =>
                    task.milestone &&
                    task.milestone.toString() ===
                        milestone._id.toString() &&
                    task.status !==
                        "completed"
            );

        if (
            unfinishedTasks.length === 0
        ) {
            continue;
        }

        risks.push({
            type: "MILESTONE_RISK",
            severity: "HIGH",
            milestoneId: milestone._id,
            daysUntilDue,
            unfinishedTaskCount:
                unfinishedTasks.length,
            message: `Milestone is due in ${Math.max(
                0,
                daysUntilDue
            )} days with ${
                unfinishedTasks.length
            } unfinished task${
                unfinishedTasks.length === 1
                    ? ""
                    : "s"
            }`
        });
    }

    return risks;
};

const analyzeWorkloadImbalance = (
    tasks
) => {
    const workload = new Map();

    for (const task of tasks) {
        if (
            !ACTIVE_STATUSES.includes(
                task.status
            ) ||
            !task.assignee
        ) {
            continue;
        }

        const userId =
            task.assignee.toString();

        workload.set(
            userId,
            (workload.get(userId) || 0) + 1
        );
    }

    if (workload.size < 2) {
        return [];
    }

    const workloads = Array.from(
        workload.values()
    );

    const sortedWorkloads =
        [...workloads].sort(
            (a, b) => a - b
        );

    const middle =
        Math.floor(
            sortedWorkloads.length / 2
        );

    const median =
        sortedWorkloads.length % 2 === 0
            ? (
                sortedWorkloads[
                    middle - 1
                ] +
                sortedWorkloads[middle]
            ) / 2
            : sortedWorkloads[middle];

    const risks = [];

    for (
        const [
            userId,
            activeTasks
        ] of workload
    ) {
        if (
            activeTasks < 3 ||
            activeTasks < 2 * median
        ) {
            continue;
        }

        risks.push({
            type: "WORKLOAD_IMBALANCE",
            severity: "MEDIUM",
            userId,
            activeTasks,
            medianWorkload: median,
            message: `Contributor has ${activeTasks} active tasks compared with a median workload of ${median}`
        });
    }

    return risks;
};

const analyzeProject = ({
    project,
    tasks = [],
    dependencies = [],
    milestones = [],
    githubSignals = [],
    now = new Date()
}) => {
    if (!project) {
        throw new Error(
            "Project data is required"
        );
    }

    const risks = [
        ...analyzeOverdueTasks(
            tasks,
            now
        ),

        ...analyzeStagnantTasks(
            tasks,
            now
        ),

        ...analyzeBlockedTasks(
            tasks
        ),

        ...analyzeDependencyBottlenecks(
            tasks,
            dependencies
        ),

        ...analyzeMilestoneRisks(
            tasks,
            milestones,
            now
        ),

        ...analyzeWorkloadImbalance(
            tasks
        ),

        ...analyzeGithubProject({
            githubSignals,
            now
        })
    ];

    return risks.map(normalizeRisk);
};

module.exports = {
    analyzeProject
};