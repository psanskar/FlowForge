import { useEffect, useState } from "react";
import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import useTask from "../hooks/useTask";
import useProject from "../hooks/useProject";
import useUpdateTask from "../hooks/useUpdateTask";

const toDateInputValue = (date) => {
    if (!date) {
        return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toISOString().slice(0, 10);
};

const EditTaskPage = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();

    const {
        data: taskData,
        isLoading: isTaskLoading,
        isError: isTaskError,
        error: taskError
    } = useTask(taskId);

    const task = taskData?.data?.task ?? null;

    const projectId =
        typeof task?.project === "object"
            ? task.project?._id
            : task?.project;

    const {
        data: projectData,
        isLoading: isProjectLoading,
        isError: isProjectError,
        error: projectError
    } = useProject(projectId);

    const {
        mutateAsync: updateTask,
        isPending
    } = useUpdateTask(taskId);

    const project = projectData?.data ?? null;
    const members = project?.members ?? [];

    const [title, setTitle] = useState(null);
    const [description, setDescription] =
        useState(null);
    const [status, setStatus] = useState(null);
    const [priority, setPriority] = useState(null);
    const [assignee, setAssignee] = useState(null);
    const [dueDate, setDueDate] = useState(null);
    const [progress, setProgress] = useState(null);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!task || title !== null) {
            return;
        }

        setTitle(task.title ?? "");
        setDescription(task.description ?? "");
        setStatus(task.status ?? "todo");
        setPriority(task.priority ?? "medium");
        setAssignee(
            typeof task.assignee === "object"
                ? task.assignee?._id ?? ""
                : task.assignee ?? ""
        );
        setDueDate(toDateInputValue(task.dueDate));
        setProgress(String(task.progress ?? 0));
    }, [task, title]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        try {
            const payload = {
                version: task.version,
                title: title.trim(),
                description: description.trim(),
                status,
                priority,
                progress: Number(progress),
                assignee: assignee || null,
                dueDate: dueDate || null
            };

            await updateTask(payload);

            navigate(
                `/app/tasks/${taskId}`
            );
        } catch (error) {
            if (
                error?.code ===
                "TASK_VERSION_CONFLICT"
            ) {
                setFormError(
                    "This task was modified by another user. Reload the task and review the latest changes before editing it again."
                );
                return;
            }

            setFormError(
                error?.message ??
                    "Unable to update the task."
            );
        }
    };

    if (
        isTaskLoading ||
        isProjectLoading
    ) {
        return (
            <main className="page-container">
                <p>Loading task...</p>
            </main>
        );
    }

    if (
        isTaskError ||
        !task
    ) {
        return (
            <main className="page-container">
                <h1>Edit Task</h1>

                <p>
                    {taskError?.message ??
                        "Unable to load this task."}
                </p>

                <Link to="/app/projects">
                    Back to projects
                </Link>
            </main>
        );
    }

    if (
        isProjectError ||
        !project
    ) {
        return (
            <main className="page-container">
                <h1>Edit Task</h1>

                <p>
                    {projectError?.message ??
                        "Unable to load this project."}
                </p>

                <Link
                    to={
                        `/app/projects/${projectId}/tasks`
                    }
                >
                    Back to tasks
                </Link>
            </main>
        );
    }

    return (
        <main className="page-container">
            <div className="page-header">
                <div>
                    <p>Project task</p>

                    <h1>Edit Task</h1>

                    <p>
                        Update{" "}
                        <strong>
                            {task.title}
                        </strong>
                        .
                    </p>
                </div>

                <Link
                    to={
                        `/app/tasks/${taskId}`
                    }
                >
                    Back to task
                </Link>
            </div>

            <form
                className="dashboard-card task-form"
                onSubmit={handleSubmit}
            >
                <div className="form-field">
                    <label htmlFor="task-title">
                        Title
                    </label>

                    <input
                        id="task-title"
                        type="text"
                        value={title ?? ""}
                        onChange={(event) =>
                            setTitle(
                                event.target.value
                            )
                        }
                        required
                        maxLength={200}
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="task-description">
                        Description
                    </label>

                    <textarea
                        id="task-description"
                        value={description ?? ""}
                        onChange={(event) =>
                            setDescription(
                                event.target.value
                            )
                        }
                        rows={5}
                        maxLength={5000}
                    />
                </div>

                <div className="task-form-grid">
                    <div className="form-field">
                        <label htmlFor="task-status">
                            Status
                        </label>

                        <select
                            id="task-status"
                            value={status ?? "todo"}
                            onChange={(event) =>
                                setStatus(
                                    event.target.value
                                )
                            }
                        >
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

                    <div className="form-field">
                        <label htmlFor="task-priority">
                            Priority
                        </label>

                        <select
                            id="task-priority"
                            value={priority ?? "medium"}
                            onChange={(event) =>
                                setPriority(
                                    event.target.value
                                )
                            }
                        >
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

                    <div className="form-field">
                        <label htmlFor="task-assignee">
                            Assignee
                        </label>

                        <select
                            id="task-assignee"
                            value={assignee ?? ""}
                            onChange={(event) =>
                                setAssignee(
                                    event.target.value
                                )
                            }
                        >
                            <option value="">
                                Unassigned
                            </option>

                            {members.map((member) => {
                                const userId =
                                    member.user?._id ??
                                    member.user;

                                return (
                                    <option
                                        key={userId}
                                        value={userId}
                                    >
                                        {member.user?.name ??
                                            member.name ??
                                            "Unknown user"}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="form-field">
                        <label htmlFor="task-due-date">
                            Due date
                        </label>

                        <input
                            id="task-due-date"
                            type="date"
                            value={dueDate ?? ""}
                            onChange={(event) =>
                                setDueDate(
                                    event.target.value
                                )
                            }
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="task-progress">
                            Progress
                        </label>

                        <input
                            id="task-progress"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={progress ?? "0"}
                            onChange={(event) =>
                                setProgress(
                                    event.target.value
                                )
                            }
                        />
                    </div>
                </div>

                {formError && (
                    <p className="auth-error">
                        {formError}
                    </p>
                )}

                <div className="task-form-actions">
                    <Link
                        className="secondary-button"
                        to={
                            `/app/tasks/${taskId}`
                        }
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={
                            isPending ||
                            !(title ?? "").trim()
                        }
                    >
                        {isPending
                            ? "Saving..."
                            : "Save changes"}
                    </button>
                </div>
            </form>
        </main>
    );
};

export default EditTaskPage;
