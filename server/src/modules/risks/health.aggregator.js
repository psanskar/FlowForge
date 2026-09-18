const HIGH_RISK_DEDUCTION = 15;
const MEDIUM_RISK_DEDUCTION = 7;
const MAX_TASK_RISK_DEDUCTION = 25;

const getHealthStatus = (score) => {
    if (score >= 90) {
        return "HEALTHY";
    }

    if (score >= 70) {
        return "ON_TRACK";
    }

    if (score >= 50) {
        return "AT_RISK";
    }

    return "CRITICAL";
};

const getRiskDeduction = (risk) => {
    if (risk.severity === "HIGH") {
        return HIGH_RISK_DEDUCTION;
    }

    if (risk.severity === "MEDIUM") {
        return MEDIUM_RISK_DEDUCTION;
    }

    return 0;
};

const calculateRiskDeductions = (risks) => {
    const deductionsByTask = new Map();
    let globalDeduction = 0;

    for (const risk of risks) {
        const deduction = getRiskDeduction(risk);

        if (deduction === 0) {
            continue;
        }

        /*
         * Task-related risks are capped so that one problematic
         * task cannot disproportionately destroy the project score.
         */
        if (risk.taskId) {
            const taskId = risk.taskId.toString();

            const currentDeduction =
                deductionsByTask.get(taskId) || 0;

            const remainingAllowance =
                Math.max(
                    0,
                    MAX_TASK_RISK_DEDUCTION -
                        currentDeduction
                );

            const appliedDeduction = Math.min(
                deduction,
                remainingAllowance
            );

            deductionsByTask.set(
                taskId,
                currentDeduction + appliedDeduction
            );

            globalDeduction += appliedDeduction;

            continue;
        }

        /*
         * Risks without a taskId, such as workload and milestone
         * risks, contribute directly to the project deduction.
         */
        globalDeduction += deduction;
    }

    return globalDeduction;
};

const calculateTaskSummary = (tasks, now) => {
    const summary = {
        totalTasks: tasks.length,
        completedTasks: 0,
        overdueTasks: 0,
        blockedTasks: 0,
        stagnantTasks: 0,
        workloadRisks: 0
    };

    for (const task of tasks) {
        if (task.status === "completed") {
            summary.completedTasks++;
        }

        if (
            task.dueDate &&
            task.status !== "completed" &&
            new Date(task.dueDate) < now
        ) {
            summary.overdueTasks++;
        }

        if (task.status === "blocked") {
            summary.blockedTasks++;
        }
    }

    return summary;
};

const calculateSummaryFromRisks = (summary, risks) => {
    for (const risk of risks) {
        if (risk.type === "TASK_STAGNANT") {
            summary.stagnantTasks++;
        }

        if (risk.type === "WORKLOAD_IMBALANCE") {
            summary.workloadRisks++;
        }
    }

    return summary;
};

const aggregateProjectHealth = ({
    tasks = [],
    risks = [],
    now = new Date()
}) => {
    const rawDeduction = calculateRiskDeductions(risks);

    const score = Math.max(
        0,
        100 - rawDeduction
    );

    const health = getHealthStatus(score);

    let summary = calculateTaskSummary(tasks, now);

    summary = calculateSummaryFromRisks(
        summary,
        risks
    );

    return {
        score,
        health,
        summary,
        risks
    };
};

module.exports = {
    aggregateProjectHealth
};