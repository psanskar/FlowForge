const projectService = require("./project.service");

const createProject = async (req, res, next) => {
    try {
        const project = await projectService.createProject({
            ...req.body,
            userId: req.user.id
        });

        res.status(201).json({
            success: true,
            data: {
                project
            }
        });
    } catch (error) {
        next(error);
    }
};

const listProjects = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const result = await projectService.listProjects(
            req.user.id,
            {
                page,
                limit
            }
        );

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getProject = async (req, res, next) => {
    try {
        const project = await projectService.getProjectById(
            req.params.projectId,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: {
                project
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProject,
    listProjects,
    getProject
};