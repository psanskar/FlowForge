const Project = require("./project.model");

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
                user: userId,
                role: "owner"
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

    const filter = {
        "members.user": userId
    };

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .select(
                "_id name description owner members status startDate targetDate createdAt updatedAt"
            )
            .sort({
                updatedAt: -1
            })
            .skip(skip)
            .limit(limit),

        Project.countDocuments(filter)
    ]);

    return {
        projects,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1
        }
    };
};

const getProjectById = async (projectId, userId) => {
    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    }).select(
        "_id name description owner members status startDate targetDate createdAt updatedAt"
    );

    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    return project;
};

module.exports = {
    createProject,
    listProjects,
    getProjectById
};