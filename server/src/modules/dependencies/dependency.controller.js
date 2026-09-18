const dependencyService = require("./dependency.service");

const createDependency = async (req, res, next) => {
    try {
        const dependency =
            await dependencyService.createDependency({
                projectId: req.params.projectId,
                fromTask: req.body.fromTask,
                toTask: req.body.toTask,
                userId: req.user.id
            });

        res.status(201).json({
            success: true,
            data: { dependency }
        });
    } catch (error) {
        next(error);
    }
};

const listDependencies = async (req, res, next) => {
    try {
        const dependencies =
            await dependencyService.listDependencies(
                req.params.projectId,
                req.user.id
            );

        res.status(200).json({
            success: true,
            data: { dependencies }
        });
    } catch (error) {
        next(error);
    }
};

const deleteDependency = async (req, res, next) => {
    try {
        await dependencyService.deleteDependency({
            projectId: req.params.projectId,
            dependencyId: req.params.dependencyId,
            userId: req.user.id
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDependency,
    listDependencies,
    deleteDependency
};