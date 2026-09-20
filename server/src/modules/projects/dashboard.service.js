const User = require("../users/user.model");

const { loadProjectRiskData } = require("../risks/risk.service");
const { analyzeProject } = require("../risks/risk.engine");
const { aggregateProjectHealth } = require("../risks/health.aggregator");
const { buildDashboardData } = require("./dashboard.aggregator");

const getProjectDashboard = async (
    projectId,
    userId,
    now = new Date()
) => {
    const totalStart = performance.now();

    const loadStart = performance.now();

    const {
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals
    } = await loadProjectRiskData(
        projectId,
        userId
    );

    const loadEnd = performance.now();

    const riskStart = performance.now();

    const risks = analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        now
    });

    const riskEnd = performance.now();

    const healthStart = performance.now();

    const health = aggregateProjectHealth({
        tasks,
        risks,
        now
    });

    const healthEnd = performance.now();

    const assigneeIds = [
        ...new Set(
            tasks
                .filter((task) => task.assignee)
                .map((task) =>
                    task.assignee.toString()
                )
        )
    ];

    const usersStart = performance.now();

    const users = await User.find({
        _id: {
            $in: assigneeIds
        }
    })
        .select("_id name")
        .lean();

    const usersEnd = performance.now();

    const dashboardStart = performance.now();

    const dashboard = buildDashboardData({
        project,
        health,
        tasks,
        milestones,
        risks,
        users
    });

    const dashboardEnd = performance.now();

    const totalEnd = performance.now();

    console.log(
        `[Dashboard Performance] project=${projectId}`,
        {
            loadRiskDataMs: Number(
                (loadEnd - loadStart).toFixed(2)
            ),
            riskAnalysisMs: Number(
                (riskEnd - riskStart).toFixed(2)
            ),
            healthAggregationMs: Number(
                (healthEnd - healthStart).toFixed(2)
            ),
            usersQueryMs: Number(
                (usersEnd - usersStart).toFixed(2)
            ),
            dashboardBuildMs: Number(
                (dashboardEnd - dashboardStart).toFixed(2)
            ),
            totalMs: Number(
                (totalEnd - totalStart).toFixed(2)
            ),
            counts: {
                tasks: tasks.length,
                dependencies: dependencies.length,
                milestones: milestones.length,
                githubSignals: githubSignals.length,
                risks: risks.length,
                users: users.length
            }
        }
    );

    return dashboard;
};

module.exports = {
    getProjectDashboard
};

module.exports = {
    getProjectDashboard
};