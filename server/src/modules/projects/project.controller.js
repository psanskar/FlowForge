const projectService = require("./project.service");
const membershipService = require("./project.membership.service");

const createProject = async (req, res, next) => {
    try {
        const project = await projectService.createProject({
            ...req.body,
            userId: req.user.id
        });

        res.status(201).json({
            success: true,
            data: {
                project
            }
        });
    } catch (error) {
        next(error);
    }
};

const listProjects = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const result = await projectService.listProjects(
            req.user.id,
            {
                page,
                limit
            }
        );

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getProject = async (req, res, next) => {
    try {
        const project = await projectService.getProjectById(
            req.params.projectId,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: {
                project
            }
        });
    } catch (error) {
        next(error);
    }
};

const archiveProject = async (req, res, next) => {
    try {
        const project = await projectService.archiveProject(
            req.params.projectId,
            req.user.id
        );

        res.status(200).json({ success: true, data: { project } });
    } catch (error) {
        next(error);
    }
};

const restoreProject = async (req, res, next) => {
    try {
        const project = await projectService.restoreProject(
            req.params.projectId,
            req.user.id
        );

        res.status(200).json({ success: true, data: { project } });
    } catch (error) {
        next(error);
    }
};

const createProjectInvitation = async (req, res, next) => {
    try {
        const result = await membershipService.createProjectInvitation({
            projectId: req.params.projectId,
            userId: req.user.id,
            email: req.body.email
        });

        res.status(201).json({
            success: true,
            data: {
                invitation: result.invitation,
                invitee: result.user,
                projectId: result.projectId
            }
        });
    } catch (error) {
        next(error);
    }
};

const listIncomingInvitations = async (req, res, next) => {
    try {
        const invitations = await membershipService.listIncomingInvitations(req.user.id);
        res.status(200).json({ success: true, data: { invitations } });
    } catch (error) { next(error); }
};

const listProjectInvitations = async (req, res, next) => {
    try {
        const invitations = await membershipService.listProjectInvitations({
            projectId: req.params.projectId,
            userId: req.user.id
        });
        res.status(200).json({ success: true, data: { invitations } });
    } catch (error) { next(error); }
};

const acceptProjectInvitation = async (req, res, next) => {
    try {
        const result = await membershipService.respondToInvitation({
            invitationId: req.params.invitationId,
            userId: req.user.id,
            accept: true
        });
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
};

const declineProjectInvitation = async (req, res, next) => {
    try {
        const result = await membershipService.respondToInvitation({
            invitationId: req.params.invitationId,
            userId: req.user.id,
            accept: false
        });
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
};

const cancelProjectInvitation = async (req, res, next) => {
    try {
        const result = await membershipService.cancelProjectInvitation({
            projectId: req.params.projectId,
            invitationId: req.params.invitationId,
            userId: req.user.id
        });
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
};

const removeProjectMember = async (req, res, next) => {
    try {
        const result = await membershipService.removeProjectMember({
            projectId: req.params.projectId,
            userId: req.user.id,
            memberId: req.params.memberId
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

const leaveProject = async (req, res, next) => {
    try {
        const result = await membershipService.leaveProject({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

const transferProjectOwnership = async (req, res, next) => {
    try {
        const project = await membershipService.transferProjectOwnership({
            projectId: req.params.projectId,
            userId: req.user.id,
            newOwnerId: req.body.newOwnerId
        });

        res.status(200).json({
            success: true,
            data: {
                projectId: project._id,
                owner: project.owner
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProject,
    listProjects,
    getProject,
    archiveProject,
    restoreProject,
    createProjectInvitation,
    listIncomingInvitations,
    listProjectInvitations,
    acceptProjectInvitation,
    declineProjectInvitation,
    cancelProjectInvitation,
    removeProjectMember,
    leaveProject,
    transferProjectOwnership
};
