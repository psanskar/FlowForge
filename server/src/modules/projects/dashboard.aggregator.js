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

        case "GITHUB_HIGH_PR_CYCLE_TIME":
            return risk.medianCycleTimeHours || 0;

        default:
            return 0;
    }
};

const getRiskNextAction = (
    risk,
    projectId,
    githubRepository
) => {
    const projectPath = `/app/projects/${projectId}`;
    const taskPath = risk.taskId
        ? `/app/tasks/${risk.taskId}`
        : null;
    const repoName = githubRepository?.fullName;
    const isValidRepoName =
        typeof repoName === "string" &&
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoName);
    const githubUrl = isValidRepoName
        ? `https://github.com/${repoName}`
        : null;

    switch (risk.type) {
        case "TASK_OVERDUE":
            return {
                description: "Agree a recovery date with the assignee, or re-plan the scope and deadline.",
                label: "Open task",
                href: taskPath,
                external: false
            };
        case "TASK_STAGNANT":
            return {
                description: "Check in with the assignee and decide whether to unblock, reassign, or split the work.",
                label: "Inspect task",
                href: taskPath,
                external: false
            };
        case "TASK_BLOCKED":
            return {
                description: "Identify the current blocker and assign someone to resolve or escalate it.",
                label: "Open task",
                href: taskPath,
                external: false
            };
        case "DEPENDENCY_BOTTLENECK":
            return {
                description: "Review the blocking task and its dependent work; split or resequence it if possible.",
                label: "Review dependencies",
                href: taskPath,
                external: false
            };
        case "MILESTONE_RISK":
            return {
                description: "Review unfinished milestone work and owners, then agree a recovery plan or revised date.",
                label: "Review milestone",
                href: `${projectPath}#milestones`,
                external: false
            };
        case "WORKLOAD_IMBALANCE":
            return {
                description: "Review this contributor's active assignments and move or defer lower-priority work.",
                label: "Review assigned tasks",
                href: risk.userId
                    ? `${projectPath}/tasks?assignee=${encodeURIComponent(risk.userId)}`
                    : `${projectPath}/tasks`,
                external: false
            };
        case "GITHUB_AGING_PR":
            return {
                description: "Ask the author and reviewers to agree on the next review step or split the pull request.",
                label: "Open pull request",
                href: githubUrl
                    ? risk.prNumber
                        ? `${githubUrl}/pull/${encodeURIComponent(risk.prNumber)}`
                        : `${githubUrl}/pulls`
                    : null,
                external: Boolean(githubUrl)
            };
        case "GITHUB_ISSUE_BACKLOG":
            return {
                description: "Triage new issues, close duplicates, and assign an owner and priority to actionable work.",
                label: "Triage issues",
                href: githubUrl ? `${githubUrl}/issues` : null,
                external: Boolean(githubUrl)
            };
        case "GITHUB_LOW_MERGE_THROUGHPUT":
            return {
                description: "Review open pull requests for missing reviewers, unresolved checks, or oversized changes.",
                label: "Review open PRs",
                href: githubUrl ? `${githubUrl}/pulls` : null,
                external: Boolean(githubUrl)
            };
        case "GITHUB_HIGH_PR_CYCLE_TIME":
            return {
                description: "Inspect recent pull requests for review delays, large change sets, or release bottlenecks.",
                label: "Inspect pull requests",
                href: githubUrl ? `${githubUrl}/pulls` : null,
                external: Boolean(githubUrl)
            };
        default:
            return null;
    }
};

const getRiskContext = (
    risk,
    taskById,
    milestoneById,
    userById
) => {
    if (risk.taskId) {
        const task = taskById.get(risk.taskId.toString());

        return task
            ? {
                label: "Task",
                title: task.title,
                owner: task.assignee
                    ? userById.get(task.assignee.toString())?.name || "Unknown contributor"
                    : null
            }
            : null;
    }

    if (risk.milestoneId) {
        const milestone = milestoneById.get(risk.milestoneId.toString());

        return milestone
            ? {
                label: "Milestone",
                title: milestone.name,
                owner: null
            }
            : null;
    }

    if (risk.userId) {
        return {
            label: "Contributor",
            title: userById.get(risk.userId.toString())?.name || "Unknown contributor",
            owner: null
        };
    }

    if (risk.title || risk.prNumber || risk.githubPrId) {
        return {
            label: risk.prNumber
                ? `Pull request #${risk.prNumber}`
                : risk.githubPrId
                    ? "GitHub pull request"
                    : "GitHub activity",
            title: risk.title || null,
            owner: null
        };
    }

    return null;
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
    users = [],
    githubRepository = null
}) => {
    const taskById = new Map(
        tasks.map((task) => [task._id.toString(), task])
    );
    const milestoneById = new Map(
        milestones.map((milestone) => [milestone._id.toString(), milestone])
    );
    const userById = new Map(
        users.map((user) => [user._id.toString(), user])
    );
    const topRisks = getTopRisks(risks).map((risk) => ({
        ...risk,
        context: getRiskContext(
            risk,
            taskById,
            milestoneById,
            userById
        ),
        nextAction: getRiskNextAction(
            risk,
            project._id,
            githubRepository
        )
    }));

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

        topRisks,

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
