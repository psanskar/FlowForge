const express = require("express");

const dashboardController = require(
    "./dashboard.controller"
);

const requireAuth = require(
    "../../middleware/auth.middleware"
);

const {
    validateObjectId
} = require(
    "../../middleware/validation.middleware"
);

const router = express.Router();

router.get(
    "/:projectId/dashboard",
    requireAuth,
    validateObjectId("projectId"),
    dashboardController.getProjectDashboard
);

module.exports = router;