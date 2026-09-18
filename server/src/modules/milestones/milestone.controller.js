const milestoneService = require("./milestone.service");

const createMilestone = async (req, res, next) => {
    try {
        const milestone = await milestoneService.createMilestone({
            projectId: req.params.projectId,
            name: req.body.name,
            description: req.body.description,
            dueDate: req.body.dueDate,
            userId: req.user.id
        });

        return res.status(201).json({
            success: true,
            data: milestone
        });
    } catch (error) {
        next(error);
    }
};

const listMilestones = async (req, res, next) => {
    try {
        const milestones = await milestoneService.listMilestones(
            req.params.projectId,
            req.user.id,
            {
                page: Number(req.query.page),
                limit: Number(req.query.limit),
                status: req.query.status
            }
        );

        return res.status(200).json({
            success: true,
            data: milestones
        });
    } catch (error) {
        next(error);
    }
};

const getMilestone = async (req, res, next) => {
    try {
        const milestone = await milestoneService.getMilestone(
            req.params.milestoneId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: milestone
        });
    } catch (error) {
        next(error);
    }
};

const updateMilestone = async (req, res, next) => {
    try {
        const milestone = await milestoneService.updateMilestone({
            milestoneId: req.params.milestoneId,
            name: req.body.name,
            description: req.body.description,
            dueDate: req.body.dueDate,
            status: req.body.status,
            userId: req.user.id
        });

        return res.status(200).json({
            success: true,
            data: milestone
        });
    } catch (error) {
        next(error);
    }
};

const deleteMilestone = async (req, res, next) => {
    try {
        await milestoneService.deleteMilestone(
            req.params.milestoneId,
            req.user.id
        );

        return res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createMilestone,
    listMilestones,
    getMilestone,
    updateMilestone,
    deleteMilestone
};
