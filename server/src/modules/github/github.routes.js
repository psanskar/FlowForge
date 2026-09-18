const express = require("express");

const githubController = require("./github.controller");
const requireAuth = require("../../middleware/auth.middleware");

const {
    githubWebhookRawBody
} = require("./github.webhook.middleware");

const {
    handleGithubWebhook
} = require("./github.webhook.controller");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const {
    validateGithubRepository
} = require("./github.validation");

const router = express.Router();

router.post(
    "/:projectId/github",
    requireAuth,
    validateObjectId("projectId"),
    validateGithubRepository,
    githubController.connectRepository
);

router.get(
    "/:projectId/github",
    requireAuth,
    validateObjectId("projectId"),
    githubController.getRepositoryConnection
);

router.post(
    "/webhook",
    githubWebhookRawBody,
    handleGithubWebhook
);

module.exports = router;