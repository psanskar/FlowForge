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

            <div className="empty-state">
                <h2>
                    No project selected
                </h2>

                <p>
                    Select a project to view its
                    execution health and risks.
                </p>
            </div>
        </section>
    );
};

export default OverviewPage;