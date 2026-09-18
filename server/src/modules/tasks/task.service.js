const mongoose = require("mongoose");

const Task = require("./task.model");
const Project = require("../projects/project.model");
const Milestone = require("../milestones/milestone.model");
const Dependency = require("../dependencies/dependency.model");
const { emitToProject } = require("../../realtime/events");

const createTask = async ({
    projectId,
    title,
    description,
    status = "todo",
    priority = "medium",
    assignee = null,
    milestone = null,
    dueDate = null,
    progress = 0,
    userId
}) => {
    // Verify project ID
    if (!mongoose.isValidObjectId(projectId)) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    // Verify project exists and user is a member
    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    });

    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    // Verify assignee belongs to project
    if (assignee) {
        const isProjectMember = project.members.some(
            (member) =>
                member.user.toString() === assignee.toString()
        );

        if (!isProjectMember) {
            const error = new Error(
                "Assignee must be a member of the project"
            );

            error.statusCode = 422;
            error.code = "INVALID_TASK_ASSIGNEE";

            throw error;
        }
    }

    // Verify milestone belongs to the same project
    if (milestone) {
        if (!mongoose.isValidObjectId(milestone)) {
            const error = new Error("Milestone not found");
            error.statusCode = 404;
            error.code = "MILESTONE_NOT_FOUND";
            throw error;
        }

        const existingMilestone = await Milestone.findOne({
            _id: milestone,
            project: projectId
        });

        if (!existingMilestone) {
            const error = new Error(
                "Milestone does not belong to this project"
            );

            error.statusCode = 422;
            error.code = "INVALID_TASK_MILESTONE";

            throw error;
        }
    }

    // Determine execution timestamps
    let normalizedProgress = progress;
    let startedAt = null;
    let completedAt = null;

    if (status === "todo") {
        normalizedProgress = 0;
    }

    if (
        status === "in_progress" ||
        status === "blocked"
    ) {
        if (normalizedProgress === 0) {
            normalizedProgress = 1;
        }

        startedAt = new Date();
    }

    if (status === "completed") {
        normalizedProgress = 100;

        startedAt = new Date();
        completedAt = new Date();
    }

    // Create task
    const task = await Task.create({
        project: projectId,
        title: title.trim(),
        description: description?.trim() || "",
        status,
        priority,
        assignee,
        milestone,
        dueDate: dueDate ? new Date(dueDate) : null,
        progress: normalizedProgress,
        startedAt,
        completedAt,
        lastActivityAt: new Date(),
        createdBy: userId,
        version: 1
    });

    return task;
};

const listTasks = async (
    projectId,
    userId,
    {
        page = 1,
        limit = 20,
        status,
        priority,
        assignee,
        sort = "dueDate"
    } = {}
) => {
    if (!mongoose.isValidObjectId(projectId)) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        error.code = "PROJECT_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    });

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

    if (priority) {
        filter.priority = priority;
    }

    if (assignee) {
        filter.assignee = assignee;
    }

    const sortOptions = {
        dueDate: {
            dueDate: 1,
            createdAt: -1
        },
        createdAt: {
            createdAt: -1
        },
        updatedAt: {
            updatedAt: -1
        }
    };

    const [tasks, total] = await Promise.all([
        Task.find(filter)
            .select(
                "_id project title description status priority assignee milestone dueDate progress startedAt completedAt lastActivityAt createdBy version createdAt updatedAt"
            )
            .sort(sortOptions[sort])
            .skip((page - 1) * limit)
            .limit(limit),

        Task.countDocuments(filter)
    ]);

    return {
        tasks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage:
                page < Math.ceil(total / limit),
            hasPreviousPage: page > 1
        }
    };
};

const getTaskById = async (taskId, userId) => {
    if (!mongoose.isValidObjectId(taskId)) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    const task = await Task.findById(taskId);

    if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: task.project,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    return task;
};

