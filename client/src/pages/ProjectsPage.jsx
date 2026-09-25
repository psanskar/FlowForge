import { useNavigate } from "react-router-dom";

import useProjects from "../hooks/useProjects";

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

                <button
                    type="button"
                    className="primary-button"
                >
                    Create project
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="empty-state">
                    <h2>
                        No projects yet
                    </h2>

                    <p>
                        Create your first FlowForge
                        project to start monitoring
                        execution.
                    </p>
                </div>
            ) : (
                <div className="project-list">
                    {projects.map((project) => (
                        <button
                            key={project._id}
                            type="button"
                            className="project-card"
                            onClick={() =>
                                handleProjectClick(
                                    project._id
                                )
                            }
                        >
                            <div>
                                <h2>
                                    {project.name}
                                </h2>

                                {project.description && (
                                    <p>
                                        {
                                            project.description
                                        }
                                    </p>
                                )}
                            </div>

                            <span className="project-status">
                                {project.status}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ProjectsPage;