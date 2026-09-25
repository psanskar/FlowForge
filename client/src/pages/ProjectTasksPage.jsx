import { useState } from "react";
import {
    Link,
    useParams
} from "react-router-dom";

import useTasks from "../hooks/useTasks";
import useProject from "../hooks/useProject";

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
        return "No due date";
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

const ProjectTasksPage = () => {
    const { projectId } = useParams();

    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [assignee, setAssignee] = useState("");
    const [sort, setSort] = useState("dueDate");

    const {
        data: projectData,
        isLoading: isProjectLoading,
        isError: isProjectError
    } = useProject(projectId);

    const {
        data,
        isLoading: isTasksLoading,
        isError: isTasksError,
        error
    } = useTasks(projectId, {
        page,
        limit: 20,
        status,
        priority,
        assignee,
        sort
    });

    const tasks = data?.data?.tasks ?? [];

    const pagination =
        data?.data?.pagination ?? null;

    const project =
        projectData?.data ?? null;

    const members = project?.members ?? [];

    const handleStatusChange = (event) => {
        setStatus(event.target.value);
        setPage(1);
    };

    const handlePriorityChange = (event) => {
        setPriority(event.target.value);
        setPage(1);
    };

    const handleAssigneeChange = (event) => {
        setAssignee(event.target.value);
        setPage(1);
    };

    const handleSortChange = (event) => {
        setSort(event.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setStatus("");
        setPriority("");
        setAssignee("");
        setSort("dueDate");
        setPage(1);
    };

    const handlePreviousPage = () => {
        if (pagination?.hasPreviousPage) {
            setPage((currentPage) =>
                currentPage - 1
            );
        }
    };

    const handleNextPage = () => {
        if (pagination?.hasNextPage) {
            setPage((currentPage) =>
                currentPage + 1
            );
        }
    };

    if (
        isProjectLoading ||
        isTasksLoading
    ) {
        return (
            <main className="page-container">
                <p>Loading tasks...</p>
            </main>
        );
    }

    if (
        isProjectError ||
        isTasksError
    ) {
        return (
            <main className="page-container">
                <h1>Project Tasks</h1>

                <p>
                    {error?.message ??
                        "Unable to load tasks."}
                </p>
            </main>
        );
    }

    return (
        <main className="page-container">
            <div className="page-header">
                <div>
                    <h1>Project Tasks</h1>

                    <p>
                        View and monitor tasks for
                        this project.
                    </p>
                </div>

                <div>
                    <strong>
                        {pagination?.total ?? 0}
                    </strong>

                    <span>
                        {" "}
                        total tasks
                    </span>
                </div>
            </div>

            <div className="dashboard-card">
                <div className="task-filters">
                    <div>
                        <label htmlFor="task-status">
                            Status
                        </label>

                        <select
                            id="task-status"
                            value={status}
                            onChange={
                                handleStatusChange
                            }
                        >
                            <option value="">
                                All statuses
                            </option>

                            <option value="todo">
                                To Do
                            </option>

                            <option value="in_progress">
                                In Progress
                            </option>

                            <option value="blocked">
                                Blocked
                            </option>

                            <option value="completed">
                                Completed
                            </option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="task-priority">
                            Priority
                        </label>

                        <select
                            id="task-priority"
                            value={priority}
                            onChange={
                                handlePriorityChange
                            }
                        >
                            <option value="">
                                All priorities
                            </option>

                            <option value="low">
                                Low
                            </option>

                            <option value="medium">
                                Medium
                            </option>

                            <option value="high">
                                High
                            </option>

                            <option value="critical">
                                Critical
                            </option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="task-assignee">
                            Assignee
                        </label>

                        <select
                            id="task-assignee"
                            value={assignee}
                            onChange={
                                handleAssigneeChange
                            }
                        >
                            <option value="">
                                All assignees
                            </option>

                            {members.map((member) => (
                                <option
                                    key={
                                        member.user?._id ??
                                        member.user
                                    }
                                    value={
                                        member.user?._id ??
                                        member.user
                                    }
                                >
                                    {member.user?.name ??
                                        member.name ??
                                        "Unknown user"}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="task-sort">
                            Sort
                        </label>

                        <select
                            id="task-sort"
                            value={sort}
                            onChange={
                                handleSortChange
                            }
                        >
                            <option value="dueDate">
                                Due date
                            </option>

                            <option value="createdAt">
                                Created date
                            </option>

                            <option value="updatedAt">
                                Updated date
                            </option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleResetFilters}
                    >
                        Reset
                    </button>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="dashboard-card">
                    <h2>No tasks found</h2>

                    <p>
                        This project does not have
                        any tasks matching the
                        current filters.
                    </p>
                </div>
            ) : (
                <div className="dashboard-card">
                    <div className="task-list">
                        {tasks.map((task) => (
                            <article
                                className="task-list-item"
                                key={task._id}
                            >
                                <div className="task-list-main">
                                    <h2>
                                        <Link
                                            to={`/app/tasks/${task._id}`}
                                        >
                                            {task.title}
                                        </Link>
                                    </h2>

                                    {task.description && (
                                        <p>
                                            {
                                                task.description
                                            }
                                        </p>
                                    )}
                                </div>

                                <div className="task-list-meta">
                                    <span>
                                        Status:{" "}
                                        {formatStatus(
                                            task.status
                                        )}
                                    </span>

                                    <span>
                                        Priority:{" "}
                                        {formatPriority(
                                            task.priority
                                        )}
                                    </span>

                                    <span>
                                        Progress:{" "}
                                        {task.progress ?? 0}%
                                    </span>

                                    <span>
                                        Due:{" "}
                                        {formatDate(
                                            task.dueDate
                                        )}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            {pagination &&
                pagination.totalPages > 1 && (
                    <div className="dashboard-card">
                        <div className="task-pagination">
                            <button
                                type="button"
                                onClick={
                                    handlePreviousPage
                                }
                                disabled={
                                    !pagination.hasPreviousPage
                                }
                            >
                                Previous
                            </button>

                            <span>
                                Page{" "}
                                {pagination.page}{" "}
                                of{" "}
                                {pagination.totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    handleNextPage
                                }
                                disabled={
                                    !pagination.hasNextPage
                                }
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
        </main>
    );
};

export default ProjectTasksPage;