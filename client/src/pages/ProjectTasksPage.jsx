import { useState } from "react";
import {
    Link,
    useNavigate,
    useParams,
    useSearchParams
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
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [assignee, setAssignee] = useState(
        () => searchParams.get("assignee") ?? ""
    );
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
        projectData?.data?.project ?? null;

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
        const nextAssignee = event.target.value;
        setAssignee(nextAssignee);
        setPage(1);
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);

            if (nextAssignee) {
                nextParams.set("assignee", nextAssignee);
            } else {
                nextParams.delete("assignee");
            }

            return nextParams;
        }, { replace: true });
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
        setSearchParams({}, { replace: true });
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
                    <span className="page-eyebrow">
                        {project?.name || "Project"} / Tasks
                    </span>
                    <h1>Project tasks</h1>
                    <p>
                        Find the work that needs attention and see who owns it.
                    </p>
                </div>

                <div className="task-page-actions">
                    <Link
                        className="secondary-button"
                        to={`/app/projects/${projectId}`}
                    >
                        Workspace
                    </Link>
                    <span className="task-total-count">
                        <strong>{pagination?.total ?? 0}</strong>
                        <span>tasks</span>
                    </span>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                `/app/projects/${projectId}/tasks/new`
                            )
                        }
                    >
                        Create task
                    </button>
                </div>
            </div>

            <div className="dashboard-card task-filter-card">
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
                <div className="dashboard-card task-results-card">
                    <div className="task-list">
                        {tasks.map((task) => {
                            const assigneeId =
                                task.assignee?._id ?? task.assignee;
                            const assigneeName = members.find(
                                (member) =>
                                    String(member.user?._id ?? member.user) ===
                                    String(assigneeId)
                            )?.user?.name;

                            return (
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
                                    <span className={`task-status-chip task-status-chip--${task.status}`}>
                                        {formatStatus(task.status)}
                                    </span>

                                    <span className={`task-priority-chip task-priority-chip--${task.priority}`}>
                                        {formatPriority(task.priority)} priority
                                    </span>

                                    <span>
                                        Progress:{" "}
                                        {task.progress ?? 0}%
                                    </span>

                                    <span>
                                        {assigneeName
                                            ? `Assigned to ${assigneeName}`
                                            : "Unassigned"}
                                    </span>

                                    <span>
                                        Due:{" "}
                                        {formatDate(
                                            task.dueDate
                                        )}
                                    </span>
                                </div>
                            </article>
                            );
                        })}
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