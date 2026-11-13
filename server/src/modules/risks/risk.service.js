const mongoose = require("mongoose");

const Task = require("../tasks/task.model");
const Dependency = require("../dependencies/dependency.model");
const Milestone = require("../milestones/milestone.model");
const GithubSignal = require(
    "../github/github.signal.model"
);
const { getProjectForMember } = require("../projects/project.access");

const { analyzeProject } = require("./risk.engine");

const createError = (statusCode, code, message) => {
    const error = new Error(message);

    error.statusCode = statusCode;
    error.code = code;

    return error;
};

const validateProjectId = (projectId) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }
};

const loadProjectRiskData = async (projectId, userId) => {
    if (!mongoose.isValidObjectId(projectId)) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }

    const project = await getProjectForMember(projectId, userId);

    const [
        tasks,
        dependencies,
        milestones,
        githubSignals
    ] = await Promise.all([
        Task.find({
            project: projectId
        }).lean(),

        Dependency.find({
            project: projectId
        }).lean(),

        Milestone.find({
            project: projectId
        }).lean(),

        GithubSignal.find({
            project: projectId
        }).lean()
    ]);

    return {
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals
    };
};

const getProjectRisks = async (
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

    return analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        now
    });
};

module.exports = {
    loadProjectRiskData,
    getProjectRisks
};
