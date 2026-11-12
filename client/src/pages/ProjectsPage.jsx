import { useNavigate } from "react-router-dom";

import useProjects from "../hooks/useProjects";

const formatProjectDate = (date) => {
    if (!date) return null;

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date(date));
};

const ProjectsPage = () => {
    const navigate = useNavigate();

    const {
        data,
        isLoading,
        isError,
        error
    } = useProjects();

    const projects = data?.data?.projects || [];

    const handleProjectClick = (projectId) => {
        navigate(`/app/projects/${projectId}`);
    };

    if (isLoading) {
        return (
            <section className="page-section">
                <div className="page-heading">
                    <div>
                        <span className="page-eyebrow">
                            Projects
                        </span>

                        <h1>
                            Your projects
                        </h1>

                        <p>
                            Select a project to inspect
                            its execution status and
                            risks.
                        </p>
                    </div>
                </div>

                <div className="empty-state">
                    <p>
                        Loading projects...
                    </p>
                </div>
            </section>
        );
    }

    if (isError) {
        return (
            <section className="page-section">
                <div className="page-heading">
                    <div>
                        <span className="page-eyebrow">
                            Projects
                        </span>

                        <h1>
                            Your projects
                        </h1>
                    </div>
                </div>

                <div className="empty-state">
                    <h2>
                        Unable to load projects
                    </h2>

                    <p>
                        {error?.message ||
                            "Something went wrong while loading your projects."}
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="page-section projects-page">
            <div className="page-heading">
                <div>
                    <span className="page-eyebrow">
                        Projects
                    </span>

                    <h1>
                        Your projects
                    </h1>

                    <p>
                        Select a project to inspect
                        its execution status and
                        risks.
                    </p>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() => navigate("/app/projects/new")}
                >
                    Create project
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="empty-state projects-empty-state">
                    <div
                        className="projects-empty-mark"
                        aria-hidden="true"
                    >
                        ＋
                    </div>
                    <h2>
                        No projects yet
                    </h2>

                    <p>
                        Create your first FlowForge
                        project to start monitoring
                        execution.
                    </p>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate("/app/projects/new")}
                    >
                        Create your first project
                    </button>
                </div>
            ) : (
                <div className="project-list-wrap">
                    <div className="projects-list-heading">
                        <div>
                            <h2>Your workspace</h2>
                            <p>
                                Open a project to review progress and emerging risks.
                            </p>
                        </div>
                        <span>{projects.length} shown</span>
                    </div>
                    <div className="project-list">
                        {projects.map((project) => (
                            <button
                                key={project._id}
                                type="button"
                                className="project-card"
                                onClick={() =>
                                    handleProjectClick(project._id)
                                }
                            >
                                <span
                                    className="project-card-mark"
                                    aria-hidden="true"
                                >
                                    {project.name?.trim()?.charAt(0)?.toUpperCase() || "P"}
                                </span>
                                <div className="project-card-copy">
                                    <div className="project-card-title-row">
                                        <h2>{project.name}</h2>
                                        <span
                                            className={`project-status project-status-${String(project.status || "planning").toLowerCase()}`}
                                        >
                                            {project.status || "planning"}
                                        </span>
                                    </div>
                                    <p>
                                        {project.description || "No description added yet."}
                                    </p>
                                    <span className="project-card-date">
                                        {project.targetDate
                                            ? `Target date ${formatProjectDate(project.targetDate)}`
                                            : "Execution overview"}
                                    </span>
                                </div>
                                <span
                                    className="project-card-arrow"
                                    aria-hidden="true"
                                >
                                    →
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

export default ProjectsPage;
