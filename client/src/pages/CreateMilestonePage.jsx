import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import useCreateMilestone from "../hooks/useCreateMilestone";
import useProject from "../hooks/useProject";

const CreateMilestonePage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { data: projectResponse, isLoading, error } = useProject(projectId);
    const { mutateAsync: createMilestone, isPending } = useCreateMilestone(projectId);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [formError, setFormError] = useState("");
    const project = projectResponse?.data;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");
        try {
            await createMilestone({
                name: name.trim(),
                description: description.trim(),
                dueDate
            });
            navigate(`/app/projects/${projectId}`);
        } catch (requestError) {
            setFormError(requestError?.message ?? "Unable to create the milestone.");
        }
    };

    if (isLoading) return <main className="page-container"><p>Loading project...</p></main>;
    if (!project) return <main className="page-container"><h1>Create milestone</h1><p>{error?.message ?? "Unable to load this project."}</p><Link to={`/app/projects/${projectId}`}>Back to project</Link></main>;

    return (
        <main className="page-container">
            <div className="page-header">
                <div><p>Project milestone</p><h1>Create milestone</h1><p>Add a delivery point to <strong>{project.name}</strong>.</p></div>
                <Link to={`/app/projects/${projectId}`}>Back to project</Link>
            </div>
            <form className="dashboard-card task-form" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="milestone-name">Milestone name</label>
                    <input id="milestone-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} placeholder="e.g. Beta release" />
                </div>
                <div className="form-field">
                    <label htmlFor="milestone-description">Description (optional)</label>
                    <textarea id="milestone-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} placeholder="What will be delivered?" />
                </div>
                <div className="form-field">
                    <label htmlFor="milestone-due-date">Due date</label>
                    <input id="milestone-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
                </div>
                {formError && <p className="auth-error">{formError}</p>}
                <div className="task-form-actions">
                    <Link className="secondary-button" to={`/app/projects/${projectId}`}>Cancel</Link>
                    <button className="primary-button" type="submit" disabled={isPending || !name.trim() || !dueDate}>{isPending ? "Creating..." : "Create milestone"}</button>
                </div>
            </form>
        </main>
    );
};

export default CreateMilestonePage;
