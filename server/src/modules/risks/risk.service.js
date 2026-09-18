const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const Task = require("../tasks/task.model");
const Dependency = require("../dependencies/dependency.model");
const Milestone = require("../milestones/milestone.model");

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

const loadProjectRiskData = async (
    projectId,
    userId
) => {
    validateProjectId(projectId);

    const project = await getProjectForMember(
        projectId,
        userId
    );

    const [
        tasks,
        dependencies,
        milestones
    ] = await Promise.all([
        Task.find({
            project: projectId
        }).lean(),

        Dependency.find({
            project: projectId
        }).lean(),

        Milestone.find({
            project: projectId
        }).lean()
    ]);

    return {
        project,
        tasks,
        dependencies,
        milestones
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
        milestones
    } = await loadProjectRiskData(
        projectId,
        userId
    );

    return analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        now
    });
};

module.exports = {
    loadProjectRiskData,
    getProjectRisks
};