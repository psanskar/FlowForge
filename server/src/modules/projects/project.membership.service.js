const mongoose = require("mongoose");

const Project = require("./project.model");
const User = require("../users/user.model");
const Task = require("../tasks/task.model");
const ProjectInvitation = require("./projectInvitation.model");
const {
    getProjectForMember,
    assertProjectOwner,
    assertProjectWritable
} = require("./project.access");
const { withProjectMutationLock } = require("./project.mutationLock");
const { removeProjectRoomForUser } = require("../../realtime/socket");
const { emitToProject } = require("../../realtime/events");

const createError = (statusCode, code, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

const getProjectForOwner = async (projectId, userId, session) => {
    const project = await getProjectForMember(
        projectId,
        userId,
        { select: "_id owner members status", session }
    );
    assertProjectOwner(project, userId);
    assertProjectWritable(project);
    return project;
};

const hasMember = (project, memberId) => project.members.some(
    (member) => member.user.toString() === memberId.toString()
);

const removeMemberFromProject = async (
    projectId,
    memberId,
    { ownerId } = {}
) => {
    const unassignedTasks = await withProjectMutationLock(
        projectId,
        async ({ session }) => {
            const currentProject = await getProjectForMember(
                projectId,
                ownerId || memberId,
                {
                    select: "_id owner members status",
                    session
                }
            );
            assertProjectWritable(currentProject);
            if (ownerId) {
                assertProjectOwner(currentProject, ownerId);
            }

            const result = await Project.updateOne(
                {
                    _id: projectId,
                    owner: ownerId || { $ne: memberId },
                    "members.user": memberId
                },
                {
                    $pull: {
                        members: { user: memberId }
                    }
                },
                session ? { session } : {}
            );

            if (result.modifiedCount !== 1) {
                throw createError(
                    409,
                    "PROJECT_MEMBERSHIP_CHANGED",
                    "Project membership changed. Please retry."
                );
            }

            // Prevent a pending request from re-adding someone after their
            // membership ends.
            await ProjectInvitation.updateMany(
                { project: projectId, invitee: memberId, status: "pending" },
                { $set: { status: "cancelled", respondedAt: new Date() } },
                session ? { session } : {}
            );

            // Preserve completed assignment history; only active work returns
            // to the unassigned pool when someone leaves the project.
            let taskQuery = Task.find({
                project: projectId,
                assignee: memberId,
                status: { $ne: "completed" }
            }).lean();
            if (session) {
                taskQuery = taskQuery.session(session);
            }
            const tasks = await taskQuery;

            if (tasks.length > 0) {
                const updateResult = await Task.updateMany(
                    {
                        project: projectId,
                        assignee: memberId,
                        status: { $ne: "completed" }
                    },
                    {
                        $set: { assignee: null },
                        $inc: { version: 1 }
                    },
                    session
                        ? { session, runValidators: true }
                        : { runValidators: true }
                );

                let updatedTasksQuery = Task.find({
                    _id: { $in: tasks.map((task) => task._id) }
                }).lean();
                if (session) {
                    updatedTasksQuery = updatedTasksQuery.session(session);
                }

                return {
                    tasks: await updatedTasksQuery,
                    count: updateResult.modifiedCount
                };
            }

            return { tasks: [], count: 0 };
        }
    );

    await removeProjectRoomForUser(projectId, memberId);

    for (const task of unassignedTasks.tasks) {
        emitToProject(projectId, "task.updated", { task });
    }

    return unassignedTasks.count;
};

const createProjectInvitation = async ({ projectId, userId, email }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const member = await User.findOne({ email: normalizedEmail })
        .select("_id name email")
        .lean();

    if (!member) {
        throw createError(
            404,
            "USER_NOT_FOUND",
            "No FlowForge account was found for that email"
        );
    }

    if (member._id.toString() === userId.toString()) {
        throw createError(409, "CANNOT_INVITE_SELF", "You already own this project");
    }

    return withProjectMutationLock(
        projectId,
        async ({ session }) => {
            const project = await getProjectForOwner(projectId, userId, session);
            if (hasMember(project, member._id)) {
                throw createError(
                    409,
                    "PROJECT_MEMBER_EXISTS",
                    "This user is already a project member"
                );
            }

            const existingInvitation = await ProjectInvitation.findOne({
                project: projectId,
                invitee: member._id,
                status: "pending"
            }).session(session || null);
            if (existingInvitation) {
                throw createError(409, "INVITATION_ALREADY_PENDING", "An invitation is already pending for this account");
            }

            const [invitation] = await ProjectInvitation.create([{
                project: projectId,
                inviter: userId,
                invitee: member._id,
                status: "pending"
            }], session ? { session } : {});
            return { invitation, user: member, projectId };
        }
    );
};

const listIncomingInvitations = async (userId) => ProjectInvitation.find({
    invitee: userId,
    status: "pending"
}).sort({ createdAt: -1 })
    .populate("project", "_id name status")
    .populate("inviter", "_id name email")
    .lean();

const listProjectInvitations = async ({ projectId, userId }) => {
    await getProjectForOwner(projectId, userId);
    return ProjectInvitation.find({ project: projectId, status: "pending" })
        .sort({ createdAt: -1 })
        .populate("invitee", "_id name email")
        .lean();
};

const respondToInvitation = async ({ invitationId, userId, accept }) => {
    const invitation = await ProjectInvitation.findOne({
        _id: invitationId,
        invitee: userId,
        status: "pending"
    }).lean();
    if (!invitation) {
        throw createError(404, "INVITATION_NOT_FOUND", "Pending project invitation not found");
    }

    return withProjectMutationLock(invitation.project, async ({ session }) => {
        const currentInvitationQuery = ProjectInvitation.findOne({
            _id: invitationId,
            invitee: userId,
            status: "pending"
        });
        const currentInvitation = await currentInvitationQuery.session(session || null);
        if (!currentInvitation) {
            throw createError(409, "INVITATION_ALREADY_RESOLVED", "This invitation has already been answered");
        }

        if (accept) {
            const project = await Project.findById(invitation.project).select("_id members status").session(session || null);
            if (!project || project.status === "archived") {
                throw createError(409, "PROJECT_UNAVAILABLE", "This project is no longer accepting members");
            }
            if (!hasMember(project, userId)) {
                await Project.updateOne(
                    { _id: invitation.project, "members.user": { $ne: userId } },
                    { $push: { members: { user: userId } } },
                    session ? { session, runValidators: true } : { runValidators: true }
                );
            }
        }

        currentInvitation.status = accept ? "accepted" : "declined";
        currentInvitation.respondedAt = new Date();
        await currentInvitation.save(session ? { session } : {});

        return { invitationId, projectId: invitation.project, status: currentInvitation.status };
    });
};

const cancelProjectInvitation = async ({ projectId, invitationId, userId }) => {
    return withProjectMutationLock(projectId, async ({ session }) => {
        await getProjectForOwner(projectId, userId, session);
        const result = await ProjectInvitation.updateOne(
            { _id: invitationId, project: projectId, status: "pending" },
            { $set: { status: "cancelled", respondedAt: new Date() } },
            session ? { session } : {}
        );
        if (!result.modifiedCount) {
            throw createError(404, "INVITATION_NOT_FOUND", "Pending project invitation not found");
        }
        return { invitationId, status: "cancelled" };
    });
};

const removeProjectMember = async ({ projectId, userId, memberId }) => {
    const project = await getProjectForOwner(projectId, userId);

    if (project.owner.toString() === memberId.toString()) {
        throw createError(
            409,
            "OWNERSHIP_TRANSFER_REQUIRED",
            "Transfer project ownership before leaving or removing the owner"
        );
    }

    if (!hasMember(project, memberId)) {
        throw createError(
            404,
            "PROJECT_MEMBER_NOT_FOUND",
            "Project member not found"
        );
    }

    const unassignedTaskCount = await removeMemberFromProject(
        projectId,
        memberId,
        { ownerId: userId }
    );

    return { projectId, userId: memberId, unassignedTaskCount };
};

const leaveProject = async ({ projectId, userId }) => {
    const project = await getProjectForMember(
        projectId,
        userId,
        { select: "_id owner members status" }
    );
    assertProjectWritable(project);

    if (project.owner.toString() === userId.toString()) {
        throw createError(
            409,
            "OWNERSHIP_TRANSFER_REQUIRED",
            "Transfer project ownership before leaving the project"
        );
    }

    if (!hasMember(project, userId)) {
        throw createError(
            404,
            "PROJECT_MEMBER_NOT_FOUND",
            "Project member not found"
        );
    }

    const unassignedTaskCount = await removeMemberFromProject(
        projectId,
        userId
    );

    return { projectId, userId, unassignedTaskCount };
};

const transferProjectOwnership = async ({
    projectId,
    userId,
    newOwnerId
}) => {
    if (!mongoose.isValidObjectId(newOwnerId)) {
        throw createError(
            422,
            "INVALID_NEW_OWNER",
            "The new owner must be a project member"
        );
    }

    const updatedProject = await withProjectMutationLock(
        projectId,
        async ({ session }) => {
            const project = await getProjectForOwner(projectId, userId, session);

            if (project.owner.toString() === newOwnerId.toString()) {
                throw createError(
                    409,
                    "ALREADY_PROJECT_OWNER",
                    "This user already owns the project"
                );
            }

            if (!hasMember(project, newOwnerId)) {
                throw createError(
                    422,
                    "NEW_OWNER_MUST_BE_MEMBER",
                    "The new owner must already be a project member"
                );
            }

            let query = Project.findOneAndUpdate(
                {
                    _id: projectId,
                    owner: userId,
                    "members.user": newOwnerId
                },
                {
                    $set: { owner: newOwnerId }
                },
                {
                    returnDocument: "after",
                    runValidators: true
                }
            );
            if (session) {
                query = query.session(session);
            }
            const result = await query.select("_id owner members");

            if (!result) {
                throw createError(
                    409,
                    "PROJECT_OWNERSHIP_CHANGED",
                    "Project ownership or membership changed. Please retry."
                );
            }

            return result;
        }
    );

    return updatedProject;
};

module.exports = {
    createProjectInvitation,
    listIncomingInvitations,
    listProjectInvitations,
    respondToInvitation,
    cancelProjectInvitation,
    removeProjectMember,
    leaveProject,
    transferProjectOwnership
};
