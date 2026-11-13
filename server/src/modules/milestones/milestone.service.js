const mongoose = require("mongoose");

const Milestone = require("./milestone.model");
const {
    getProjectForMember,
    assertProjectOwner,
    assertProjectWritable
} = require("../projects/project.access");

const createMilestone = async ({
    projectId,
    name,
    description,
    dueDate,
    userId
}) => {
    const project = await getProjectForMember(
        projectId,
        userId,
        { select: "owner startDate targetDate status" }
    );
    assertProjectOwner(project, userId, {
        message: "Only the project owner can create milestones"
    });
    assertProjectWritable(project);

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
    await getProjectForMember(projectId, userId, { select: "_id" });

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
            .limit(limit)
            .lean(),
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

    await getProjectForMember(milestone.project, userId, {
        select: "_id",
        notFoundCode: "MILESTONE_NOT_FOUND",
        notFoundMessage: "Milestone not found"
    });

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

    const project = await getProjectForMember(
        milestone.project,
        userId,
        {
            select: "owner startDate targetDate status",
            notFoundCode: "MILESTONE_NOT_FOUND",
            notFoundMessage: "Milestone not found"
        }
    );
    assertProjectOwner(project, userId, {
        message: "Only the project owner can update milestones"
    });
    assertProjectWritable(project);

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

    const project = await getProjectForMember(
        milestone.project,
        userId,
        {
            select: "owner status",
            notFoundCode: "MILESTONE_NOT_FOUND",
            notFoundMessage: "Milestone not found"
        }
    );
    assertProjectOwner(project, userId, {
        message: "Only the project owner can delete milestones"
    });
    assertProjectWritable(project);

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
