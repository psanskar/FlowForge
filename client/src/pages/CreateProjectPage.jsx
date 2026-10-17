import { useState } from "react";
import {
    Link,
    useNavigate
} from "react-router-dom";

import useCreateProject from "../hooks/useCreateProject";

const getErrorMessage = (error) => {
    const details = error?.data?.error?.details;
    const detailMessages = details
        ? Object.values(details).filter(
            (message) => typeof message === "string"
        )
        : [];

    return detailMessages.join(" ") ||
        error?.message ||
        "Unable to create the project.";
};

const CreateProjectPage = () => {
    const navigate = useNavigate();
    const {
        mutateAsync: createProject,
        isPending
    } = useCreateProject();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [formError, setFormError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        if (
            startDate &&
            targetDate &&
            targetDate < startDate
        ) {
            setFormError(
                "Target date cannot be earlier than start date."
            );
            return;
        }

        const payload = {
            name: name.trim(),
            description: description.trim()
        };

        if (startDate) {
            payload.startDate = startDate;
        }

        if (targetDate) {
            payload.targetDate = targetDate;
        }

        try {
            const result = await createProject(payload);
            const projectId = result?.data?.project?._id;

            if (!projectId) {
                setFormError(
                    "The project was created, but its details could not be loaded."
                );
                return;
            }

            navigate(
                `/app/projects/${projectId}`,
                { replace: true }
            );
        } catch (error) {
            setFormError(getErrorMessage(error));
        }
    };

    return (
        <main className="page-section">
            <div className="page-heading">
                <div>
                    <span className="page-eyebrow">
                        Projects
                    </span>

                    <h1>Create a project</h1>

                    <p>
                        Set the project scope and dates
                        so FlowForge can track its execution.
                    </p>
                </div>

                <Link
                    className="project-form-cancel"
                    to="/app/projects"
                >
                    Back to projects
                </Link>
            </div>

            <form
                className="dashboard-card project-form"
                onSubmit={handleSubmit}
            >
                <div className="form-field">
                    <label htmlFor="project-name">
                        Project name
                    </label>

                    <input
                        id="project-name"
                        type="text"
                        value={name}
                        onChange={(event) =>
                            setName(event.target.value)
                        }
                        required
                        maxLength={200}
                        autoFocus
                        placeholder="e.g. Website redesign"
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="project-description">
                        Description
                    </label>

                    <textarea
                        id="project-description"
                        value={description}
                        onChange={(event) =>
                            setDescription(event.target.value)
                        }
                        rows={4}
                        maxLength={5000}
                        placeholder="What is this project intended to achieve?"
                    />
                </div>

                <div className="project-form-grid">
                    <div className="form-field">
                        <label htmlFor="project-start-date">
                            Start date
                        </label>

                        <input
                            id="project-start-date"
                            type="date"
                            value={startDate}
                            onChange={(event) =>
                                setStartDate(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="project-target-date">
                            Target date
                        </label>

                        <input
                            id="project-target-date"
                            type="date"
                            value={targetDate}
                            onChange={(event) =>
                                setTargetDate(event.target.value)
                            }
                        />
                    </div>
                </div>

                {formError && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        {formError}
                    </p>
                )}

                <div className="project-form-actions">
                    <Link
                        className="project-form-cancel"
                        to="/app/projects"
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={
                            isPending ||
                            !name.trim()
                        }
                    >
                        {isPending
                            ? "Creating..."
                            : "Create project"}
                    </button>
                </div>
            </form>
        </main>
    );
};

export default CreateProjectPage;