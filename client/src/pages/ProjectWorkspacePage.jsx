import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import useProject from "../hooks/useProject";
import { useAuth } from "../hooks/useAuth";
import useProjectArchive from "../hooks/useProjectArchive";
import useProjectDashboard from "../hooks/useProjectDashboard";
import useProjectMilestones from "../hooks/useProjectMilestones";
import useHealthTrend from "../hooks/useHealthTrend";
import useProjectRealtime from "../hooks/useProjectRealtime";
import ProjectMembersMenu from "../components/ProjectMembersMenu";
import {
    useConnectGithubRepository,
    useGithubMetrics,
    useGithubRepository
} from "../hooks/useGithubIntegration";

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
        .replace(/[\s_]+/g, "-");
};

const groupRiskSignals = (risks = []) => {
    const groups = new Map();

    risks.forEach((risk) => {
        const key = risk.type || risk.id;
        const group = groups.get(key) || [];
        group.push(risk);
        groups.set(key, group);
    });

    return Array.from(groups, ([type, signalsForType]) => ({
        type,
        risks: signalsForType
    }));
};

const HealthTrendSection = ({
    snapshots = [],
    signals = [],
    projectId,
    isLoading = false,
    error
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
            <div className="dashboard-section workspace-trend-section">
                <div className="dashboard-section-header">
                    <h2>
                        Health trend
                    </h2>

                    <p>
                        Health scores from scheduled snapshots.
                    </p>
                </div>

                {error ? (
                    <div className="dashboard-trend-empty workspace-trend-empty workspace-trend-empty-error" role="alert">
                        Unable to load health history: {error.message || "Something went wrong."}
                    </div>
                ) : isLoading ? (
                    <div className="dashboard-trend-empty workspace-trend-empty">
                        Loading health history…
                    </div>
                ) : (
                    <div className="dashboard-trend-empty workspace-trend-empty">
                        <svg viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M7 37h34M10 31l9-9 7 5 12-15" />
                            <circle cx="10" cy="31" r="2" />
                            <circle cx="19" cy="22" r="2" />
                            <circle cx="26" cy="27" r="2" />
                            <circle cx="38" cy="12" r="2" />
                        </svg>
                        <div>
                            <strong>Health history starts with the first snapshot</strong>
                            <p>Live health is shown above. The trend appears after at least two scheduled snapshots.</p>
                        </div>
                        <span>Awaiting history</span>
                    </div>
                )}
            </div>
        );
    }

    const hasHistoricalTrend =
        sortedSnapshots.length >= 2;

    return (
        <div className="dashboard-section workspace-trend-section">
            <div className="dashboard-section-header">
                <h2>
                    Health trend
                </h2>

                <p>
                    Risk-adjusted health across scheduled snapshots.
                </p>
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

                    <div className="dashboard-trend-line-wrap">
                        <div className="dashboard-trend-axis-labels" aria-hidden="true">
                            <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                        </div>
                        <svg
                            className="dashboard-trend-line"
                            viewBox="0 0 1000 200"
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`Project health trend across ${sortedSnapshots.length} snapshots`}
                        >
                            {[0, 25, 50, 75, 100].map((value) => {
                                const y = 190 - value * 1.6;
                                return <line key={value} x1="28" x2="972" y1={y} y2={y} className="dashboard-trend-gridline" />;
                            })}
                            <polyline
                                className="dashboard-trend-polyline"
                                points={sortedSnapshots.map((snapshot, index) => {
                                    const score = Math.max(0, Math.min(100, Number(snapshot.healthScore) || 0));
                                    const x = 28 + (index * 944) / Math.max(1, sortedSnapshots.length - 1);
                                    const y = 190 - score * 1.6;
                                    return `${x},${y}`;
                                }).join(" ")}
                            />
                            {sortedSnapshots.map((snapshot, index) => {
                                const score = Math.max(0, Math.min(100, Number(snapshot.healthScore) || 0));
                                const x = 28 + (index * 944) / Math.max(1, sortedSnapshots.length - 1);
                                const y = 190 - score * 1.6;
                                return (
                                    <circle key={snapshot._id || snapshot.snapshotDate} cx={x} cy={y} r="5" className="dashboard-trend-dot">
                                        <title>{`${formatSnapshotDate(snapshot.snapshotDate)}: ${score}`}</title>
                                    </circle>
                                );
                            })}
                        </svg>
                    </div>
                    <div className="dashboard-trend-date-labels">
                        {sortedSnapshots.map((snapshot) => (
                            <span key={snapshot._id || snapshot.snapshotDate}>{formatSnapshotDate(snapshot.snapshotDate)}</span>
                        ))}
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

