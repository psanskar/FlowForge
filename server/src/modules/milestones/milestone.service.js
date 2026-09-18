const mongoose = require("mongoose");

const Milestone = require("./milestone.model");
const Project = require("../projects/project.model");

const createMilestone = async ({
    projectId,
    name,
    description,
    dueDate,
    userId
}) => {
    const project = await Project.findOne({
        _id: projectId,
        "members": {
            $elemMatch: {
                user: userId,
                role: "owner"
            }
        }
    }).select("startDate targetDate");

    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    const milestoneDueDate = new Date(dueDate);

    if (
        project.startDate &&
        milestoneDueDate < project.startDate
    ) {
        const error = new Error(
            "Milestone due date cannot be before project start date"
        );
        error.statusCode = 422;
        error.code = "INVALID_MILESTONE_DUE_DATE";
        throw error;
    }

    if (
        project.targetDate &&
        milestoneDueDate > project.targetDate
    ) {
        const error = new Error(
            "Milestone due date cannot be after project target date"
        );
        error.statusCode = 422;
        error.code = "INVALID_MILESTONE_DUE_DATE";
        throw error;
    }

    const milestone = await Milestone.create({
        project: projectId,
        name: name.trim(),
        description: description?.trim() || "",
        dueDate: milestoneDueDate
    });

    return milestone;
};

const listMilestones = async (
    projectId,
    userId,
    {
        page = 1,
        limit = 20,
        status
    } = {}
) => {
    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    const filter = {
        project: projectId
    };

    if (status) {
        filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [milestones, total] = await Promise.all([
        Milestone.find(filter)
            .sort({ dueDate: 1, createdAt: 1 })
            .skip(skip)
            .limit(limit),
        Milestone.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        milestones,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    };
};

const getMilestone = async (milestoneId, userId) => {
    if (!mongoose.isValidObjectId(milestoneId)) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const milestone = await Milestone.findById(milestoneId);

    if (!milestone) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: milestone.project,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    return milestone;
};

const updateMilestone = async ({
    milestoneId,
    name,
    description,
    dueDate,
    status,
    userId
}) => {
    if (!mongoose.isValidObjectId(milestoneId)) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const milestone = await Milestone.findById(milestoneId);

    if (!milestone) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: milestone.project,
        "members.user": userId
    }).select("owner startDate targetDate");

    if (!project) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    if (project.owner.toString() !== userId.toString()) {
        const error = new Error(
            "Only the project owner can update milestones"
        );
        error.statusCode = 403;
        error.code = "PROJECT_OWNER_REQUIRED";
        throw error;
    }

    if (name !== undefined) {
        milestone.name = name.trim();
    }

    if (description !== undefined) {
        milestone.description = description.trim();
    }

    if (dueDate !== undefined) {
        const milestoneDueDate = new Date(dueDate);

        if (
            project.startDate &&
            milestoneDueDate < project.startDate
        ) {
            const error = new Error(
                "Milestone due date cannot be before project start date"
            );
            error.statusCode = 422;
            error.code = "INVALID_MILESTONE_DUE_DATE";
            throw error;
        }

        if (
            project.targetDate &&
            milestoneDueDate > project.targetDate
        ) {
            const error = new Error(
                "Milestone due date cannot be after project target date"
            );
            error.statusCode = 422;
            error.code = "INVALID_MILESTONE_DUE_DATE";
            throw error;
        }

        milestone.dueDate = milestoneDueDate;
    }

    if (status !== undefined) {
        milestone.status = status;
    }

    await milestone.save();

    return milestone;
};

const deleteMilestone = async (milestoneId, userId) => {
    if (!mongoose.isValidObjectId(milestoneId)) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const milestone = await Milestone.findById(milestoneId);

    if (!milestone) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: milestone.project,
        "members.user": userId
    }).select("owner");

    if (!project) {
        const error = new Error("Milestone not found");
        error.statusCode = 404;
        error.code = "MILESTONE_NOT_FOUND";
        throw error;
    }

    if (project.owner.toString() !== userId.toString()) {
        const error = new Error(
            "Only the project owner can delete milestones"
        );
        error.statusCode = 403;
        error.code = "PROJECT_OWNER_REQUIRED";
        throw error;
    }

    const Task = require("../tasks/task.model");

    const tasksUsingMilestone = await Task.exists({
        milestone: milestoneId
    });

    if (tasksUsingMilestone) {
        const error = new Error(
            "Milestone cannot be deleted while tasks reference it"
        );
        error.statusCode = 409;
        error.code = "MILESTONE_HAS_TASKS";
        throw error;
    }

    await Milestone.deleteOne({
        _id: milestoneId
    });
};

module.exports = {
    createMilestone,
    listMilestones,
    getMilestone,
    updateMilestone,
    deleteMilestone
};
