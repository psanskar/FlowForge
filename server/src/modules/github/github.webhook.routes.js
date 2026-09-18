const express = require("express");

const {
    githubWebhookRawBody
} = require("./github.webhook.middleware");

const {
    handleGithubWebhook
} = require("./github.webhook.controller");

const router = express.Router();

router.post(
    "/webhook",
    githubWebhookRawBody,
    handleGithubWebhook
);

module.exports = router;