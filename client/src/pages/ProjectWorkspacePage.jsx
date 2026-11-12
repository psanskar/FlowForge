import { Link, useNavigate, useParams } from "react-router-dom";

import useProject from "../hooks/useProject";
import useProjectDashboard from "../hooks/useProjectDashboard";
import useHealthTrend from "../hooks/useHealthTrend";
import useProjectRealtime from "../hooks/useProjectRealtime";

const formatRiskType = (type) => {
    return type
        .replace(/^GITHUB_/, "GitHub ")
        .replace(/^TASK_/, "Task ")
        .replace(/^MILESTONE_/, "Milestone ")
        .replace(/^DEPENDENCY_/, "Dependency ")
        .replace(/^WORKLOAD_/, "Workload ")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
};

const formatTrendEvidence = (signal) => {
    const evidence = signal.evidence || {};
    const formatPercent = (ratio) => `${Math.round(ratio * 100)}%`;

    switch (signal.type) {
        case "HEALTH_DECLINING":
            return `Health score changed from ${evidence.previous} to ${evidence.current} (${evidence.change} points).`;
        case "BLOCKED_WORK_INCREASING":
        case "OVERDUE_WORK_INCREASING":
        case "RISK_EXPOSURE_INCREASING":
            return `Count increased from ${evidence.previous} to ${evidence.current} (+${evidence.change}).`;
        case "BLOCKED_WORK_RATIO_INCREASING":
        case "OVERDUE_WORK_RATIO_INCREASING":
            return `Share increased from ${formatPercent(evidence.previousRatio)} to ${formatPercent(evidence.currentRatio)} (+${(evidence.change * 100).toFixed(1)} percentage points).`;
        case "COMPLETION_VELOCITY_DECLINING":
        case "MILESTONE_PROGRESS_SLOWING":
            return `Average progress per snapshot fell from ${evidence.previousAverage.toFixed(2)} to ${evidence.recentAverage.toFixed(2)} (${Math.round(evidence.declineRatio * 100)}% decline).`;
        case "RISK_PERSISTENCE_INCREASING":
            return `${evidence.persistentRiskCount} active risks appeared in at least 3 detections; ${evidence.highPersistenceRiskCount} persisted for at least 5 detections.`;
        default:
            return "Execution data changed enough to trigger this trend signal.";
    }
};

const getTrendNextStep = (type) => {
    const actions = {
        HEALTH_DECLINING: "Review the highest-severity current risks and assign an owner and due date to each response.",
        BLOCKED_WORK_INCREASING: "Review blocked tasks and resolve the most common blocker first.",
        OVERDUE_WORK_INCREASING: "Reconfirm owners and dates for overdue work; adjust scope where the plan is no longer realistic.",
        BLOCKED_WORK_RATIO_INCREASING: "Remove blockers from unfinished work before adding more commitments.",
        OVERDUE_WORK_RATIO_INCREASING: "Re-plan the remaining overdue work and communicate a credible delivery date.",
        COMPLETION_VELOCITY_DECLINING: "Check aging in-progress tasks, review capacity, and reduce work in progress if needed.",
        MILESTONE_PROGRESS_SLOWING: "Review unfinished milestone tasks with their owners and revise the delivery plan.",
        RISK_EXPOSURE_INCREASING: "Prioritize newly elevated risks and agree on a mitigation owner for each.",
        RISK_PERSISTENCE_INCREASING: "Revisit repeated risks and decide whether to remove the blocker or change the mitigation plan."
    };

    return actions[type] || "Review the current project risks and agree on a next action.";
};

const formatDate = (date) => {
    if (!date) {
        return "No due date";
    }

    return new Date(date).toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
};

const formatSnapshotDate = (date) => {
    if (!date) {
        return "Unknown date";
    }

    return new Date(
        `${date}T00:00:00`
    ).toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
};

const getMilestoneProgress = (milestone) => {
    if (
        typeof milestone.progress === "number"
    ) {
        return milestone.progress;
    }

    if (
        typeof milestone.completionPercentage ===
            "number"
    ) {
        return milestone.completionPercentage;
    }

    if (
        typeof milestone.totalTasks ===
            "number" &&
        milestone.totalTasks > 0 &&
        typeof milestone.completedTasks ===
            "number"
    ) {
        return (
            (milestone.completedTasks /
                milestone.totalTasks) *
            100
        );
    }

    return 0;
};

