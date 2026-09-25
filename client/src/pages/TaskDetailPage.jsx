import { useParams, Link } from "react-router-dom";

import useTask from "../hooks/useTask";
import useDependencies from "../hooks/useDependencies";

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
        <main className="page-container">
            <div className="page-header">
                <div>
                    <p>Task</p>

                    <h1>{task.title}</h1>
                </div>

                <Link
                    to={`/app/projects/${projectId}/tasks`}
                >
                    Back to tasks
                </Link>
            </div>

            <div className="dashboard-card">
                <h2>Execution details</h2>

                <div>
                    <p>
                        <strong>Status:</strong>{" "}
                        {formatStatus(task.status)}
                    </p>

                    <p>
                        <strong>Priority:</strong>{" "}
                        {formatPriority(task.priority)}
                    </p>

                    <p>
                        <strong>Progress:</strong>{" "}
                        {task.progress ?? 0}%
                    </p>

                    <p>
                        <strong>Due date:</strong>{" "}
                        {formatDate(task.dueDate)}
                    </p>

                    <p>
                        <strong>Assignee:</strong>{" "}
                        {task.assignee?.name ??
                            task.assignee ??
                            "Unassigned"}
                    </p>

                    <p>
                        <strong>Milestone:</strong>{" "}
                        {task.milestone?.name ??
                            task.milestone ??
                            "No milestone"}
                    </p>
                </div>
            </div>

            {task.description && (
                <div className="dashboard-card">
                    <h2>Description</h2>

                    <p>{task.description}</p>
                </div>
            )}

            <div className="dashboard-card">
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
                        <div>
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
                                                    key={
                                                        dependency._id
                                                    }
                                                >
                                                    <Link
                                                        to={`/app/projects/${projectId}/tasks/${dependency.fromTask._id}`}
                                                    >
                                                        {
                                                            dependency
                                                                .fromTask
                                                                .title
                                                        }
                                                    </Link>
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
                                                    key={
                                                        dependency._id
                                                    }
                                                >
                                                    <Link
                                                        to={`/app/projects/${projectId}/tasks/${dependency.toTask._id}`}
                                                    >
                                                        {
                                                            dependency
                                                                .toTask
                                                                .title
                                                        }
                                                    </Link>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                )}
                            </section>
                        </div>
                    )}
            </div>

            <div className="dashboard-card">
                <h2>Activity</h2>

                <p>
                    <strong>Created:</strong>{" "}
                    {formatDateTime(task.createdAt)}
                </p>

                <p>
                    <strong>Last updated:</strong>{" "}
                    {formatDateTime(task.updatedAt)}
                </p>

                <p>
                    <strong>Last activity:</strong>{" "}
                    {formatDateTime(task.lastActivityAt)}
                </p>

                <p>
                    <strong>Version:</strong>{" "}
                    {task.version ?? 0}
                </p>
            </div>
        </main>
    );
};

export default TaskDetailPage;