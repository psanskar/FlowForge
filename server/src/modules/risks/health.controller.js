const healthService = require("./health.service");

const getProjectHealth = async (req, res, next) => {
    try {
        const health =
            await healthService.getProjectHealth(
                req.params.projectId,
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: health
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProjectHealth
};