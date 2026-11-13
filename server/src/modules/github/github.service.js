const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const { buildProjectAccessFilter } = require("../projects/project.access");
const { assertProjectWritable } = require("../projects/project.access");
const { withProjectMutationLock } = require("../projects/project.mutationLock");
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

    const project = await Project.findOne(
        buildProjectAccessFilter(projectId, userId)
    )
        .select("_id status")
        .lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }
    assertProjectWritable(project);

    const normalizedOwner = owner.trim();
    const normalizedRepo = repo.trim();

    const githubRepository = await getRepository(
        normalizedOwner,
        normalizedRepo
    );

    return withProjectMutationLock(projectId, async ({ session }) => {
        let currentProjectQuery = Project.findOne(
            buildProjectAccessFilter(projectId, userId)
        ).select("_id status");
        if (session) {
            currentProjectQuery = currentProjectQuery.session(session);
        }
        const currentProject = await currentProjectQuery;

        if (!currentProject) {
            throw createError(404, "PROJECT_NOT_FOUND", "Project not found");
        }
        assertProjectWritable(currentProject);

        let connectionQuery = GithubRepository.findOneAndUpdate(
            { project: projectId },
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
                runValidators: true,
                ...(session ? { session } : {})
            }
        );
        return connectionQuery;
    });
};

const getRepositoryConnection = async (
    projectId,
    userId
) => {
    validateProjectId(projectId);

    const project = await Project.findOne(
        buildProjectAccessFilter(projectId, userId)
    )
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
