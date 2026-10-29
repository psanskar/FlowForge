import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import useCreateProject from "../hooks/useCreateProject";

const localDateValue = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    return new Date(today.getTime() - offset * 60_000)
        .toISOString()
        .slice(0, 10);
};

const CreateProjectPage = () => {
    const navigate = useNavigate();
    const createProject = useCreateProject();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState(localDateValue);
    const [targetDate, setTargetDate] = useState("");
    const [dateError, setDateError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setDateError("");

        if (startDate && targetDate && targetDate < startDate) {
            setDateError("Target date cannot be earlier than start date.");
            return;
        }

        try {
            const response = await createProject.mutateAsync({
                name: name.trim(),
                description: description.trim(),
                ...(startDate && { startDate }),
                ...(targetDate && { targetDate })
            });
            navigate(`/app/projects/${response.data.project._id}`, {
                replace: true
            });
        } catch {
            // The mutation error is rendered below.
        }
    };

    return (
        <main className="page-container">
            <div className="page-header">
                <div>
                    <p>Projects</p>
                    <h1>Create project</h1>
                    <p>Set the project context and target dates so FlowForge can track execution against the plan.</p>
                </div>
                <Link to="/app/projects">Back to projects</Link>
            </div>

            <form
                className="dashboard-card task-form"
                onSubmit={handleSubmit}
                aria-label="Create project form"
            >
                <div className="form-field">
                    <label htmlFor="project-name">Project name</label>
                    <input
                        id="project-name"
                        name="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={120}
                        placeholder="e.g. Website launch"
                        required
                        autoFocus
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="project-description">Description <span>(optional)</span></label>
                    <textarea
                        id="project-description"
                        name="description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="What is this project expected to deliver?"
                    />
                </div>

                <div className="task-form-grid">
                    <div className="form-field">
                        <label htmlFor="project-start-date">Start date <span>(optional)</span></label>
                        <input
                            id="project-start-date"
                            name="startDate"
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="project-target-date">Target date <span>(optional)</span></label>
                        <input
                            id="project-target-date"
                            name="targetDate"
                            type="date"
                            value={targetDate}
                            min={startDate || undefined}
                            onChange={(event) => setTargetDate(event.target.value)}
                        />
                    </div>
                </div>

                {(dateError || createProject.error) && (
                    <p className="auth-error" role="alert">
                        {dateError || createProject.error.message}
                    </p>
                )}

                <div className="task-form-actions">
                    <Link to="/app/projects">Cancel</Link>
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={createProject.isPending}
                    >
                        {createProject.isPending ? "Creating project…" : "Create project"}
                    </button>
                </div>
            </form>
        </main>
    );
};

export default CreateProjectPage;
