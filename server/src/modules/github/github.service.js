const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const GithubRepository = require("./github.model");
const {
    getRepository
} = require("./github.client");

const createError = (
    statusCode,
    code,
    message
) => {
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

const connectRepository = async (
    projectId,
    userId,
    { owner, repo }
) => {
    validateProjectId(projectId);

    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    })
        .select("_id")
        .lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    const normalizedOwner = owner.trim();
    const normalizedRepo = repo.trim();

    const githubRepository = await getRepository(
        normalizedOwner,
        normalizedRepo
    );

    const connection = await GithubRepository.findOneAndUpdate(
        {
            project: projectId
        },
        {
            project: projectId,
            owner: githubRepository.owner.login,
            repo: githubRepository.name,
            fullName: githubRepository.full_name,
            githubId: githubRepository.id,
            defaultBranch: githubRepository.default_branch,
            private: githubRepository.private
        },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true
        }
    );

    return connection;
};

const getRepositoryConnection = async (
    projectId,
    userId
) => {
    validateProjectId(projectId);

    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    })
        .select("_id")
        .lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    return GithubRepository.findOne({
        project: projectId
    }).lean();
};

module.exports = {
    connectRepository,
    getRepositoryConnection
};