const taskService = require("./task.service");

const createTask = async (req, res, next) => {
    try {
        const task = await taskService.createTask({
            ...req.body,
            projectId: req.params.projectId,
            userId: req.user.id
        });

        res.status(201).json({
            success: true,
            data: {
                task
            }
        });
    } catch (error) {
        next(error);
    }
};

const listTasks = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const result = await taskService.listTasks(
            req.params.projectId,
            req.user.id,
            {
                page,
                limit,
                status: req.query.status,
                priority: req.query.priority,
                assignee: req.query.assignee,
                sort: req.query.sort || "dueDate"
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

const getTask = async (req, res, next) => {
    try {
        const task = await taskService.getTaskById(
            req.params.taskId,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: {
                task
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateTask = async (req, res, next) => {
    try {
        const {
            version,
            ...updates
        } = req.body;

        const task = await taskService.updateTask({
            taskId: req.params.taskId,
            userId: req.user.id,
            version,
            updates
        });

        res.status(200).json({
            success: true,
            data: {
                task
            }
        });
    } catch (error) {
        next(error);
    }
};

const deleteTask = async (req, res, next) => {
    try {
        await taskService.deleteTask(
            req.params.taskId,
            req.user.id
        );

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    listTasks,
    getTask,
    updateTask,
    deleteTask
};