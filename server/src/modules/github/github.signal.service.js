const mongoose = require("mongoose");

const Project = require(
    "../projects/project.model"
);

const GithubRepository = require(
    "./github.model"
);

const GithubSignal = require(
    "./github.signal.model"
);

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

const validateProjectId = (
    projectId
) => {
    if (
        !mongoose.Types.ObjectId.isValid(
            projectId
        )
    ) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }
};

const persistSignal = async (
    projectId,
    signalData
) => {
    validateProjectId(projectId);

    const repository =
        await GithubRepository.findOne({
            project: projectId
        })
            .select("_id project")
            .lean();

    if (!repository) {
        throw createError(
            404,
            "GITHUB_REPOSITORY_NOT_CONNECTED",
            "GitHub repository is not connected to this project"
        );
    }

    if (
        signalData.repository &&
        signalData.repository.toString() !==
            repository._id.toString()
    ) {
        throw createError(
            400,
            "GITHUB_REPOSITORY_MISMATCH",
            "GitHub repository does not belong to this project"
        );
    }

    const normalizedSignal = {
        project: projectId,
        repository:
            repository._id,
        type: signalData.type,
        externalId:
            signalData.externalId,
        occurredAt:
            signalData.occurredAt,
        actor:
            signalData.actor,
        metadata:
            signalData.metadata
    };

    try {
        return await GithubSignal.create(
            normalizedSignal
        );
    } catch (error) {
        if (
            error.code === 11000
        ) {
            const existingSignal =
                await GithubSignal.findOne({
                    repository:
                        repository._id,
                    externalId:
                        signalData.externalId
                });

            if (
                existingSignal
            ) {
                return existingSignal;
            }
        }

        throw error;
    }
};

const createSignal = async (
    projectId,
    userId,
    signalData
) => {
    validateProjectId(projectId);

    const project =
        await Project.findOne({
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

    return persistSignal(
        projectId,
        signalData
    );
};

module.exports = {
    createSignal,
    persistSignal
};