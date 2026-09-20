const express = require("express");

const requireAuth =
    require("../../middleware/auth.middleware");

const {
    validateHealthTrendRequest
} = require("./health.trend.validation");

const {
    getHealthTrendController
} =
    require("./health.trend.controller");

const router = express.Router();

router.get(
    "/:projectId/health/trend",
    requireAuth,
    validateHealthTrendRequest,
    getHealthTrendController
);

module.exports = router;