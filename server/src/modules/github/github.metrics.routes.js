const express = require("express");

const requireAuth =
    require("../../middleware/auth.middleware");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const {
    validateGithubMetricsQuery
} = require("./github.metrics.validation");

const {
    getGithubMetrics
} = require("./github.metrics.controller");

const router = express.Router();

router.get(
    "/:projectId/github/metrics",
    requireAuth,
    validateObjectId("projectId"),
    validateGithubMetricsQuery,
    getGithubMetrics
);

module.exports = router;