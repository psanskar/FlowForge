const operationsService = require("./operations.service");

const getReadiness = async (req, res) => {
    const readiness = await operationsService.getReadiness();

    return res.status(readiness.ready ? 200 : 503).json({
        success: readiness.ready,
        data: {
            status: readiness.ready ? "ready" : "not_ready",
            checks: readiness.checks
        }
    });
};

const getQueueOperations = async (req, res, next) => {
    try {
        const operations =
            await operationsService.getQueueOperations();

        return res.status(200).json({
            success: true,
            data: operations
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getReadiness,
    getQueueOperations
};
