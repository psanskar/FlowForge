const githubService = require("./github.service");

const connectRepository = async (req, res, next) => {
    try {
        const connection =
            await githubService.connectRepository(
                req.params.projectId,
                req.user.id,
                req.body
            );

        return res.status(200).json({
            success: true,
            data: {
                repository: connection
            }
        });
    } catch (error) {
        next(error);
    }
};

const getRepositoryConnection = async (
    req,
    res,
    next
) => {
    try {
        const connection =
            await githubService.getRepositoryConnection(
                req.params.projectId,
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: {
                repository: connection
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    connectRepository,
    getRepositoryConnection
};