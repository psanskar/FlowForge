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
        milestones
    } = await loadProjectRiskData(
        projectId,
        userId
    );

    const risks = analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
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