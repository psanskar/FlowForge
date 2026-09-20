const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const ProjectRiskHistory = require(
    "./project.risk.history.model"
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

const validateProjectId = (projectId) => {
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

const getProjectForMember = async (
    projectId,
    userId
) => {
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

    return project;
};

const getRiskHistory = async ({
    projectId,
    userId,
    status,
    severity,
    page = 1,
    limit = 20
}) => {
    validateProjectId(projectId);

    await getProjectForMember(
        projectId,
        userId
    );

    const filter = {
        project: projectId
    };

    if (status) {
        filter.status = status;
    }

    if (severity) {
        filter.currentSeverity = severity;
    }

    const skip = (page - 1) * limit;

    const [
        histories,
        total
    ] = await Promise.all([
        ProjectRiskHistory.find(filter)
            .sort({
                lastDetectedAt: -1,
                _id: -1
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        ProjectRiskHistory.countDocuments(
            filter
        )
    ]);

    const totalPages =
        Math.ceil(total / limit);

    return {
        histories,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage:
                page < totalPages,
            hasPreviousPage:
                page > 1
        }
    };
};

module.exports = {
    getRiskHistory
};
