const validateRiskHistoryQuery = (
    req,
    res,
    next
) => {
    const {
        status,
        severity,
        page = "1",
        limit = "20"
    } = req.query;

    if (
        status &&
        !["ACTIVE", "RESOLVED"].includes(
            status
        )
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_RISK_HISTORY_STATUS",
                message:
                    "Status must be ACTIVE or RESOLVED"
            }
        });
    }

    if (
        severity &&
        !["MEDIUM", "HIGH"].includes(
            severity
        )
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_RISK_HISTORY_SEVERITY",
                message:
                    "Severity must be MEDIUM or HIGH"
            }
        });
    }

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_PAGE",
                message:
                    "Page must be a positive integer"
            }
        });
    }

    if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_LIMIT",
                message:
                    "Limit must be an integer between 1 and 100"
            }
        });
    }

    req.riskHistoryQuery = {
        status,
        severity,
        page: parsedPage,
        limit: parsedLimit
    };

    next();
};

module.exports = {
    validateRiskHistoryQuery
};