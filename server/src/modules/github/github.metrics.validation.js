const ALLOWED_DAYS = [
    7,
    14,
    30,
    60,
    90
];

const validateGithubMetricsQuery = (
    req,
    res,
    next
) => {
    const rawDays =
        req.query.days;

    if (
        rawDays === undefined
    ) {
        req.githubMetricsDays = 30;
        return next();
    }

    const days =
        Number(rawDays);

    if (
        !Number.isInteger(days) ||
        !ALLOWED_DAYS.includes(days)
    ) {
        return res.status(400).json({
            success: false,
            error: {
                code:
                    "INVALID_GITHUB_METRICS_RANGE",
                message:
                    "Days must be one of 7, 14, 30, 60, or 90"
            }
        });
    }

    req.githubMetricsDays = days;

    next();
};

module.exports = {
    ALLOWED_DAYS,
    validateGithubMetricsQuery
};