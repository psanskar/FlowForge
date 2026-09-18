const express = require("express");

const dependencyController = require("./dependency.controller");
const {
    validateCreateDependency
} = require("./dependency.validation");

const requireAuth = require("../../middleware/auth.middleware");
const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const router = express.Router();

// GET /api/v1/projects/:projectId/dependencies
router.get(
    "/:projectId/dependencies",
    requireAuth,
    validateObjectId("projectId"),
    dependencyController.listDependencies
);

// POST /api/v1/projects/:projectId/dependencies
router.post(
    "/:projectId/dependencies",
    requireAuth,
    validateObjectId("projectId"),
    validateCreateDependency,
    dependencyController.createDependency
);

// DELETE /api/v1/projects/:projectId/dependencies/:dependencyId
router.delete(
    "/:projectId/dependencies/:dependencyId",
    requireAuth,
    validateObjectId("projectId"),
    validateObjectId("dependencyId"),
    dependencyController.deleteDependency
);

module.exports = router;