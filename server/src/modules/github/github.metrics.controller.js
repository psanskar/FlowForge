const {
    getGithubExecutionMetrics
} = require("./github.metrics.service");

const getGithubMetrics = async (
    req,
    res,
    next
) => {
    try {
        const metrics =
            await getGithubExecutionMetrics({
                projectId:
                    req.params.projectId,

                userId:
                    req.user.id,

                days:
                    req.githubMetricsDays
            });

        return res.status(200).json(
            metrics
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getGithubMetrics
};