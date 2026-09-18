const express = require("express");

const taskController = require("./task.controller");

const requireAuth = require("../../middleware/auth.middleware");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const {
    validateUpdateTask
} = require("./task.validation");

const router = express.Router();

router.get(
    "/:taskId",
    requireAuth,
    validateObjectId("taskId"),
    taskController.getTask
);

router.patch(
    "/:taskId",
    requireAuth,
    validateObjectId("taskId"),
    validateUpdateTask,
    taskController.updateTask
);

router.delete(
    "/:taskId",
    requireAuth,
    validateObjectId("taskId"),
    taskController.deleteTask
);

module.exports = router;