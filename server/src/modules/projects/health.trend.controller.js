const {
    getHealthTrend
} = require("./health.trend.service");

const getHealthTrendController = async (
    req,
    res,
    next
) => {
    try {
        const result =
            await getHealthTrend({
                projectId:
                    req.params.projectId,
                userId:
                    req.user.id,
                days:
                    req.healthTrendDays
            });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getHealthTrendController
};