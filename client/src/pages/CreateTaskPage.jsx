import { useState } from "react";
import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import useProject from "../hooks/useProject";
import useCreateTask from "../hooks/useCreateTask";

const CreateTaskPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const {
        data: projectData,
        isLoading: isProjectLoading,
        isError: isProjectError,
        error: projectError
    } = useProject(projectId);

    const {
        mutateAsync: createTask,
        isPending
    } = useCreateTask(projectId);

    const project = projectData?.data ?? null;
    const members = project?.members ?? [];

    const [title, setTitle] = useState("");
    const [description, setDescription] =
        useState("");
    const [status, setStatus] =
        useState("todo");
    const [priority, setPriority] =
        useState("medium");
    const [assignee, setAssignee] =
        useState("");
    const [dueDate, setDueDate] =
        useState("");
    const [progress, setProgress] =
        useState("0");
    const [formError, setFormError] =
        useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        try {
            const payload = {
                title: title.trim(),
                description: description.trim(),
                status,
                priority,
                progress: Number(progress)
            };

            if (assignee) {
                payload.assignee = assignee;
            }

            if (dueDate) {
                payload.dueDate = dueDate;
            }

            await createTask(payload);

            navigate(
                `/app/projects/${projectId}/tasks`
            );
        } catch (error) {
            setFormError(
                error?.message ??
                    "Unable to create the task."
            );
        }
    };

    if (isProjectLoading) {
        return (
            <main className="page-container">
                <p>Loading project...</p>
            </main>
        );
    }

    if (isProjectError || !project) {
        return (
            <main className="page-container">
                <h1>Create Task</h1>

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

                    <h1>Create Task</h1>

                    <p>
                        Add a new task to{" "}
                        <strong>
                            {project.name}
                        </strong>
                        .
                    </p>
                </div>

                <Link
                    to={
                        `/app/projects/${projectId}/tasks`
                    }
                >
                    Back to tasks
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
                        value={title}
                        onChange={(event) =>
                            setTitle(
                                event.target.value
                            )
                        }
                        required
                        maxLength={200}
                        placeholder="Enter task title"
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="task-description">
                        Description
                    </label>

                    <textarea
                        id="task-description"
                        value={description}
                        onChange={(event) =>
                            setDescription(
                                event.target.value
                            )
                        }
                        rows={5}
                        maxLength={5000}
                        placeholder="Describe the work to be completed"
                    />
                </div>

                <div className="task-form-grid">
                    <div className="form-field">
                        <label htmlFor="task-status">
                            Status
                        </label>

                        <select
                            id="task-status"
                            value={status}
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
                            value={priority}
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
                            value={assignee}
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
                            value={dueDate}
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
                            value={progress}
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
                            `/app/projects/${projectId}/tasks`
                        }
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={
                            isPending ||
                            !title.trim()
                        }
                    >
                        {isPending
                            ? "Creating..."
                            : "Create task"}
                    </button>
                </div>
            </form>
        </main>
    );
};

export default CreateTaskPage;
