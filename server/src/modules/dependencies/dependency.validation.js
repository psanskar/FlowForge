const mongoose = require("mongoose");

const validateCreateDependency = (req, res, next) => {
    const { fromTask, toTask } = req.body;

    if (!fromTask || !toTask) {
        return res.status(400).json({
            success: false,
            error: {
                code: "MISSING_DEPENDENCY_TASKS",
                message: "fromTask and toTask are required"
            }
        });
    }

    if (
        !mongoose.isValidObjectId(fromTask) ||
        !mongoose.isValidObjectId(toTask)
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_TASK_ID",
                message: "fromTask and toTask must be valid task IDs"
            }
        });
    }

    next();
};

module.exports = {
    validateCreateDependency
};