const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const Task = require("../tasks/task.model");
const Dependency = require("../dependencies/dependency.model");
const Milestone = require("../milestones/milestone.model");
const GithubSignal = require(
    "../github/github.signal.model"
);

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

const getProjectForMember = async (
    projectId,
    userId
) => {
    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    }).lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    return project;
};

const loadProjectRiskData = async (projectId, userId) => {
    if (!mongoose.isValidObjectId(projectId)) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }

    const project = await Project.findById(projectId);

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    const isMember = project.members.some(
        (member) =>
            member.user.toString() ===
            userId.toString()
    );

    if (!isMember) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

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