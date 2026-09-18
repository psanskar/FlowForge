const express = require("express");

const projectController = require("./project.controller");
const requireAuth = require("../../middleware/auth.middleware");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const {
    validateCreateProject,
    validateProjectListQuery
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

module.exports = router;