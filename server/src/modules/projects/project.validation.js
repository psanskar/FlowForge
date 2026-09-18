const validateCreateProject = (req, res, next) => {
    const {
        name,
        description,
        startDate,
        targetDate
    } = req.body;

    const errors = {};

    // Name
    if (typeof name !== "string" || name.trim().length === 0) {
        errors.name = "Project name is required";
    }

    // Description
    if (
        description !== undefined &&
        typeof description !== "string"
    ) {
        errors.description = "Description must be a string";
    }

    // Start date
    if (startDate !== undefined && startDate !== null) {
        const parsedStartDate = new Date(startDate);

        if (Number.isNaN(parsedStartDate.getTime())) {
            errors.startDate = "Start date must be a valid date";
        }
    }

    // Target date
    if (targetDate !== undefined && targetDate !== null) {
        const parsedTargetDate = new Date(targetDate);

        if (Number.isNaN(parsedTargetDate.getTime())) {
            errors.targetDate = "Target date must be a valid date";
        }
    }

    // Start date cannot be after target date
    if (
        startDate &&
        targetDate &&
        !Number.isNaN(new Date(startDate).getTime()) &&
        !Number.isNaN(new Date(targetDate).getTime()) &&
        new Date(targetDate) < new Date(startDate)
    ) {
        errors.targetDate =
            "Target date cannot be earlier than start date";
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

const validateProjectListQuery = (req, res, next) => {
    const errors = {};

    const { page, limit } = req.query;

    if (page !== undefined) {
        const parsedPage = Number(page);

        if (
            !Number.isInteger(parsedPage) ||
            parsedPage < 1
        ) {
            errors.page = "Page must be an integer greater than or equal to 1";
        }
    }

    if (limit !== undefined) {
        const parsedLimit = Number(limit);

        if (
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100
        ) {
            errors.limit = "Limit must be an integer between 1 and 100";
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

module.exports = {
    validateCreateProject,
    validateProjectListQuery
};