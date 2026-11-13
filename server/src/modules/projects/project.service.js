const Project = require("./project.model");
const {
    getProjectForMember,
    buildProjectMembershipFilter,
    assertProjectOwner
} = require("./project.access");
const { withProjectMutationLock } = require("./project.mutationLock");

const createError = (statusCode, code, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

const createProject = async ({
    name,
    description,
    startDate,
    targetDate,
    userId
}) => {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
        const error = new Error("Project name cannot be empty");
        error.statusCode = 422;
        error.code = "INVALID_PROJECT_NAME";
        throw error;
    }

    const parsedStartDate = startDate
        ? new Date(startDate)
        : null;

    const parsedTargetDate = targetDate
        ? new Date(targetDate)
        : null;

    if (
        parsedStartDate &&
        Number.isNaN(parsedStartDate.getTime())
    ) {
        const error = new Error("Invalid start date");
        error.statusCode = 422;
        error.code = "INVALID_START_DATE";
        throw error;
    }

    if (
        parsedTargetDate &&
        Number.isNaN(parsedTargetDate.getTime())
    ) {
        const error = new Error("Invalid target date");
        error.statusCode = 422;
        error.code = "INVALID_TARGET_DATE";
        throw error;
    }

    if (
        parsedStartDate &&
        parsedTargetDate &&
        parsedTargetDate < parsedStartDate
    ) {
        const error = new Error(
            "Target date cannot be earlier than start date"
        );

        error.statusCode = 422;
        error.code = "INVALID_PROJECT_DATES";
        throw error;
    }

    const project = await Project.create({
        name: trimmedName,
        description: description?.trim() || "",
        owner: userId,
        members: [
            {
                user: userId
            }
        ],
        status: "planning",
        startDate: parsedStartDate,
        targetDate: parsedTargetDate
    });

    return project;
};

const listProjects = async (userId, { page = 1, limit = 20 } = {}) => {
    const skip = (page - 1) * limit;

    const filter = buildProjectMembershipFilter(userId);

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .select(
                "_id name description owner members status startDate targetDate createdAt updatedAt"
            )
            .sort({
                updatedAt: -1,
                _id: 1
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        Project.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        projects,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    };
};

const getProjectById = async (projectId, userId) => {
    const project = await getProjectForMember(
        projectId,
        userId,
        {
            select: "_id name description owner members status startDate targetDate createdAt updatedAt"
        }
    );

    await project.populate("members.user", "_id name email");

    return project;
};

const archiveProject = async (projectId, userId) => {
    return withProjectMutationLock(projectId, async ({ session }) => {
        const project = await getProjectForMember(
            projectId,
            userId,
            {
                select: "_id owner status statusBeforeArchive",
                session
            }
        );
        assertProjectOwner(project, userId);

        if (project.status === "archived") {
            throw createError(
                409,
                "PROJECT_ALREADY_ARCHIVED",
                "Project is already archived"
            );
        }

        let query = Project.findOneAndUpdate(
            {
                _id: projectId,
                owner: userId,
                status: project.status
            },
            {
                $set: {
                    status: "archived",
                    statusBeforeArchive: project.status
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );
        if (session) {
            query = query.session(session);
        }
        const archivedProject = await query;

        if (!archivedProject) {
            throw createError(
                409,
                "PROJECT_STATUS_CHANGED",
                "Project status changed. Please retry."
            );
        }

        return archivedProject;
    });
};

const restoreProject = async (projectId, userId) => {
    return withProjectMutationLock(projectId, async ({ session }) => {
        const project = await getProjectForMember(
            projectId,
            userId,
            {
                select: "_id owner status statusBeforeArchive",
                session
            }
        );
        assertProjectOwner(project, userId);

        if (project.status !== "archived") {
            throw createError(
                409,
                "PROJECT_NOT_ARCHIVED",
                "Only archived projects can be restored"
            );
        }

        const restoredStatus = project.statusBeforeArchive || "planning";
        let query = Project.findOneAndUpdate(
            {
                _id: projectId,
                owner: userId,
                status: "archived"
            },
            {
                $set: { status: restoredStatus },
                $unset: { statusBeforeArchive: 1 }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );
        if (session) {
            query = query.session(session);
        }
        const restoredProject = await query;

        if (!restoredProject) {
            throw createError(
                409,
                "PROJECT_STATUS_CHANGED",
                "Project status changed. Please retry."
            );
        }

        return restoredProject;
    });
};

module.exports = {
    createProject,
    listProjects,
    getProjectById,
    archiveProject,
    restoreProject
};