const getHealthStatusClass = (status) => {
    if (!status) {
        return "";
    }

    return status
        .toLowerCase()
        .replaceAll("_", "-");
};

const HealthTrendSection = ({
    snapshots = [],
    signals = [],
    projectId
}) => {
    const sortedSnapshots = [
        ...snapshots
    ].sort(
        (first, second) =>
            new Date(
                first.snapshotDate
            ) -
            new Date(
                second.snapshotDate
            )
    );

    const latestSnapshot =
        sortedSnapshots[
            sortedSnapshots.length - 1
        ];

    if (!latestSnapshot) {
        return (
            <div className="dashboard-section">
                <div className="dashboard-section-header">
                    <h2>
                        Health trend
                    </h2>

                    <p>
                        Historical project health
                        snapshots captured over time.
                    </p>
                </div>

                <div className="dashboard-trend-empty">
                    No health snapshots are available
                    yet.
                </div>
            </div>
        );
    }

    const hasHistoricalTrend =
        sortedSnapshots.length >= 2;

    return (
        <div className="dashboard-section">
            <div className="dashboard-section-header">
                <h2>
                    Health trend
                </h2>

                <p>
                    Historical risk-adjusted project
                    health captured by the snapshot
                    pipeline.
                </p>
            </div>

            <div className="dashboard-trend-summary">
                <div className="dashboard-trend-latest">
                    <span className="dashboard-card-label">
                        Latest snapshot
                    </span>

                    <div className="dashboard-trend-score-row">
                        <strong>
                            {latestSnapshot.healthScore}
                        </strong>

                        <span
                            className={`dashboard-trend-status ${getHealthStatusClass(
                                latestSnapshot.healthStatus
                            )}`}
                        >
                            {latestSnapshot.healthStatus}
                        </span>
                    </div>

                    <p>
                        Captured on{" "}
                        {formatSnapshotDate(
                            latestSnapshot.snapshotDate
                        )}
                    </p>
                </div>

                <div className="dashboard-trend-stat">
                    <span className="dashboard-card-label">
                        High risks
                    </span>

                    <strong>
                        {
                            latestSnapshot
                                .riskCounts
                                ?.high ?? 0
                        }
                    </strong>
                </div>

                <div className="dashboard-trend-stat">
                    <span className="dashboard-card-label">
                        Medium risks
                    </span>

                    <strong>
                        {
                            latestSnapshot
                                .riskCounts
                                ?.medium ?? 0
                        }
                    </strong>
                </div>

                <div className="dashboard-trend-stat">
                    <span className="dashboard-card-label">
                        Completed tasks
                    </span>

                    <strong>
                        {
                            latestSnapshot
                                .taskSummary
                                ?.completedTasks ?? 0
                        }
                        /
                        {
                            latestSnapshot
                                .taskSummary
                                ?.totalTasks ?? 0
                        }
                    </strong>
                </div>
            </div>

            {hasHistoricalTrend ? (
                <div className="dashboard-trend-chart">
                    <div className="dashboard-trend-chart-header">
                        <span>
                            Health score history
                        </span>

                        <span>
                            {sortedSnapshots.length}{" "}
                            snapshots
                        </span>
                    </div>

                    <div className="dashboard-trend-points">
                        {sortedSnapshots.map(
                            (snapshot) => {
                                const score =
                                    Math.max(
                                        0,
                                        Math.min(
                                            100,
                                            Number(
                                                snapshot.healthScore
                                            ) || 0
                                        )
                                    );

                                return (
                                    <div
                                        key={
                                            snapshot._id ||
                                            snapshot.snapshotDate
                                        }
                                        className="dashboard-trend-point"
                                    >
                                        <div className="dashboard-trend-point-value">
                                            {score}
                                        </div>

                                        <div className="dashboard-trend-point-track">
                                            <div
                                                className="dashboard-trend-point-fill"
                                                style={{
                                                    height: `${score}%`
                                                }}
                                            />
                                        </div>

                                        <span>
                                            {formatSnapshotDate(
                                                snapshot.snapshotDate
                                            )}
                                        </span>
                                    </div>
                                );
                            }
                        )}
                    </div>
                </div>
            ) : (
                <div className="dashboard-trend-no-history">
                    <strong>
                        Historical trend will appear
                        after another snapshot.
                    </strong>

                    <p>
                        The system currently has one
                        snapshot, so showing a trend
                        line would be misleading. The
                        next scheduled snapshot will
                        provide another point for
                        comparison.
                    </p>
                </div>
            )}

            {signals.length > 0 && (
                <div className="dashboard-trend-signals">
                    <div className="dashboard-trend-signals-heading">
                        <div>
                            <h3>Execution changes to review</h3>
                            <p>These signals compare recent snapshots. Use the evidence to decide what needs attention.</p>
                        </div>
                        <span>{signals.length} signals</span>
                    </div>
                    <div className="dashboard-trend-signal-list">
                        {signals.map((signal) => (
                            <article
                                className="dashboard-trend-signal"
                                key={signal.type}
                            >
                                <div className="dashboard-trend-signal-title">
                                    <strong>{formatRiskType(signal.type)}</strong>
                                    <span className={`dashboard-risk-severity dashboard-risk-severity-${String(signal.severity || "medium").toLowerCase()}`}>
                                        {signal.severity}
                                    </span>
                                </div>
                                <p>{formatTrendEvidence(signal)}</p>
                                <div className="dashboard-trend-signal-action">
                                    <strong>Next step</strong>
                                    <span>{getTrendNextStep(signal.type)}</span>
                                </div>
                                <Link to={`/app/projects/${projectId}#execution-risks`}>
                                    Review current risks
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProjectWorkspacePage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();

    useProjectRealtime(projectId);

    const {
        data: projectData,
        isLoading: isProjectLoading,
        isError: isProjectError,
        error: projectError
    } = useProject(projectId);

    const {
        data: dashboardData,
        isLoading: isDashboardLoading,
        isError: isDashboardError,
        error: dashboardError
    } = useProjectDashboard(projectId);

    const {
        data: healthTrendData,
        isLoading: isHealthTrendLoading,
        isError: isHealthTrendError,
        error: healthTrendError
    } = useHealthTrend(
        projectId,
        30
    );

    const project =
        projectData?.data?.project;

    const dashboard =
        dashboardData?.data;

    const snapshots =
        healthTrendData?.data?.snapshots ||
        [];
    const trendSignals =
        healthTrendData?.data?.signals || [];

    if (
        isProjectLoading ||
        isDashboardLoading
    ) {
        return (
            <section className="page-section">
                <div className="empty-state">
                    <p>
                        Loading project workspace...
                    </p>
                </div>
            </section>
        );
    }

    if (isProjectError) {
        return (
            <section className="page-section">
                <div className="empty-state">
                    <h2>
                        Unable to load project
                    </h2>

                    <p>
                        {projectError?.message ||
                            "Something went wrong while loading the project."}
                    </p>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                "/app/projects"
                            )
                        }
                    >
                        Back to projects
                    </button>
                </div>
            </section>
        );
    }

    if (isDashboardError) {
        return (
            <section className="page-section">
                <div className="empty-state">
                    <h2>
                        Unable to load project dashboard
                    </h2>

                    <p>
                        {dashboardError?.message ||
                            "Something went wrong while loading project execution data."}
                    </p>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                "/app/projects"
                            )
                        }
                    >
                        Back to projects
                    </button>
                </div>
            </section>
        );
    }

    if (!project || !dashboard) {
        return (
            <section className="page-section">
                <div className="empty-state">
                    <h2>
                        Project data unavailable
                    </h2>

                    <p>
                        The project workspace could
                        not be loaded.
                    </p>
                </div>
            </section>
        );
    }

    const {
        health,
        taskSummary,
        milestones,
        topRisks,
        workload
    } = dashboard;

    const maxActiveTasks =
        workload?.reduce(
            (maximum, contributor) =>
                Math.max(
                    maximum,
                    contributor.activeTasks
                ),
            0
        ) || 0;
    const totalTasks = taskSummary?.totalTasks ?? 0;
    const completedTasks = taskSummary?.completedTasks ?? 0;
    const taskCompletion = totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;
    const healthScore = Number.isFinite(Number(health?.score))
        ? Math.min(100, Math.max(0, Number(health.score)))
        : 0;

    return (
        <section className="page-section workspace-page">
            <div className="page-heading workspace-heading">
                <div>
                    <span className="page-eyebrow">
                        Project workspace
                    </span>

                    <h1>
                        {project.name}
                    </h1>

                    <p>
                        {project.description ||
                            "No project description provided."}
                    </p>
                    <div className="workspace-heading-meta">
                        <span className="workspace-project-status">
                            {project.status || "Active"}
                        </span>
                        <span>Execution overview</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                        navigate(
                            "/app/projects"
                        )
                    }
                >
                    Back to projects
                </button>
            </div>

            <div className="dashboard-health-grid workspace-metrics">
                <div className="dashboard-card dashboard-health-card workspace-health-card">
                    <span className="dashboard-card-label">
                        Risk-adjusted health
                    </span>

                    <div className="workspace-health-content">
                        <div
                            className="workspace-health-ring"
                            style={{ "--health-score": `${healthScore}%` }}
                        >
                            <span>{health?.score ?? "—"}</span>
                        </div>
                        <div>
                            <span className="dashboard-health-status">
                                {health?.health ?? "Unknown"}
                            </span>
                            <p className="dashboard-stat-description">
                                Current execution signal
                            </p>
                        </div>
                    </div>
                </div>

                <div className="dashboard-card">
                    <span className="dashboard-card-label">
                        Tasks
                    </span>

                    <p className="dashboard-stat-value">
                        {taskSummary?.totalTasks ??
                            0}
                    </p>

                    <p className="dashboard-stat-description">
                        {completedTasks} completed ·{" "}
                        {taskSummary?.blockedTasks ?? 0} blocked
                    </p>
                    <div
                        className="workspace-task-progress"
                        aria-label={`${taskCompletion}% of tasks completed`}
                    >
                        <span style={{ width: `${taskCompletion}%` }} />
                    </div>
                </div>

                <div className="dashboard-card">
                    <span className="dashboard-card-label">
                        Milestones
                    </span>

                    <p className="dashboard-stat-value">
                        {milestones?.length ??
                            0}
                    </p>

                    <p className="dashboard-stat-description">
                        Project milestones
                    </p>
                </div>

                <div className="dashboard-card">
                    <span className="dashboard-card-label">
                        Contributors
                    </span>

                    <p className="dashboard-stat-value">
                        {workload?.length ??
                            0}
                    </p>

                    <p className="dashboard-stat-description">
                        Active contributors
                    </p>
                </div>
            </div>

            <HealthTrendSection
                snapshots={snapshots}
                signals={trendSignals}
                projectId={projectId}
            />

            {isHealthTrendError && (
                <div className="dashboard-trend-error">
                    Unable to load historical health
                    snapshots:{" "}
                    {healthTrendError?.message ||
                        "Something went wrong."}
                </div>
            )}

            {isHealthTrendLoading && (
                <div className="dashboard-section">
                    <div className="dashboard-trend-loading">
                        Loading health history...
                    </div>
                </div>
            )}

            <div
                className="dashboard-section workspace-risk-section"
                id="execution-risks"
            >
                <div className="dashboard-section-header">
                    <div>
                        <h2>Execution risks</h2>

                        <p>
                            The most significant signals detected in the current project state.
                        </p>
                    </div>
                    <span className="workspace-risk-count">
                        {topRisks?.length ?? 0} signals
                    </span>
                </div>

                {topRisks?.length ? (
                    <div className="dashboard-risk-list">
                        {topRisks.map((risk) => (
                            <article
                                key={risk.id}
                                className={`dashboard-risk-card workspace-risk-card workspace-risk-${String(risk.severity || "low").toLowerCase()}`}
                            >
                                <div className="dashboard-risk-header">
                                    <span className="dashboard-risk-type">
                                        {formatRiskType(
                                            risk.type
                                        )}
                                    </span>

                                    <span className="dashboard-risk-severity">
                                        {risk.severity}
                                    </span>
                                </div>

                                <p className="dashboard-risk-message">
                                    {risk.message}
                                </p>

                                {risk.context && (
                                    <p className="dashboard-risk-context">
                                        <strong>{risk.context.label}:</strong>{" "}
                                        {risk.context.title || "Untitled"}
                                        {risk.context.owner && (
                                            <span> · Owner: {risk.context.owner}</span>
                                        )}
                                    </p>
                                )}

                                {risk.evidence
                                    ?.length > 0 && (
                                    <ul className="dashboard-risk-evidence">
                                        {risk.evidence.map(
                                            (
                                                evidence,
                                                index
                                            ) => (
                                                <li
                                                    key={`${risk.id}-evidence-${index}`}
                                                >
                                                    {
                                                        evidence
                                                    }
                                                </li>
                                            )
                                        )}
                                    </ul>
                                )}

                                {risk.nextAction && (
                                    <div className="dashboard-risk-next-action">
                                        <div>
                                            <strong>Suggested next step</strong>
                                            <p>{risk.nextAction.description}</p>
                                        </div>
                                        {risk.nextAction.href && (
                                            risk.nextAction.external ? (
                                                <a
                                                    className="dashboard-risk-action-link"
                                                    href={risk.nextAction.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {risk.nextAction.label}
                                                    <span aria-hidden="true">↗</span>
                                                </a>
                                            ) : (
                                                <Link
                                                    className="dashboard-risk-action-link"
                                                    to={risk.nextAction.href}
                                                >
                                                    {risk.nextAction.label}
                                                    <span aria-hidden="true">→</span>
                                                </Link>
                                            )
                                        )}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="dashboard-risk-empty">
                        No active risk signals detected.
                    </div>
                )}
            </div>

            <div className="dashboard-section" id="milestones">
                <div className="dashboard-section-header">
                    <h2>
                        Milestone progress
                    </h2>

                    <p>
                        Track progress toward the
                        project's major delivery points.
                    </p>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate(`/app/projects/${projectId}/milestones/new`)}
                    >
                        Create milestone
                    </button>
                </div>

                {milestones?.length ? (
                    <div className="dashboard-milestone-list">
                        {milestones.map(
                            (milestone) => {
                                const progress =
                                    Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            getMilestoneProgress(
                                                milestone
                                            )
                                        )
                                    );

                                return (
                                    <article
                                        key={
                                            milestone.id ||
                                            milestone._id
                                        }
                                        className="dashboard-milestone-card"
                                    >
                                        <div className="dashboard-milestone-header">
                                            <h3 className="dashboard-milestone-name">
                                                {
                                                    milestone.name
                                                }
                                            </h3>

                                            <span className="dashboard-milestone-date">
                                                {formatDate(
                                                    milestone.dueDate
                                                )}
                                            </span>
                                        </div>

                                        <div className="dashboard-milestone-meta">
                                            <span>
                                                {Math.round(
                                                    progress
                                                )}
                                                % complete
                                            </span>

                                            {milestone.totalTasks !==
                                                undefined && (
                                                <span>
                                                    {
                                                        milestone.completedTasks
                                                    }{" "}
                                                    /{" "}
                                                    {
                                                        milestone.totalTasks
                                                    }{" "}
                                                    tasks
                                                </span>
                                            )}
                                        </div>

                                        <div className="dashboard-milestone-progress">
                                            <div
                                                className="dashboard-milestone-progress-bar"
                                                style={{
                                                    width: `${progress}%`
                                                }}
                                            />
                                        </div>
                                    </article>
                                );
                            }
                        )}
                    </div>
                ) : (
                    <div className="dashboard-milestone-empty">
                        No milestones have been created
                        for this project.
                    </div>
                )}
            </div>

            <div className="dashboard-section">
                <div className="dashboard-section-header">
                    <h2>
                        Workload
                    </h2>

                    <p>
                        Active unfinished work assigned
                        to each contributor.
                    </p>
                </div>

                {workload?.length ? (
                    <div className="dashboard-workload-list">
                        {workload.map(
                            (contributor) => {
                                const percentage =
                                    maxActiveTasks >
                                    0
                                        ? (
                                              contributor.activeTasks /
                                              maxActiveTasks
                                          ) *
                                          100
                                        : 0;

                                return (
                                    <article
                                        key={
                                            contributor.userId
                                        }
                                        className="dashboard-workload-card"
                                    >
                                        <div className="dashboard-workload-header">
                                            <span className="dashboard-workload-name">
                                                {
                                                    contributor.name
                                                }
                                            </span>

                                            <span className="dashboard-workload-count">
                                                {
                                                    contributor.activeTasks
                                                }{" "}
                                                active{" "}
                                                {contributor.activeTasks ===
                                                1
                                                    ? "task"
                                                    : "tasks"}
                                            </span>
                                        </div>

                                        <div className="dashboard-workload-bar">
                                            <div
                                                className="dashboard-workload-bar-fill"
                                                style={{
                                                    width: `${percentage}%`
                                                }}
                                            />
                                        </div>
                                    </article>
                                );
                            }
                        )}
                    </div>
                ) : (
                    <div className="dashboard-workload-empty">
                        No active assigned work is currently
                        recorded.
                    </div>
                )}
            </div>
        </section>
    );
};

export default ProjectWorkspacePage;
