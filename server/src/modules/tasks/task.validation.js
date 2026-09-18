const mongoose = require("mongoose");

const VALID_STATUSES = [
    "todo",
    "in_progress",
    "blocked",
    "completed"
];

const VALID_PRIORITIES = [
    "low",
    "medium",
    "high",
    "critical"
];

const VALID_SORTS = [
    "dueDate",
    "createdAt",
    "updatedAt"
];

const validateCreateTask = (req, res, next) => {
    const {
        title,
        description,
        status,
        priority,
        assignee,
        milestone,
        dueDate,
        progress
    } = req.body;

    const errors = {};

    // Title
    if (
        typeof title !== "string" ||
        title.trim().length === 0
    ) {
        errors.title = "Task title is required";
    }

    // Description
    if (
        description !== undefined &&
        typeof description !== "string"
    ) {
        errors.description = "Description must be a string";
    }

    // Status
    if (
        status !== undefined &&
        !VALID_STATUSES.includes(status)
    ) {
        errors.status = `Status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    // Priority
    if (
        priority !== undefined &&
        !VALID_PRIORITIES.includes(priority)
    ) {
        errors.priority = `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
    }

    // Assignee
    if (
        assignee !== undefined &&
        assignee !== null &&
        !mongoose.isValidObjectId(assignee)
    ) {
        errors.assignee = "Assignee must be a valid user ID";
    }

    // Milestone
    if (
        milestone !== undefined &&
        milestone !== null &&
        !mongoose.isValidObjectId(milestone)
    ) {
        errors.milestone = "Milestone must be a valid milestone ID";
    }

    // Due date
    if (dueDate !== undefined && dueDate !== null) {
        const parsedDueDate = new Date(dueDate);

        if (Number.isNaN(parsedDueDate.getTime())) {
            errors.dueDate = "Due date must be a valid date";
        }
    }

    // Progress
    if (progress !== undefined) {
        if (
            !Number.isInteger(progress) ||
            progress < 0 ||
            progress > 100
        ) {
            errors.progress =
                "Progress must be an integer between 0 and 100";
        }
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: errors
            }
        });
    }

    next();
};

const validateUpdateTask = (req, res, next) => {
    const {
        title,
        description,
        status,
        priority,
        assignee,
        milestone,
        dueDate,
        progress,
        version
    } = req.body;

    const errors = {};

    // At least one field must be provided.
    const updateFields = [
        title,
        description,
        status,
        priority,
        assignee,
        milestone,
        dueDate,
        progress
    ];

    if (updateFields.every((field) => field === undefined)) {
        errors.body = "At least one task field must be provided";
    }

    if (
        title !== undefined &&
        (typeof title !== "string" || title.trim().length === 0)
    ) {
        errors.title = "Task title cannot be empty";
    }

    if (
        description !== undefined &&
        typeof description !== "string"
    ) {
        errors.description = "Description must be a string";
    }

    if (
        status !== undefined &&
        !VALID_STATUSES.includes(status)
    ) {
        errors.status =
            `Status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    if (
        priority !== undefined &&
        !VALID_PRIORITIES.includes(priority)
    ) {
        errors.priority =
            `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
    }

    if (
        assignee !== undefined &&
        assignee !== null &&
        !mongoose.isValidObjectId(assignee)
    ) {
        errors.assignee =
            "Assignee must be a valid user ID";
    }

    if (
        milestone !== undefined &&
        milestone !== null &&
        !mongoose.isValidObjectId(milestone)
    ) {
        errors.milestone =
            "Milestone must be a valid milestone ID";
    }

    if (dueDate !== undefined && dueDate !== null) {
        const parsedDueDate = new Date(dueDate);

        if (Number.isNaN(parsedDueDate.getTime())) {
            errors.dueDate = "Due date must be a valid date";
        }
    }

    if (progress !== undefined) {
        if (
            !Number.isInteger(progress) ||
            progress < 0 ||
            progress > 100
        ) {
            errors.progress =
                "Progress must be an integer between 0 and 100";
        }
    }

    if (
        version === undefined ||
        !Number.isInteger(version) ||
        version < 1
    ) {
        errors.version =
            "Version must be an integer greater than or equal to 1";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: errors
            }
        });
    }

    next();
};

const validateTaskListQuery = (req, res, next) => {
    const {
        page = "1",
        limit = "20",
        status,
        priority,
        assignee,
        sort = "dueDate"
    } = req.query;

    const errors = {};

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1
    ) {
        errors.page =
            "Page must be an integer greater than or equal to 1";
    }

    if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
    ) {
        errors.limit =
            "Limit must be an integer between 1 and 100";
    }

    if (
        status !== undefined &&
        !VALID_STATUSES.includes(status)
    ) {
        errors.status =
            `Status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    if (
        priority !== undefined &&
        !VALID_PRIORITIES.includes(priority)
    ) {
        errors.priority =
            `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
    }

    if (
        assignee !== undefined &&
        !mongoose.isValidObjectId(assignee)
    ) {
        errors.assignee =
            "Assignee must be a valid user ID";
    }

    if (!VALID_SORTS.includes(sort)) {
        errors.sort =
            `Sort must be one of: ${VALID_SORTS.join(", ")}`;
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: errors
            }
        });
    }

    next();
};

module.exports = {
    validateCreateTask,
    validateTaskListQuery,
    validateUpdateTask
};