const formatGithubCycleTime = (hours) => {
    if (hours === null || hours === undefined) {
        return "—";
    }

    return hours >= 24
        ? `${(hours / 24).toFixed(1)}d`
        : `${hours.toFixed(1)}h`;
};

const GithubIntegrationSection = ({ projectId, readOnly = false }) => {
    const [owner, setOwner] = useState("");
    const [repo, setRepo] = useState("");
    const repositoryQuery = useGithubRepository(projectId);
    const repository = repositoryQuery.data;
    const metricsQuery = useGithubMetrics(
        projectId,
        Boolean(repository)
    );
    const connectRepository = useConnectGithubRepository(projectId);

    const handleConnect = (event) => {
        event.preventDefault();
        connectRepository.mutate({
            owner: owner.trim(),
            repo: repo.trim()
        });
    };

    const metrics = metricsQuery.data;
    const recordedActivity = metrics
        ? (metrics.pullRequests?.open ?? 0) +
          (metrics.pullRequests?.opened ?? 0) +
          (metrics.pullRequests?.merged ?? 0) +
          (metrics.issues?.opened ?? 0) +
          (metrics.issues?.closed ?? 0) +
          (metrics.commits?.count ?? 0)
        : 0;

    return (
        <section
            className="dashboard-section workspace-github-section"
            id="github-integration"
        >
            <div className="dashboard-section-header workspace-github-header">
                <div>
                    <h2>GitHub integration</h2>
                    <p>Repository activity and pull request flow</p>
                </div>
                {repository && (
                    <span className="workspace-project-status">Connected</span>
                )}
            </div>

            {repositoryQuery.isLoading ? (
                <div className="workspace-github-empty">Checking repository connection…</div>
            ) : repositoryQuery.isError ? (
                <div className="workspace-github-empty workspace-github-error">
                    Unable to load the GitHub connection: {repositoryQuery.error?.message || "Please try again."}
                </div>
            ) : repository ? (
                <>
                    <div className="workspace-github-repository">
                        <div>
                            <a
                                href={`https://github.com/${repository.fullName}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {repository.fullName}
                            </a>
                            <span>Default branch: {repository.defaultBranch}</span>
                        </div>
                        <span className="workspace-github-visibility">
                            {repository.private ? "Private" : "Public"}
                        </span>
                    </div>

                    {metricsQuery.isLoading ? (
                        <div className="workspace-github-empty">Loading the last 30 days…</div>
                    ) : metricsQuery.isError ? (
                        <div className="workspace-github-empty workspace-github-error">
                            Unable to load GitHub metrics: {metricsQuery.error?.message || "Please try again."}
                        </div>
                    ) : (
                        <>
                            <div className="workspace-github-metrics">
                                <article>
                                    <span>Open PRs</span>
                                    <strong>{metrics.pullRequests?.open ?? 0}</strong>
                                </article>
                                <article>
                                    <span>Merged · 30d</span>
                                    <strong>{metrics.pullRequests?.merged ?? 0}</strong>
                                </article>
                                <article>
                                    <span>Median merge time</span>
                                    <strong>{formatGithubCycleTime(metrics.pullRequests?.medianCycleTimeHours)}</strong>
                                </article>
                                <article>
                                    <span>Commits · 30d</span>
                                    <strong>{metrics.commits?.count ?? 0}</strong>
                                </article>
                            </div>
                            <div className="workspace-github-issues">
                                <span>Issues · 30d</span>
                                <span>{metrics.issues?.opened ?? 0} opened · {metrics.issues?.closed ?? 0} closed</span>
                            </div>
                            {recordedActivity === 0 && (
                                <p className="workspace-github-note">
                                    No webhook activity is recorded yet. Metrics update as GitHub deliveries are received and processed.
                                </p>
                            )}
                        </>
                    )}
                </>
            ) : (
                <>
                    <p className="workspace-github-empty-copy">
                        {readOnly
                            ? "This archived project has no connected repository. Restore it to connect GitHub."
                            : "Connect a public repository to see pull request, issue, and commit activity here."}
                    </p>
                    {!readOnly && (
                        <>
                    <form className="workspace-github-form" onSubmit={handleConnect}>
                        <label>
                            Owner
                            <input
                                autoComplete="off"
                                value={owner}
                                onChange={(event) => setOwner(event.target.value)}
                                placeholder="octocat"
                                required
                            />
                        </label>
                        <label>
                            Repository
                            <input
                                autoComplete="off"
                                value={repo}
                                onChange={(event) => setRepo(event.target.value)}
                                placeholder="hello-world"
                                required
                            />
                        </label>
                        <button
                            className="primary-button"
                            type="submit"
                            disabled={connectRepository.isPending || !owner.trim() || !repo.trim()}
                        >
                            {connectRepository.isPending ? "Connecting…" : "Connect repository"}
                        </button>
                    </form>
                    {connectRepository.isError && (
                        <p className="workspace-github-error" role="alert">
                            {connectRepository.error?.message || "Unable to connect this repository."}
                        </p>
                    )}
                    <p className="workspace-github-note">
                        Public repositories are supported. Private repository authorization is not configured yet.
                    </p>
                        </>
                    )}
                </>
            )}
        </section>
    );
};

const ProjectWorkspacePage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { user } = useAuth();
    const archiveMutation = useProjectArchive(projectId);

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

    const hasMilestoneNamesMissing = (dashboardData?.data?.milestones ?? [])
        .some((milestone) => !milestone.name);
    const { data: milestoneDetails = [] } = useProjectMilestones(
        projectId,
        hasMilestoneNamesMissing
    );

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

    const isProjectOwner = project && String(
        project.owner?._id || project.owner
    ) === String(user?._id || user?.id);
    const isArchived = project?.status === "archived";

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
    const blockedTasks = taskSummary?.blockedTasks ?? 0;
    const overdueTasks = taskSummary?.overdueTasks ?? 0;
    const allRiskGroups = groupRiskSignals(topRisks ?? []);
    const primaryRiskGroup = allRiskGroups[0];
    const primaryRisk = primaryRiskGroup?.risks[0];
    const additionalRiskGroups = allRiskGroups.slice(1);
    const milestonesForDisplay = (milestones ?? []).map((milestone, index) => {
        const milestoneId = String(milestone.id || milestone._id);
        const details = milestoneDetails.find((item) =>
            String(item.id || item._id) === milestoneId
        );

        return {
            ...details,
            ...milestone,
            name: milestone.name || details?.name || `Milestone ${index + 1}`
        };
    });

    return (
        <section className="page-section workspace-page">
            <div className="page-heading workspace-heading">
                <div>
                    <h1>
                        {project.name}
                    </h1>

                    {project.description && (
                        <p className="workspace-project-description">
                            {project.description}
                        </p>
                    )}
                    <p className="workspace-heading-meta">
                        <span className="workspace-status-indicator" aria-label={`Project status: ${project.status || "Active"}`}>
                            <span aria-hidden="true" />
                            {project.status || "Active"}
                        </span>
                    </p>
                </div>

                <div className="workspace-heading-actions">
                    <ProjectMembersMenu
                        project={project}
                        currentUserId={user?._id || user?.id}
                        isProjectOwner={isProjectOwner}
                        isArchived={isArchived}
                    />
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate(`/app/projects/${projectId}/tasks`)}
                    >
                        View tasks
                    </button>
                    {isProjectOwner && (
                        <button
                            type="button"
                            className="secondary-button"
                            disabled={archiveMutation.isPending}
                            onClick={() => archiveMutation.mutate(isArchived ? "restore" : "archive")}
                        >
                            {archiveMutation.isPending
                                ? "Saving…"
                                : isArchived
                                    ? "Restore project"
                                    : "Archive project"}
                        </button>
                    )}
                </div>
            </div>

            {isArchived && (
                <div className="workspace-archived-notice" role="status">
                    <strong>Archived project</strong>
                    <span>This project is read-only. Restore it to resume editing.</span>
                </div>
            )}
            {archiveMutation.isError && (
                <div className="workspace-archived-notice workspace-archived-error" role="alert">
                    {archiveMutation.error?.message || "Could not update project archive status."}
                </div>
            )}

            <div className="workspace-signal-row">
                <section className="workspace-health-panel" aria-label="Project health">
                    <div className="workspace-health-panel-score">
                        <span className="workspace-panel-label">Health score</span>
                        <div className="workspace-health-score-value">
                            <strong>{health?.score ?? "—"}</strong>
                            <span>/ 100</span>
                        </div>
                        <span className={`dashboard-trend-status ${getHealthStatusClass(health?.health)}`}>
                            {health?.health ?? "Unknown"}
                        </span>
                    </div>
                    <div className="workspace-health-panel-progress">
                        <span className="workspace-panel-label">Task completion</span>
                        <strong>{taskCompletion}%</strong>
                        <div className="workspace-task-progress" aria-label={`${taskCompletion}% of tasks completed`}>
                            <span style={{ width: `${taskCompletion}%` }} />
                        </div>
                        <p>{completedTasks} of {totalTasks} tasks completed</p>
                    </div>
                </section>

                <section className={`workspace-primary-risk ${primaryRisk ? `workspace-primary-risk-${String(primaryRisk.severity || "low").toLowerCase()}` : "workspace-primary-risk-clear"}`} aria-label="Priority execution insight">
                    <div className="workspace-primary-risk-icon" aria-hidden="true">
                        {primaryRisk ? (
                            <svg viewBox="0 0 20 20" focusable="false"><path d="M10 2.5 18 16.5H2L10 2.5Z" /><path d="M10 7v4.5M10 14.2v.1" /></svg>
                        ) : (
                            <svg viewBox="0 0 20 20" focusable="false"><circle cx="10" cy="10" r="7.5" /><path d="m6.5 10 2.2 2.2 4.8-4.7" /></svg>
                        )}
                    </div>
                    <div className="workspace-primary-risk-content">
                        <div className="workspace-primary-risk-heading">
                            <span className="workspace-panel-label">Priority insight</span>
                            {primaryRisk && <span className={`dashboard-risk-severity dashboard-risk-severity-${String(primaryRisk.severity || "low").toLowerCase()}`}>{primaryRisk.severity}</span>}
                        </div>
                        <h2>{primaryRisk ? formatRiskType(primaryRisk.type) : "No active risks detected"}</h2>
                        <p>{primaryRisk?.message || "The current project signals show no execution risks requiring immediate attention."}</p>
                        {primaryRisk?.evidence?.[0] && <p className="workspace-primary-risk-evidence">Evidence: {primaryRisk.evidence[0]}</p>}
                        {primaryRiskGroup?.risks.length > 1 && (
                            <details className="workspace-risk-related">
                                <summary>{primaryRiskGroup.risks.length - 1} related findings</summary>
                                <ul>
                                    {primaryRiskGroup.risks.slice(1).map((relatedRisk) => (
                                        <li key={relatedRisk.id}>
                                            {relatedRisk.context?.title
                                                ? `${relatedRisk.context.title}: `
                                                : ""}
                                            {relatedRisk.message}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                        {primaryRisk?.nextAction?.description && <div className="workspace-primary-risk-action"><strong>Suggested next step</strong><span>{primaryRisk.nextAction.description}</span></div>}
                    </div>
                    {primaryRisk?.nextAction?.href && (
                        primaryRisk.nextAction.external ? (
                            <a className="workspace-primary-risk-link" href={primaryRisk.nextAction.href} target="_blank" rel="noreferrer">{primaryRisk.nextAction.label}<span aria-hidden="true">↗</span></a>
                        ) : (
                            <Link className="workspace-primary-risk-link" to={primaryRisk.nextAction.href}>{primaryRisk.nextAction.label}<span aria-hidden="true">→</span></Link>
                        )
                    )}
                </section>
            </div>

            <div className="workspace-metric-grid">
                <article className="workspace-metric">
                    <span className="workspace-panel-label">Blocked work</span>
                    <strong className={blockedTasks ? "metric-warning" : ""}>{blockedTasks}</strong>
                    <span>Unfinished tasks currently blocked</span>
                </article>
                <article className="workspace-metric">
                    <span className="workspace-panel-label">Overdue work</span>
                    <strong className={overdueTasks ? "metric-danger" : ""}>{overdueTasks}</strong>
                    <span>Unfinished tasks past due date</span>
                </article>
                <article className="workspace-metric">
                    <span className="workspace-panel-label">Active contributors</span>
                    <strong>{workload?.length ?? 0}</strong>
                    <span>People with assigned work in progress</span>
                </article>
            </div>

            <HealthTrendSection
                snapshots={snapshots}
                signals={trendSignals}
                projectId={projectId}
                isLoading={isHealthTrendLoading}
                error={isHealthTrendError ? healthTrendError : null}
            />

            {additionalRiskGroups.length > 0 && (
                <div
                    className="dashboard-section workspace-risk-section"
                    id="execution-risks"
                >
                <div className="dashboard-section-header">
                    <div>
                        <h2>Other execution risks</h2>

                        <p>
                            Additional signals beyond the priority risk above.
                        </p>
                    </div>
                    <span className="workspace-risk-count">
                        {additionalRiskGroups.length} {additionalRiskGroups.length === 1 ? "category" : "categories"}
                    </span>
                </div>

                <div className="dashboard-risk-list">
                        {additionalRiskGroups.map(({ type, risks: relatedRisks }) => {
                            const risk = relatedRisks[0];
                            return (
                                <article
                                    key={type}
                                    className={`dashboard-risk-card workspace-risk-card workspace-risk-${String(risk.severity || "low").toLowerCase()}`}
                                >
                                <div className="dashboard-risk-header">
                                    <span className="dashboard-risk-type">
                                        {formatRiskType(type)}
                                    </span>

                                    <span className="dashboard-risk-severity">
                                        {risk.severity}
                                    </span>
                                </div>

                                {relatedRisks.length > 1 && (
                                    <span className="workspace-risk-related-count">
                                        {relatedRisks.length} related findings
                                    </span>
                                )}

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
                                    ?.some((evidence) => evidence !== risk.message) && (
                                    <ul className="dashboard-risk-evidence">
                                        {risk.evidence.filter((evidence) => evidence !== risk.message).map(
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

                                {relatedRisks.length > 1 && (
                                    <details className="workspace-risk-related">
                                        <summary>Review all related findings</summary>
                                        <ul>
                                            {relatedRisks.map((relatedRisk) => (
                                                <li key={relatedRisk.id}>
                                                    {relatedRisk.context?.title
                                                        ? `${relatedRisk.context.title}: `
                                                        : ""}
                                                    {relatedRisk.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
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
                            );
                        })}
                </div>
                </div>
            )}

            <div className={`dashboard-section workspace-milestones-section${additionalRiskGroups.length ? "" : " workspace-milestones-wide"}`} id="milestones">
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

                {milestonesForDisplay.length ? (
                    <div className="dashboard-milestone-list">
                        {milestonesForDisplay.map(
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
                                                {milestone.name}
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

            <GithubIntegrationSection projectId={projectId} readOnly={isArchived} />

            <div className="dashboard-section workspace-workload-section">
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
