const dashboardService = require("./dashboard.service");

const getProjectDashboard = async (req, res, next) => {
    try {
        const dashboard =
            await dashboardService.getProjectDashboard(
                req.params.projectId,
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProjectDashboard
};