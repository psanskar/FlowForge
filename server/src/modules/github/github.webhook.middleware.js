const express = require("express");

const githubWebhookRawBody = express.raw({
    type: "application/json",
    limit: "1mb"
});

module.exports = {
    githubWebhookRawBody
};