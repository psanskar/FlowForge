import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import useAddProjectMember from "../hooks/useAddProjectMember";
import useConnectGithubRepository from "../hooks/useConnectGithubRepository";
import useGithubRepository from "../hooks/useGithubRepository";
import useGithubMetrics from "../hooks/useGithubMetrics";
import useProject from "../hooks/useProject";
import useProjectDashboard from "../hooks/useProjectDashboard";
import useHealthTrend from "../hooks/useHealthTrend";
import { useAuth } from "../context/AuthContext";

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

const getRiskAction = (risk, projectId, repositoryFullName) => {
    const taskId = risk.taskId?.toString?.() ?? risk.taskId;
    const userId = risk.userId?.toString?.() ?? risk.userId;
    const milestoneId =
        risk.milestoneId?.toString?.() ?? risk.milestoneId;

    if (taskId) {
        return {
            to: `/app/tasks/${taskId}`,
            label: "Open affected task"
        };
    }

    if (userId) {
        return {
            to: `/app/projects/${projectId}/tasks?assignee=${encodeURIComponent(userId)}`,
            label: "Review contributor’s tasks"
        };
    }

    if (milestoneId) {
        return {
            href: `#milestone-${milestoneId}`,
            label: "View milestone progress"
        };
    }

    if (
        risk.type === "GITHUB_AGING_PR" &&
        risk.githubPrId &&
        repositoryFullName
    ) {
        return {
            href: `https://github.com/${repositoryFullName}/pull/${encodeURIComponent(String(risk.githubPrId))}`,
            label: "Open pull request",
            external: true
        };
    }

    if (risk.type.startsWith("GITHUB_")) {
        return {
            href: "#github-activity",
            label: "Review GitHub activity"
        };
    }

    return null;
};

const RiskActionLink = ({ risk, projectId, repositoryFullName }) => {
    const action = getRiskAction(
        risk,
        projectId,
        repositoryFullName
    );

    if (!action) {
        return null;
    }

    const className = "dashboard-risk-action";

    if (action.to) {
        return (
            <Link className={className} to={action.to}>
                {action.label}<span aria-hidden="true"> →</span>
            </Link>
        );
    }

    return (
        <a
            className={className}
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noreferrer" : undefined}
        >
            {action.label}<span aria-hidden="true"> {action.external ? "↗" : "→"}</span>
        </a>
    );
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
    snapshots = []
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
        </div>
    );
};

