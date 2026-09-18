const express = require("express");

const taskController = require("./task.controller");

const {
    validateCreateTask,
    validateTaskListQuery
} = require("./task.validation");

const requireAuth = require("../../middleware/auth.middleware");

const {
    validateObjectId
} = require("../../middleware/validation.middleware");

const router = express.Router();

router.post(
    "/:projectId/tasks",
    requireAuth,
    validateObjectId("projectId"),
    validateCreateTask,
    taskController.createTask
);

router.get(
    "/:projectId/tasks",
    requireAuth,
    validateObjectId("projectId"),
    validateTaskListQuery,
    taskController.listTasks
);

module.exports = router;