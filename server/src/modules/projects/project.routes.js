const express = require("express");

const projectController = require("./project.controller");
const requireAuth = require("../../middleware/auth.middleware");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const {
    validateCreateProject,
    validateProjectListQuery,
    validateAddProjectMember,
    validateTransferProjectOwnership
} = require("./project.validation");

const router = express.Router();

router.get(
    "/invitations",
    requireAuth,
    projectController.listIncomingInvitations
);

router.post(
    "/invitations/:invitationId/accept",
    requireAuth,
    validateObjectId("invitationId"),
    projectController.acceptProjectInvitation
);

router.post(
    "/invitations/:invitationId/decline",
    requireAuth,
    validateObjectId("invitationId"),
    projectController.declineProjectInvitation
);

router.post(
    "/",
    requireAuth,
    validateCreateProject,
    projectController.createProject
);

router.get(
    "/",
    requireAuth,
    validateProjectListQuery,
    projectController.listProjects
);

router.get(
    "/:projectId",
    requireAuth,
    validateObjectId("projectId"),
    projectController.getProject
);

router.get(
    "/:projectId/invitations",
    requireAuth,
    validateObjectId("projectId"),
    projectController.listProjectInvitations
);

router.delete(
    "/:projectId/invitations/:invitationId",
    requireAuth,
    validateObjectId("projectId"),
    validateObjectId("invitationId"),
    projectController.cancelProjectInvitation
);

router.post(
    "/:projectId/archive",
    requireAuth,
    validateObjectId("projectId"),
    projectController.archiveProject
);

router.post(
    "/:projectId/restore",
    requireAuth,
    validateObjectId("projectId"),
    projectController.restoreProject
);

router.post(
    "/:projectId/members",
    requireAuth,
    validateObjectId("projectId"),
    validateAddProjectMember,
    projectController.createProjectInvitation
);

router.delete(
    "/:projectId/members/me",
    requireAuth,
    validateObjectId("projectId"),
    projectController.leaveProject
);

router.delete(
    "/:projectId/members/:memberId",
    requireAuth,
    validateObjectId("projectId"),
    validateObjectId("memberId"),
    projectController.removeProjectMember
);

router.patch(
    "/:projectId/owner",
    requireAuth,
    validateObjectId("projectId"),
    validateTransferProjectOwnership,
    projectController.transferProjectOwnership
);

module.exports = router;
