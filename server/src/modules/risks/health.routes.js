const express = require("express");

const healthController = require("./health.controller");

const requireAuth = require("../../middleware/auth.middleware");
const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const router = express.Router();

router.get(
    "/:projectId/health",
    requireAuth,
    validateObjectId("projectId"),
    healthController.getProjectHealth
);

module.exports = router;