const ProjectWorkspacePage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { user } = useAuth();
    const [memberEmail, setMemberEmail] = useState("");
    const addMemberMutation = useAddProjectMember(projectId);
    const [githubOwner, setGithubOwner] = useState("");
    const [githubRepoName, setGithubRepoName] = useState("");
    const [isEditingGithub, setIsEditingGithub] = useState(false);
    const connectGithubMutation = useConnectGithubRepository(projectId);

    const {
        data: githubRepositoryData,
        isLoading: isGithubRepositoryLoading,
        isError: isGithubRepositoryError,
        error: githubRepositoryError
    } = useGithubRepository(projectId);

    const githubRepository =
        githubRepositoryData?.data?.repository ?? null;

    const {
        data: githubMetrics,
        isLoading: isGithubMetricsLoading,
        isError: isGithubMetricsError,
        error: githubMetricsError
    } = useGithubMetrics(projectId, Boolean(githubRepository));

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

    const currentUserId = user?.id ?? user?._id;
    const isProjectOwner =
        Boolean(currentUserId) &&
        (project.members ?? []).some(
            (member) =>
                member.role === "owner" &&
                String(member.user?._id ?? member.user) ===
                    String(currentUserId)
        );

    const handleAddMember = async (event) => {
        event.preventDefault();

        try {
            await addMemberMutation.mutateAsync({
                email: memberEmail.trim()
            });
            setMemberEmail("");
        } catch {
            // The mutation error is displayed in the member panel.
        }
    };

    const handleConnectGithub = async (event) => {
        event.preventDefault();

        try {
            await connectGithubMutation.mutateAsync({
                owner: githubOwner.trim(),
                repo: githubRepoName.trim()
            });
            setIsEditingGithub(false);
        } catch {
            // The mutation error is shown in the GitHub panel.
        }
    };

    const handleEditGithub = () => {
        setGithubOwner(githubRepository?.owner ?? "");
        setGithubRepoName(githubRepository?.repo ?? "");
        setIsEditingGithub(true);
    };

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
    const taskCompletionPercentage = totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    return (
        <section className="page-section">
            <div className="page-heading">
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
                </div>

                <div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                `/app/projects/${projectId}/tasks`
                            )
                        }
                    >
                        View tasks
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                            navigate(
                                "/app/projects"
                            )
                        }
                    >
                        Back to projects
                    </button>
                </div>
            </div>

            <div className="dashboard-health-grid">
                <div className="dashboard-card dashboard-health-card">
                    <span className="dashboard-card-label">
                        Risk-adjusted health
                    </span>

                    <p className="dashboard-health-score">
                        {health?.score ?? "—"}
                    </p>

                    <span className="dashboard-health-status">
                        {health?.health ??
                            "Unknown"}
                    </span>
                </div>

                <div className="dashboard-card dashboard-task-progress-card">
                    <span className="dashboard-card-label">
                        Task completion
                    </span>
                    <p className="dashboard-stat-value">
                        {completedTasks}<span className="dashboard-stat-denominator"> / {totalTasks}</span>
                    </p>
                    <div
                        className="dashboard-summary-progress"
                        role="progressbar"
                        aria-label="Project task completion"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={taskCompletionPercentage}
                    >
                        <div
                            style={{ width: `${taskCompletionPercentage}%` }}
                        />
                    </div>
                    <p className="dashboard-stat-description">
                        {taskCompletionPercentage}% of project tasks complete
                    </p>
                </div>

                <div className={`dashboard-card dashboard-attention-card ${taskSummary?.overdueTasks ? "has-attention" : "is-clear"}`}>
                    <span className="dashboard-card-label">
                        Overdue
                    </span>
                    <p className="dashboard-stat-value">
                        {taskSummary?.overdueTasks ?? 0}
                    </p>
                    <p className="dashboard-stat-description">
                        Unfinished tasks past their due date
                    </p>
                </div>

                <div className={`dashboard-card dashboard-attention-card ${taskSummary?.blockedTasks ? "has-attention" : "is-clear"}`}>
                    <span className="dashboard-card-label">
                        Blocked
                    </span>
                    <p className="dashboard-stat-value">
                        {taskSummary?.blockedTasks ?? 0}
                    </p>
                    <p className="dashboard-stat-description">
                        Tasks marked as blocked
                    </p>
                </div>
            </div>

            <HealthTrendSection
                snapshots={snapshots}
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

            <div className="dashboard-section">
                <div className="dashboard-section-header">
                    <h2>
                        Execution risks
                    </h2>

                    <p>
                        The most significant signals
                        detected in the current project
                        state.
                    </p>
                </div>

                {topRisks?.length ? (
                    <div className="dashboard-risk-list">
                        {topRisks.map((risk) => (
                            <article
                                key={risk.id}
                                className={`dashboard-risk-card dashboard-risk-card--${String(risk.severity || "low").toLowerCase()}`}
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

                                <RiskActionLink
                                    risk={risk}
                                    projectId={projectId}
                                    repositoryFullName={
                                        githubRepository?.fullName
                                    }
                                />
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="dashboard-risk-empty">
                        No active risk signals detected.
                    </div>
                )}
            </div>

            <div className="dashboard-section">
                <div className="dashboard-section-header">
                    <h2>
                        Milestone progress
                    </h2>

                    <p>
                        Track progress toward the
                        project's major delivery points.
                    </p>
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
                                        id={`milestone-${milestone.id || milestone._id}`}
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
                                        id={`contributor-${contributor.userId}`}
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

                                        <div
                                            className="dashboard-workload-bar"
                                            role="progressbar"
                                            aria-label={`${contributor.name} workload relative to the busiest contributor`}
                                            aria-valuemin="0"
                                            aria-valuemax="100"
                                            aria-valuenow={Math.round(percentage)}
                                        >
                                            <div
                                                className="dashboard-workload-bar-fill"
                                                style={{
                                                    width: `${percentage}%`
                                                }}
                                            />
                                        </div>
                                        <Link
                                            className="dashboard-workload-link"
                                            to={`/app/projects/${projectId}/tasks?assignee=${encodeURIComponent(contributor.userId)}`}
                                        >
                                            View assigned tasks <span aria-hidden="true">→</span>
                                        </Link>
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
            <div className="dashboard-section project-members-section">
                <div className="dashboard-section-header">
                    <h2>Project members</h2>
                    <p>
                        Add an existing FlowForge account so they can
                        contribute to this project and be assigned tasks.
                    </p>
                </div>

                <ul className="project-member-list">
                    {(project.members ?? []).map((member) => (
                        <li key={member.user?._id ?? member.user}>
                            <span>
                                <strong>{member.user?.name ?? "Project member"}</strong>
                                {member.user?.email && (
                                    <small>{member.user.email}</small>
                                )}
                            </span>
                            <span className="project-member-role">
                                {member.role}
                            </span>
                        </li>
                    ))}
                </ul>

                {isProjectOwner && (
                    <form
                        className="project-member-form"
                        onSubmit={handleAddMember}
                    >
                        <label htmlFor="project-member-email">
                            Account email
                        </label>
                        <div className="project-member-form-row">
                            <input
                                id="project-member-email"
                                type="email"
                                value={memberEmail}
                                onChange={(event) =>
                                    setMemberEmail(event.target.value)
                                }
                                placeholder="teammate@example.com"
                                required
                            />
                            <button
                                type="submit"
                                className="primary-button"
                                disabled={
                                    !memberEmail.trim() ||
                                    addMemberMutation.isPending
                                }
                            >
                                {addMemberMutation.isPending
                                    ? "Adding..."
                                    : "Add member"}
                            </button>
                        </div>
                        {addMemberMutation.isError && (
                            <p className="form-error" role="alert">
                                {addMemberMutation.error?.message ??
                                    "Unable to add this member."}
                            </p>
                        )}
                    </form>
                )}
            </div>

            <div
                className="dashboard-section project-github-section"
                id="github-activity"
                tabIndex={-1}
            >
                <div className="dashboard-section-header">
                    <h2>GitHub integration</h2>
                    <p>
                        Connect a public repository to link code activity
                        with this project’s execution health.
                    </p>
                </div>

                {isGithubRepositoryLoading && (
                    <p>Checking GitHub connection...</p>
                )}

                {isGithubRepositoryError && (
                    <p className="form-error" role="alert">
                        {githubRepositoryError?.message ??
                            "Unable to load the GitHub connection."}
                    </p>
                )}

                {githubRepository && !isEditingGithub && (
                    <div className="project-github-connected">
                        <div>
                            <span className="project-github-status">
                                Connected repository
                            </span>
                            <a
                                href={`https://github.com/${githubRepository.fullName}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {githubRepository.fullName}
                            </a>
                            <p>
                                Default branch: {githubRepository.defaultBranch}
                                {githubRepository.private
                                    ? " · Private"
                                    : " · Public"}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={handleEditGithub}
                        >
                            Change repository
                        </button>
                    </div>
                )}

                {(!githubRepository || isEditingGithub) && (
                    <form
                        className="project-github-form"
                        onSubmit={handleConnectGithub}
                    >
                        <p>
                            Enter the repository owner and name. Private
                            repositories are not supported yet.
                        </p>
                        <div className="project-github-form-grid">
                            <div>
                                <label htmlFor="github-owner">
                                    Owner
                                </label>
                                <input
                                    id="github-owner"
                                    value={githubOwner}
                                    onChange={(event) =>
                                        setGithubOwner(event.target.value)
                                    }
                                    placeholder="octocat"
                                    autoComplete="off"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="github-repository">
                                    Repository
                                </label>
                                <input
                                    id="github-repository"
                                    value={githubRepoName}
                                    onChange={(event) =>
                                        setGithubRepoName(event.target.value)
                                    }
                                    placeholder="Hello-World"
                                    autoComplete="off"
                                    required
                                />
                            </div>
                        </div>
                        <div className="project-github-actions">
                            {githubRepository && (
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setIsEditingGithub(false)}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                className="primary-button"
                                disabled={
                                    !githubOwner.trim() ||
                                    !githubRepoName.trim() ||
                                    connectGithubMutation.isPending
                                }
                            >
                                {connectGithubMutation.isPending
                                    ? "Connecting..."
                                    : githubRepository
                                      ? "Update repository"
                                      : "Connect repository"}
                            </button>
                        </div>
                        {connectGithubMutation.isError && (
                            <p className="form-error" role="alert">
                                {connectGithubMutation.error?.message ??
                                    "Unable to connect this repository."}
                            </p>
                        )}
                    </form>
                )}

                {githubRepository && (
                    <>
                        <div className="project-github-metrics">
                            <div className="project-github-metric">
                                <span>Pull requests opened · 30 days</span>
                                <strong>
                                    {githubMetrics?.pullRequests?.opened ?? "—"}
                                </strong>
                            </div>
                            <div className="project-github-metric">
                                <span>Pull requests merged · 30 days</span>
                                <strong>
                                    {githubMetrics?.pullRequests?.merged ?? "—"}
                                </strong>
                            </div>
                            <div className="project-github-metric">
                                <span>Open pull requests</span>
                                <strong>
                                    {githubMetrics?.pullRequests?.open ?? "—"}
                                </strong>
                            </div>
                            <div className="project-github-metric">
                                <span>Commits · 30 days</span>
                                <strong>
                                    {githubMetrics?.commits?.count ?? "—"}
                                </strong>
                            </div>
                            <div className="project-github-metric">
                                <span>Issues opened · 30 days</span>
                                <strong>
                                    {githubMetrics?.issues?.opened ?? "—"}
                                </strong>
                            </div>
                            <div className="project-github-metric">
                                <span>Issues closed · 30 days</span>
                                <strong>
                                    {githubMetrics?.issues?.closed ?? "—"}
                                </strong>
                            </div>
                        </div>

                        {isGithubMetricsLoading && (
                            <p>Loading GitHub activity...</p>
                        )}
                        {isGithubMetricsError && (
                            <p className="form-error" role="alert">
                                {githubMetricsError?.message ??
                                    "Unable to load GitHub activity."}
                            </p>
                        )}
                        {!isGithubMetricsLoading &&
                            !isGithubMetricsError &&
                            githubMetrics?.pullRequests?.opened === 0 &&
                            githubMetrics?.pullRequests?.merged === 0 &&
                            githubMetrics?.commits?.count === 0 &&
                            githubMetrics?.issues?.opened === 0 &&
                            githubMetrics?.issues?.closed === 0 && (
                                <p className="project-github-note">
                                    No GitHub events have reached FlowForge yet.
                                </p>
                            )}

                        <details className="project-github-webhook-help">
                            <summary>Set up GitHub event delivery</summary>
                            <p>
                                In the GitHub repository settings, add a webhook
                                pointing to your public HTTPS API address followed
                                by <code>/api/v1/github/webhook</code>. Set its
                                secret to the same value as
                                <code> GITHUB_WEBHOOK_SECRET</code> in FlowForge’s
                                root <code>.env</code> file, then subscribe to
                                <code> push</code>, <code>pull_request</code>, and
                                <code>issues</code> events.
                            </p>
                            <p>
                                GitHub cannot deliver webhooks to a local
                                <code> localhost</code> address. The API needs a
                                public HTTPS address for live event delivery.
                            </p>
                        </details>
                    </>
                )}
            </div>

        </section>
    );
};

export default ProjectWorkspacePage;
