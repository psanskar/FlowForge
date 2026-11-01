
const {
    loadProjectRiskData
} = require("./risk.service");

const { analyzeProject } = require("./risk.engine");

const {
    aggregateProjectHealth
} = require("./health.aggregator");

const getProjectHealth = async (
    projectId,
    userId,
    now = new Date()
) => {
    const {
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates,
        githubPullRequestCycleTimes
    } = await loadProjectRiskData(
        projectId,
        userId,
        now
    );

    const risks = analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates,
        githubPullRequestCycleTimes,
        now
    });

    return aggregateProjectHealth({
        tasks,
        risks,
        now
    });
};

module.exports = {
    getProjectHealth
};
