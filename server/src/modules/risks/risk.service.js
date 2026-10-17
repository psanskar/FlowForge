const mongoose = require("mongoose");

const Project = require("../projects/project.model");
const Task = require("../tasks/task.model");
const Dependency = require("../dependencies/dependency.model");
const Milestone = require("../milestones/milestone.model");
const GithubSignal = require(
    "../github/github.signal.model"
);
const GithubPullRequestState = require(
    "../github/github.pullRequestState.model"
);
const { ensurePullRequestState } = require(
    "../github/github.pullRequestState.service"
);

const { analyzeProject } = require("./risk.engine");

const createError = (statusCode, code, message) => {
    const error = new Error(message);

    error.statusCode = statusCode;
    error.code = code;

    return error;
};

const validateProjectId = (projectId) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }
};

const getProjectForMember = async (
    projectId,
    userId
) => {
    const project = await Project.findOne({
        _id: projectId,
        "members.user": userId
    }).lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    return project;
};

const loadProjectRiskData = async (
    projectId,
    userId,
    now = new Date()
) => {
    if (!mongoose.isValidObjectId(projectId)) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }

    const project = await Project.findById(projectId)
        .select(
            "_id name description status startDate targetDate members.user"
        )
        .lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    const isMember = project.members.some(
        (member) =>
            member.user.toString() ===
            userId.toString()
    );

    if (!isMember) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    await ensurePullRequestState(project._id);

    const githubAnalysisStart = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    const [
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates
    ] = await Promise.all([
        Task.find({
            project: projectId
        })
            .select(
                "_id status priority dueDate lastActivityAt milestone assignee"
            )
            .lean(),

        Dependency.find({
            project: projectId
        })
            .select("fromTask toTask")
            .lean(),

        Milestone.find({
            project: projectId
        })
            .select("_id dueDate status")
            .lean(),

        GithubSignal.find({
            project: projectId,
            type: {
                $in: [
                    "PULL_REQUEST_OPENED",
                    "PULL_REQUEST_MERGED",
                    "ISSUE_OPENED",
                    "ISSUE_CLOSED"
                ]
            },
            occurredAt: {
                $gte: githubAnalysisStart,
                $lte: now
            }
        })
            .select("type externalId occurredAt metadata")
            .lean(),

        GithubPullRequestState.find({
            project: projectId,
            latestEventType: {
                $in: [
                    "PULL_REQUEST_OPENED",
                    "PULL_REQUEST_MERGED"
                ]
            }
        })
            .select(
                "githubId lastOpenedAt latestEventAt latestEventType latestEventMetadata"
            )
            .lean()
    ]);

    const githubPullRequestCycleTimes =
        githubPullRequestStates
            .filter(
                (pullRequest) =>
                    pullRequest.latestEventType ===
                        "PULL_REQUEST_MERGED" &&
                    pullRequest.lastOpenedAt &&
                    pullRequest.latestEventAt <= now
            )
            .map((pullRequest) =>
                (
                    pullRequest.latestEventAt.getTime() -
                    pullRequest.lastOpenedAt.getTime()
                ) /
                (1000 * 60 * 60)
            )
            .filter((cycleTime) => cycleTime >= 0);

    return {
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates,
        githubPullRequestCycleTimes
    };
};

const getProjectRisks = async (
    projectId,
    userId,
    now = new Date()
) => {
    const {
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates,
        githubPullRequestCycleTimes
    } = await loadProjectRiskData(
        projectId,
        userId,
        now
    );

    return analyzeProject({
        project,
        tasks,
        dependencies,
        milestones,
        githubSignals,
        githubPullRequestStates,
        githubPullRequestCycleTimes,
        now
    });
};

module.exports = {
    loadProjectRiskData,
    getProjectRisks
};
