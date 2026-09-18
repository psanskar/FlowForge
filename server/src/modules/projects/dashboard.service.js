const User = require("../users/user.model");

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
    buildDashboardData
} = require("./dashboard.aggregator");

const getProjectDashboard = async (
    projectId,
    userId,
    now = new Date()
) => {
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

    const risks = analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        now
    });

    const health = aggregateProjectHealth({
        tasks,
        risks,
        now
    });

    const assigneeIds = [
        ...new Set(
            tasks
                .filter((task) => task.assignee)
                .map((task) =>
                    task.assignee.toString()
                )
        )
    ];

    const users = await User.find({
        _id: { $in: assigneeIds }
    })
        .select("_id name")
        .lean();

    return buildDashboardData({
        project,
        health,
        tasks,
        milestones,
        risks,
        users
    });
};

module.exports = {
    getProjectDashboard
};