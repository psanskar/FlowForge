const mongoose = require("mongoose");

const validateCreateMilestone = (req, res, next) => {
    const { name, dueDate } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: {
                code: "MISSING_MILESTONE_NAME",
                message: "Milestone name is required"
            }
        });
    }

    if (!dueDate) {
        return res.status(400).json({
            success: false,
            error: {
                code: "MISSING_MILESTONE_DUE_DATE",
                message: "Milestone due date is required"
            }
        });
    }

    if (Number.isNaN(Date.parse(dueDate))) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_MILESTONE_DUE_DATE",
                message: "Milestone due date must be a valid date"
            }
        });
    }

    next();
};

const validateUpdateMilestone = (req, res, next) => {
    const { name, dueDate, status } = req.body;

    if (
        name === undefined &&
        dueDate === undefined &&
        status === undefined &&
        req.body.description === undefined
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "NO_UPDATE_FIELDS",
                message: "At least one field is required"
            }
        });
    }

    if (name !== undefined && (!name || !name.trim())) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_MILESTONE_NAME",
                message: "Milestone name cannot be empty"
            }
        });
    }

    if (
        dueDate !== undefined &&
        Number.isNaN(Date.parse(dueDate))
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_MILESTONE_DUE_DATE",
                message: "Milestone due date must be a valid date"
            }
        });
    }

    if (
        status !== undefined &&
        !["planned", "completed"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_MILESTONE_STATUS",
                message: "Milestone status must be planned or completed"
            }
        });
    }

    next();
};

const validateMilestoneListQuery = (req, res, next) => {
    const {
        page = "1",
        limit = "20",
        status
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
        !["planned", "completed"].includes(status)
    ) {
        errors.status =
            "Status must be one of: planned, completed";
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
    validateCreateMilestone,
    validateUpdateMilestone,
    validateMilestoneListQuery
};
