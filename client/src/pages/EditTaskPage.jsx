import { useState } from "react";
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

    const project = projectData?.data?.project ?? null;
    const members = project?.members ?? [];

    const [formDraft, setFormDraft] = useState(null);
    const [formError, setFormError] = useState("");

    const formValues = formDraft ?? {
        title: task?.title ?? "",
        description: task?.description ?? "",
        status: task?.status ?? "todo",
        priority: task?.priority ?? "medium",
        assignee: typeof task?.assignee === "object"
            ? task.assignee?._id ?? ""
            : task?.assignee ?? "",
        dueDate: toDateInputValue(task?.dueDate),
        progress: String(task?.progress ?? 0)
    };

    const updateField = (field, value) => {
        setFormDraft((current) => ({
            ...(current ?? {
                title: task?.title ?? "",
                description: task?.description ?? "",
                status: task?.status ?? "todo",
                priority: task?.priority ?? "medium",
                assignee: typeof task?.assignee === "object"
                    ? task.assignee?._id ?? ""
                    : task?.assignee ?? "",
                dueDate: toDateInputValue(task?.dueDate),
                progress: String(task?.progress ?? 0)
            }),
            [field]: value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        try {
            const payload = {
                version: task.version,
                title: formValues.title.trim(),
                description: formValues.description.trim(),
                status: formValues.status,
                priority: formValues.priority,
                progress: Number(formValues.progress),
                assignee: formValues.assignee || null,
                dueDate: formValues.dueDate || null
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
            <main className="page-container task-form-page">
                <p>Loading task...</p>
            </main>
        );
    }

    if (
        isTaskError ||
        !task
    ) {
        return (
            <main className="page-container task-form-page">
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
            <main className="page-container task-form-page">
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
        <main className="page-container task-form-page">
            <div className="page-header task-form-heading">
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
                        value={formValues.title}
                        onChange={(event) =>
                            updateField(
                                "title",
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
                        value={formValues.description}
                        onChange={(event) =>
                            updateField(
                                "description",
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
                            value={formValues.status}
                            onChange={(event) =>
                                updateField(
                                    "status",
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
                            value={formValues.priority}
                            onChange={(event) =>
                                updateField(
                                    "priority",
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
                            value={formValues.assignee}
                            onChange={(event) =>
                                updateField(
                                    "assignee",
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
                            value={formValues.dueDate}
                            onChange={(event) =>
                                updateField(
                                    "dueDate",
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
                            value={formValues.progress}
                            onChange={(event) =>
                                updateField(
                                    "progress",
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
                            !formValues.title.trim()
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
