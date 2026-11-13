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
    projectController.addProjectMember
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
