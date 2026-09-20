const riskHistoryQueryService = require(
    "./risk.history.query.service"
);

const getRiskHistory = async (
    req,
    res,
    next
) => {
    try {
        const history =
            await riskHistoryQueryService
                .getRiskHistory({
                    projectId:
                        req.params.projectId,
                    userId:
                        req.user.id,
                    ...req.riskHistoryQuery
                });

        return res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getRiskHistory
};