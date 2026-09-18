const mongoose = require("mongoose");

const Dependency = require("./dependency.model");
const Project = require("../projects/project.model");
const Task = require("../tasks/task.model");

const wouldCreateCycle = async (
    projectId,
    fromTask,
    toTask
) => {
    const targetTaskId = fromTask.toString();
    const visited = new Set();
    const stack = [toTask.toString()];

    while (stack.length > 0) {
        const currentTaskId = stack.pop();

        if (currentTaskId === targetTaskId) {
            return true;
        }

        if (visited.has(currentTaskId)) {
            continue;
        }

        visited.add(currentTaskId);

        const dependencies = await Dependency.find({
            project: projectId,
            fromTask: new mongoose.Types.ObjectId(currentTaskId)
        }).select("toTask");

        for (const dependency of dependencies) {
            stack.push(
                dependency.toTask.toString()
            );
        }
    }

    return false;
};

const createDependency = async ({
    projectId,
    fromTask,
    toTask,
    userId
}) => {
    // Validate task IDs.
    if (
        !mongoose.isValidObjectId(fromTask) ||
        !mongoose.isValidObjectId(toTask)
    ) {
        const error = new Error("Invalid task ID");
        error.statusCode = 400;
        error.code = "INVALID_TASK_ID";
        throw error;
    }

    // A task cannot depend on itself.
    if (fromTask === toTask) {
        const error = new Error(
            "A task cannot depend on itself"
        );

        error.statusCode = 422;
        error.code = "SELF_DEPENDENCY";

        throw error;
    }

    // Verify that the authenticated user belongs to the project.
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

    // Fetch both tasks.
    const tasks = await Task.find({
        _id: { $in: [fromTask, toTask] },
        project: projectId
    }).select("_id project");

    const fromTaskExists = tasks.some(
        (task) => task._id.toString() === fromTask
    );

    const toTaskExists = tasks.some(
        (task) => task._id.toString() === toTask
    );

    if (!fromTaskExists || !toTaskExists) {
        const error = new Error(
            "Both tasks must belong to the project"
        );

        error.statusCode = 422;
        error.code = "INVALID_DEPENDENCY_TASKS";

        throw error;
    }

    const cycleDetected = await wouldCreateCycle(
    projectId,
    fromTask,
    toTask
);

    if (cycleDetected) {
        const error = new Error(
            "Creating this dependency would create a cycle"
        );

        error.statusCode = 409;
        error.code = "DEPENDENCY_CYCLE";

        throw error;
    }

    // Create the dependency.
    try {
        const dependency = await Dependency.create({
            project: projectId,
            fromTask,
            toTask,
            createdBy: userId
        });

        return dependency;
    } catch (error) {
        // MongoDB duplicate-key error.
        if (error.code === 11000) {
            const duplicateError = new Error(
                "This dependency already exists"
            );

            duplicateError.statusCode = 409;
            duplicateError.code = "DEPENDENCY_ALREADY_EXISTS";

            throw duplicateError;
        }

        throw error;
    }
};

const listDependencies = async (
    projectId,
    userId
) => {
    // Verify project membership.
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

    const dependencies = await Dependency.find({
        project: projectId
    })
        .populate("fromTask", "title status priority progress")
        .populate("toTask", "title status priority progress")
        .sort({ createdAt: 1 });

    return dependencies;
};

const deleteDependency = async ({
    projectId,
    dependencyId,
    userId
}) => {
    if (!mongoose.isValidObjectId(dependencyId)) {
        const error = new Error("Dependency not found");
        error.statusCode = 404;
        error.code = "DEPENDENCY_NOT_FOUND";
        throw error;
    }

    // Find the dependency first.
    const dependency = await Dependency.findById(
        dependencyId
    ).select("project");

    if (!dependency) {
        const error = new Error("Dependency not found");
        error.statusCode = 404;
        error.code = "DEPENDENCY_NOT_FOUND";
        throw error;
    }

    if (dependency.project.toString() !== projectId.toString()) {
        const error = new Error("Dependency not found");
        error.statusCode = 404;
        error.code = "DEPENDENCY_NOT_FOUND";
        throw error;
    }

    // Verify that the user belongs to the dependency's project.
    const project = await Project.findOne({
        _id: dependency.project,
        "members.user": userId
    }).select("_id");

    if (!project) {
        const error = new Error("Dependency not found");
        error.statusCode = 404;
        error.code = "DEPENDENCY_NOT_FOUND";
        throw error;
    }

    await Dependency.deleteOne({
        _id: dependencyId
    });
};

module.exports = {
    createDependency,
    listDependencies,
    deleteDependency
};