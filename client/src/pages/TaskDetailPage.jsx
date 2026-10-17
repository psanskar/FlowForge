import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import useTask from "../hooks/useTask";
import useDependencies from "../hooks/useDependencies";
import useDeleteTask from "../hooks/useDeleteTask";
import useCreateDependency from "../hooks/useCreateDependency";
import useDeleteDependency from "../hooks/useDeleteDependency";
import useTasks from "../hooks/useTasks";

const formatStatus = (status) => {
    const labels = {
        todo: "To Do",
        in_progress: "In Progress",
        blocked: "Blocked",
        completed: "Completed"
    };

    return labels[status] ?? status;
};

const formatPriority = (priority) => {
    if (!priority) {
        return "—";
    }

    return (
        priority.charAt(0).toUpperCase() +
        priority.slice(1)
    );
};

const formatDate = (date) => {
    if (!date) {
        return "—";
    }

    return new Date(date).toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
};

const formatDateTime = (date) => {
    if (!date) {
        return "—";
    }

    return new Date(date).toLocaleString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
};

const TaskDetailPage = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();

    const {
        data,
        isLoading,
        isError,
        error
    } = useTask(taskId);

    const task = data?.data?.task ?? null;

    const projectId =
        typeof task?.project === "object"
            ? task.project?._id
            : task?.project;

    const deleteTaskMutation =
        useDeleteTask(taskId, projectId);

    const [dependencyTaskId, setDependencyTaskId] =
        useState("");

    const {
        data: projectTasksData,
        isLoading: isProjectTasksLoading
    } = useTasks(projectId, {
        page: 1,
        limit: 100,
        sort: "createdAt"
    });

    const projectTasks =
        projectTasksData?.data?.tasks ?? [];

    const createDependencyMutation =
        useCreateDependency(projectId);

    const deleteDependencyMutation =
        useDeleteDependency(projectId);

    const handleDelete = async () => {
        const confirmed = window.confirm(
            "Delete this task? This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        try {
            await deleteTaskMutation.mutateAsync();
            navigate(`/app/projects/${projectId}/tasks`);
        } catch {
            // The mutation error is displayed below.
        }
    };

    const {
        data: dependencyData,
        isLoading: isDependenciesLoading,
        isError: isDependenciesError
    } = useDependencies(projectId);

    const dependencies =
        dependencyData?.data?.dependencies ?? [];

    const blockedBy = dependencies.filter(
        (dependency) =>
            String(dependency.toTask?._id) ===
            String(task?._id)
    );

    const blocking = dependencies.filter(
        (dependency) =>
            String(dependency.fromTask?._id) ===
            String(task?._id)
    );

    const existingBlockedByTaskIds = new Set(
        blockedBy.map((dependency) =>
            String(dependency.fromTask?._id)
        )
    );

    const availableDependencyTasks =
        projectTasks.filter(
            (projectTask) =>
                String(projectTask._id) !==
                    String(task._id) &&
                !existingBlockedByTaskIds.has(
                    String(projectTask._id)
                )
        );

    const handleAddDependency = async (event) => {
        event.preventDefault();

        if (!dependencyTaskId) {
            return;
        }

        try {
            await createDependencyMutation.mutateAsync({
                fromTask: dependencyTaskId,
                toTask: taskId
            });

            setDependencyTaskId("");
        } catch {
            // The mutation error is displayed below.
        }
    };

    const handleDeleteDependency = async (dependencyId) => {
        const confirmed = window.confirm(
            "Remove this dependency?"
        );

        if (!confirmed) {
            return;
        }

        try {
            await deleteDependencyMutation.mutateAsync(
                dependencyId
            );
        } catch {
            // The mutation error is displayed below.
        }
    };

    if (isLoading) {
        return (
            <main className="page-container">
                <p>Loading task...</p>
            </main>
        );
    }

    if (isError || !task) {
        return (
            <main className="page-container">
                <h1>Task</h1>

                <p>
                    {error?.message ??
                        "Unable to load this task."}
                </p>

                <Link to="/app/projects">
                    Back to projects
                </Link>
            </main>
        );
    }

    return (
        <main className="page-container task-detail-page">
            <div className="page-header task-detail-header">
                <div>
                    <span className="page-eyebrow">Task details</span>
                    <h1>{task.title}</h1>
                </div>

                <Link
                    className="secondary-button"
                    to={`/app/projects/${projectId}/tasks`}
                >
                    ← Back to tasks
                </Link>
            </div>

            <section className="dashboard-card task-detail-card">
                <div className="task-detail-summary-header">
                    <h2>Execution details</h2>

                    <div className="task-detail-actions">
                        <Link
                            className="primary-button"
                            to={`/app/tasks/${taskId}/edit`}
                        >
                            Edit task
                        </Link>

                        <button
                            type="button"
                            className="danger-button"
                            onClick={handleDelete}
                            disabled={deleteTaskMutation.isPending}
                        >
                            {deleteTaskMutation.isPending
                                ? "Deleting..."
                                : "Delete task"}
                        </button>
                    </div>
                </div>

                {deleteTaskMutation.isError && (
                    <p className="task-inline-error" role="alert">
                        {deleteTaskMutation.error?.code ===
                        "TASK_HAS_DEPENDENCIES"
                            ? "This task cannot be deleted because it is used by one or more dependencies. Remove those dependencies first."
                            : deleteTaskMutation.error?.message ??
                              "Unable to delete task."}
                    </p>
                )}

                <div className="task-metadata-grid">
                    <div className="task-metadata-item">
                        <span>Status</span>
                        <strong>{formatStatus(task.status)}</strong>
                    </div>
                    <div className="task-metadata-item">
                        <span>Priority</span>
                        <strong>{formatPriority(task.priority)}</strong>
                    </div>
                    <div className="task-metadata-item">
                        <span>Progress</span>
                        <strong>{task.progress ?? 0}%</strong>
                    </div>
                    <div className="task-metadata-item">
                        <span>Due date</span>
                        <strong>{formatDate(task.dueDate)}</strong>
                    </div>
                    <div className="task-metadata-item">
                        <span>Assignee</span>
                        <strong>
                            {task.assignee?.name ??
                                task.assignee ??
                                "Unassigned"}
                        </strong>
                    </div>
                    <div className="task-metadata-item">
                        <span>Milestone</span>
                        <strong>
                            {task.milestone?.name ??
                                task.milestone ??
                                "No milestone"}
                        </strong>
                    </div>
                </div>
            </section>

            {task.description && (
                <section className="dashboard-card task-detail-card">
                    <h2>Description</h2>
                    <p className="task-detail-description">
                        {task.description}
                    </p>
                </section>
            )}

            <section className="dashboard-card task-detail-card">
                <h2>Dependencies</h2>

                {isDependenciesLoading && (
                    <p>Loading dependencies...</p>
                )}

                {isDependenciesError && (
                    <p>
                        Unable to load dependencies.
                    </p>
                )}

                {!isDependenciesLoading &&
                    !isDependenciesError && (
                        <div className="task-dependency-grid">
                            <section>
                                <h3>Add dependency</h3>

                                <p>
                                    Select a task that must be
                                    completed before this task.
                                </p>

                                <form
                                    onSubmit={
                                        handleAddDependency
                                    }
                                >
                                    <label htmlFor="dependency-task">
                                        This task is blocked by
                                    </label>

                                    <select
                                        id="dependency-task"
                                        value={dependencyTaskId}
                                        onChange={(event) =>
                                            setDependencyTaskId(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            isProjectTasksLoading ||
                                            createDependencyMutation.isPending ||
                                            availableDependencyTasks.length ===
                                                0
                                        }
                                    >
                                        <option value="">
                                            Select a task
                                        </option>

                                        {availableDependencyTasks.map(
                                            (projectTask) => (
                                                <option
                                                    key={
                                                        projectTask._id
                                                    }
                                                    value={
                                                        projectTask._id
                                                    }
                                                >
                                                    {
                                                        projectTask.title
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>

                                    <button
                                        type="submit"
                                        className="primary-button"
                                        disabled={
                                            !dependencyTaskId ||
                                            createDependencyMutation.isPending
                                        }
                                    >
                                        {createDependencyMutation.isPending
                                            ? "Adding..."
                                            : "Add dependency"}
                                    </button>
                                </form>

                                {isProjectTasksLoading && (
                                    <p>
                                        Loading project tasks...
                                    </p>
                                )}

                                {!isProjectTasksLoading &&
                                    availableDependencyTasks.length ===
                                        0 && (
                                        <p>
                                            No other project tasks are
                                            available to add as a
                                            dependency.
                                        </p>
                                    )}

                                {createDependencyMutation.isError && (
                                    <p>
                                        {createDependencyMutation.error
                                            ?.message ??
                                            "Unable to add dependency."}
                                    </p>
                                )}

                                {deleteDependencyMutation.isError && (
                                    <p>
                                        {deleteDependencyMutation.error
                                            ?.message ??
                                            "Unable to remove dependency."}
                                    </p>
                                )}
                            </section>
                            <section>
                                <h3>Blocked by</h3>

                                {blockedBy.length === 0 ? (
                                    <p>
                                        No tasks are blocking
                                        this task.
                                    </p>
                                ) : (
                                    <ul>
                                        {blockedBy.map(
                                            (dependency) => (
                                                <li
                                                    key={dependency._id}
                                                >
                                                    <Link
                                                        to={`/app/tasks/${dependency.fromTask._id}`}
                                                    >
                                                        {dependency.fromTask.title}
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="danger-button"
                                                        onClick={() =>
                                                            handleDeleteDependency(
                                                                dependency._id
                                                            )
                                                        }
                                                        disabled={
                                                            deleteDependencyMutation.isPending
                                                        }
                                                    >
                                                        {deleteDependencyMutation.isPending
                                                            ? "Removing..."
                                                            : "Remove"}
                                                    </button>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                )}
                            </section>

                            <section>
                                <h3>Blocking</h3>

                                {blocking.length === 0 ? (
                                    <p>
                                        This task is not
                                        blocking any other
                                        tasks.
                                    </p>
                                ) : (
                                    <ul>
                                        {blocking.map(
                                            (dependency) => (
                                                <li
                                                    key={dependency._id}
                                                >
                                                    <Link
                                                        to={`/app/tasks/${dependency.toTask._id}`}
                                                    >
                                                        {dependency.toTask.title}
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="danger-button"
                                                        onClick={() =>
                                                            handleDeleteDependency(
                                                                dependency._id
                                                            )
                                                        }
                                                        disabled={
                                                            deleteDependencyMutation.isPending
                                                        }
                                                    >
                                                        {deleteDependencyMutation.isPending
                                                            ? "Removing..."
                                                            : "Remove"}
                                                    </button>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                )}
                            </section>
                        </div>
                    )}
            </section>

            <section className="dashboard-card task-detail-card">
                <h2>Activity</h2>
                <dl className="task-activity-list">
                    <div>
                        <dt>Created</dt>
                        <dd>{formatDateTime(task.createdAt)}</dd>
                    </div>
                    <div>
                        <dt>Last updated</dt>
                        <dd>{formatDateTime(task.updatedAt)}</dd>
                    </div>
                    <div>
                        <dt>Last activity</dt>
                        <dd>{formatDateTime(task.lastActivityAt)}</dd>
                    </div>
                    <div>
                        <dt>Version</dt>
                        <dd>{task.version ?? 0}</dd>
                    </div>
                </dl>
            </section>
        </main>
    );
};

export default TaskDetailPage;
