const Project = require("./project.model");

const buildProjectMembershipFilter = (userId) => ({
    $or: [
        { owner: userId },
        { "members.user": userId }
    ]
});

const buildProjectAccessFilter = (projectId, userId) => ({
    _id: projectId,
    ...buildProjectMembershipFilter(userId)
});

const getProjectForMember = async (
    projectId,
    userId,
    {
        select,
        lean = false,
        session,
        notFoundCode = "PROJECT_NOT_FOUND",
        notFoundMessage = "Project not found"
    } = {}
) => {
    let query = Project.findOne(
        buildProjectAccessFilter(projectId, userId)
    );

    if (select) {
        query = query.select(select);
    }

    if (session) {
        query = query.session(session);
    }

    if (lean) {
        query = query.lean();
    }

    const project = await query;

    if (!project) {
        const error = new Error(notFoundMessage);
        error.statusCode = 404;
        error.code = notFoundCode;
        throw error;
    }

    return project;
};

const assertProjectOwner = (
    project,
    userId,
    {
        code = "PROJECT_OWNER_REQUIRED",
        message = "Only the project owner can perform this action"
    } = {}
) => {
    if (project.owner?.toString() === userId.toString()) {
        return;
    }

    const error = new Error(message);
    error.statusCode = 403;
    error.code = code;
    throw error;
};

const assertProjectWritable = (project) => {
    if (project.status !== "archived") {
        return;
    }

    const error = new Error(
        "Archived projects are read-only. Restore the project before making changes."
    );
    error.statusCode = 409;
    error.code = "PROJECT_ARCHIVED";
    throw error;
};

module.exports = {
    buildProjectAccessFilter,
    buildProjectMembershipFilter,
    getProjectForMember,
    assertProjectOwner,
    assertProjectWritable
};
