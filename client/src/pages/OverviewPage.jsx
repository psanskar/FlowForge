import { Link } from "react-router-dom";

const OverviewPage = () => {
    return (
        <section className="page-section">
            <div className="page-heading">
                <div>
                    <span className="page-eyebrow">
                        Overview
                    </span>

                    <h1>
                        Project execution
                    </h1>

                    <p>
                        Monitor project health,
                        execution risks, and the
                        signals that need attention.
                    </p>
                </div>
            </div>

            <div className="overview-start-card">
                <div className="overview-start-mark" aria-hidden="true">
                    ↗
                </div>
                <div>
                    <span className="page-eyebrow">Start with a project</span>
                    <h2>Bring execution signals into view</h2>
                    <p>
                        Open a project to review health, overdue work, blockers,
                        contributor workload, milestones, and connected GitHub activity.
                    </p>
                </div>
                <Link className="primary-button" to="/app/projects">
                    Browse projects <span aria-hidden="true">→</span>
                </Link>
            </div>
        </section>
    );
};

export default OverviewPage;