const updateTask = async ({
    taskId,
    userId,
    version,
    updates
}) => {
    if (!mongoose.isValidObjectId(taskId)) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    const task = await Task.findById(taskId);

    if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    // Verify that the authenticated user belongs to the project.
    const project = await Project.findOne({
        _id: task.project,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    // Build the next task state before writing it.
    const nextState = {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        milestone: task.milestone,
        dueDate: task.dueDate,
        progress: task.progress,
        startedAt: task.startedAt,
        completedAt: task.completedAt
    };

    const allowedFields = [
        "title",
        "description",
        "status",
        "priority",
        "assignee",
        "milestone",
        "dueDate",
        "progress"
    ];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            nextState[field] = updates[field];
        }
    }

    // Normalize text fields.
    if (updates.title !== undefined) {
        nextState.title = updates.title.trim();
    }

    if (updates.description !== undefined) {
        nextState.description = updates.description.trim();
    }

    // Validate assignee belongs to the project.
    if (
        updates.assignee !== undefined &&
        updates.assignee !== null
    ) {
        const isProjectMember = await Project.findOne({
            _id: task.project,
            "members.user": updates.assignee
        }).select("_id");

        if (!isProjectMember) {
            const error = new Error(
                "Assignee must be a member of the project"
            );

            error.statusCode = 422;
            error.code = "INVALID_TASK_ASSIGNEE";

            throw error;
        }
    }

    // Validate milestone belongs to the project.
    if (
        updates.milestone !== undefined &&
        updates.milestone !== null
    ) {
        const milestone = await Milestone.findOne({
            _id: updates.milestone,
            project: task.project
        }).select("_id");

        if (!milestone) {
            const error = new Error(
                "Milestone does not belong to this project"
            );

            error.statusCode = 422;
            error.code = "INVALID_TASK_MILESTONE";

            throw error;
        }
    }

    // Normalize due date.
    if (
        updates.dueDate !== undefined &&
        updates.dueDate !== null
    ) {
        nextState.dueDate = new Date(updates.dueDate);
    }

    // Keep status and progress consistent.
    // Keep status and progress consistent.
const statusWasUpdated = updates.status !== undefined;
const progressWasUpdated = updates.progress !== undefined;

if (statusWasUpdated) {
    if (nextState.status === "todo") {
        nextState.progress = 0;
    }

    if (
        nextState.status === "in_progress" ||
        nextState.status === "blocked"
    ) {
        if (nextState.progress === 0) {
            nextState.progress = 1;
        }
    }

    if (nextState.status === "completed") {
        nextState.progress = 100;
    }
} else if (progressWasUpdated) {
    if (nextState.status === "in_progress" || nextState.status === "blocked") {
        if (nextState.progress === 0) {
            nextState.progress = 1;
        }
    }

    if (nextState.status === "completed") {
        nextState.progress = 100;
    }

    // A progress-only update cannot move a todo task
    // away from the todo state.
    if (nextState.status === "todo") {
        nextState.progress = 0;
    }
}

    // Track execution lifecycle.
    if (
        nextState.status !== "todo" &&
        !nextState.startedAt
    ) {
        nextState.startedAt = new Date();
    }

    if (nextState.status === "completed") {
        if (!nextState.completedAt) {
            nextState.completedAt = new Date();
        }
    } else {
        nextState.completedAt = null;
    }

    const now = new Date();

    // Atomic optimistic-concurrency update.
    const updatedTask = await Task.findOneAndUpdate(
        {
            _id: taskId,
            version: version
        },
        {
            $set: {
                title: nextState.title,
                description: nextState.description,
                status: nextState.status,
                priority: nextState.priority,
                assignee: nextState.assignee,
                milestone: nextState.milestone,
                dueDate: nextState.dueDate,
                progress: nextState.progress,
                startedAt: nextState.startedAt,
                completedAt: nextState.completedAt,
                lastActivityAt: now
            },
            $inc: {
                version: 1
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedTask) {
        const error = new Error(
            "Task was modified by another request"
        );

        error.statusCode = 409;
        error.code = "TASK_VERSION_CONFLICT";

        throw error;
    }

    emitToProject(
        updatedTask.project.toString(),
        "task.updated",
        {
            task: updatedTask
        }
    );

    return updatedTask;
};

const deleteTask = async (taskId, userId) => {
    if (!mongoose.isValidObjectId(taskId)) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    const task = await Task.findById(taskId);

    if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    const project = await Project.findOne({
        _id: task.project,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        error.code = "TASK_NOT_FOUND";
        throw error;
    }

    // Prevent deletion when the task participates in dependencies.
    const dependencyExists = await Dependency.exists({
        $or: [
            { fromTask: taskId },
            { toTask: taskId }
        ]
    });

    if (dependencyExists) {
        const error = new Error(
            "Task cannot be deleted while dependencies exist"
        );

        error.statusCode = 409;
        error.code = "TASK_HAS_DEPENDENCIES";

        throw error;
    }

    await Task.deleteOne({
        _id: taskId
    });

    return;
};

module.exports = {
    createTask,
    listTasks,
    getTaskById,
    updateTask,
    deleteTask
};