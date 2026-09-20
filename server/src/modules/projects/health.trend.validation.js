const mongoose = require("mongoose");

const validateHealthTrendRequest = (req, res, next) => {
    const { projectId } = req.params;
    const { days = "30" } = req.query;

    if (!mongoose.isValidObjectId(projectId)) {
        return res.status(400).json({
            error: {
                code: "INVALID_PROJECT_ID",
                message: "Invalid project id"
            }
        });
    }

    const parsedDays = Number(days);

    if (
        !Number.isInteger(parsedDays) ||
        ![7, 14, 30, 60, 90].includes(parsedDays)
    ) {
        return res.status(400).json({
            error: {
                code: "INVALID_HEALTH_TREND_RANGE",
                message:
                    "days must be one of: 7, 14, 30, 60, 90"
            }
        });
    }

    req.healthTrendDays = parsedDays;

    next();
};

module.exports = {
    validateHealthTrendRequest
};