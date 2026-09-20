const mongoose = require("mongoose");

const Project = require(
    "../projects/project.model"
);

const GithubSignal = require(
    "./github.signal.model"
);

const createError = (
    statusCode,
    code,
    message
) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

const ALLOWED_DAYS = [
    7,
    14,
    30,
    60,
    90
];

const HOURS_PER_DAY = 24;

const validateProjectId = (
    projectId
) => {
    if (
        !mongoose.Types.ObjectId.isValid(
            projectId
        )
    ) {
        throw createError(
            400,
            "INVALID_PROJECT_ID",
            "Invalid project ID"
        );
    }
};

const validateDays = (
    days
) => {
    if (
        !ALLOWED_DAYS.includes(days)
    ) {
        throw createError(
            400,
            "INVALID_GITHUB_METRICS_RANGE",
            "Days must be one of 7, 14, 30, 60, or 90"
        );
    }
};

const getHoursBetween = (
    start,
    end
) => {
    return (
        (end.getTime() -
            start.getTime()) /
        (1000 * 60 * 60)
    );
};

const roundMetric = (
    value
) => {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return Number(
        value.toFixed(1)
    );
};

const calculateMedian = (
    values
) => {
    if (
        values.length === 0
    ) {
        return null;
    }

    const sorted = [
        ...values
    ].sort(
        (a, b) => a - b
    );

    const middle =
        Math.floor(
            sorted.length / 2
        );

    if (
        sorted.length % 2 === 0
    ) {
        return (
            (sorted[middle - 1] +
                sorted[middle]) /
            2
        );
    }

    return sorted[middle];
};

const getGithubId = (
    signal
) => {
    return (
        signal?.metadata?.githubId ??
        null
    );
};

const getCurrentOpenPullRequests = (
    signals
) => {
    const latestByGithubId =
        new Map();

    signals.forEach(
        (signal) => {
            const githubId =
                getGithubId(signal);

            if (
                githubId === null
            ) {
                return;
            }

            const existing =
                latestByGithubId.get(
                    String(githubId)
                );

            if (
                !existing ||
                signal.occurredAt >
                    existing.occurredAt
            ) {
                latestByGithubId.set(
                    String(githubId),
                    signal
                );
            }
        }
    );

    const openPullRequests = [];

    latestByGithubId.forEach(
        (signal) => {
            if (
                signal.type ===
                "PULL_REQUEST_OPENED"
            ) {
                openPullRequests.push(
                    signal
                );
            }
        }
    );

    return openPullRequests;
};

const calculatePullRequestMetrics = ({
    lifecycleSignals,
    rangeStart,
    now
}) => {
    const openedSignals =
        lifecycleSignals.filter(
            (signal) =>
                signal.type ===
                    "PULL_REQUEST_OPENED" &&
                signal.occurredAt >=
                    rangeStart
        );

    const mergedSignals =
        lifecycleSignals.filter(
            (signal) =>
                signal.type ===
                    "PULL_REQUEST_MERGED" &&
                signal.occurredAt >=
                    rangeStart
        );

    const openedByGithubId =
        new Map();

    lifecycleSignals
        .filter(
            (signal) =>
                signal.type ===
                "PULL_REQUEST_OPENED"
        )
        .forEach(
            (signal) => {
                const githubId =
                    getGithubId(signal);

                if (
                    githubId === null
                ) {
                    return;
                }

                const key =
                    String(githubId);

                const existing =
                    openedByGithubId.get(
                        key
                    );

                if (
                    !existing ||
                    signal.occurredAt <
                        existing.occurredAt
                ) {
                    openedByGithubId.set(
                        key,
                        signal
                    );
                }
            }
        );

    const cycleTimes = [];

    mergedSignals.forEach(
        (mergedSignal) => {
            const githubId =
                getGithubId(
                    mergedSignal
                );

            if (
                githubId === null
            ) {
                return;
            }

            const openedSignal =
                openedByGithubId.get(
                    String(githubId)
                );

            if (
                !openedSignal
            ) {
                return;
            }

            const cycleTimeHours =
                getHoursBetween(
                    openedSignal.occurredAt,
                    mergedSignal.occurredAt
                );

            if (
                cycleTimeHours >= 0
            ) {
                cycleTimes.push(
                    cycleTimeHours
                );
            }
        }
    );

    const openPullRequests =
        getCurrentOpenPullRequests(
            lifecycleSignals
        );

    const oldestOpenPrAgeHours =
        openPullRequests.length > 0
            ? Math.max(
                  ...openPullRequests.map(
                      (signal) =>
                          getHoursBetween(
                              signal.occurredAt,
                              now
                          )
                  )
              )
            : null;

    const averageCycleTimeHours =
        cycleTimes.length > 0
            ? cycleTimes.reduce(
                  (
                      total,
                      value
                  ) =>
                      total + value,
                  0
              ) /
              cycleTimes.length
            : null;

    const medianCycleTimeHours =
        calculateMedian(
            cycleTimes
        );

    return {
        opened:
            openedSignals.length,

        merged:
            mergedSignals.length,

        open:
            openPullRequests.length,

        averageCycleTimeHours:
            roundMetric(
                averageCycleTimeHours
            ),

        medianCycleTimeHours:
            roundMetric(
                medianCycleTimeHours
            ),

        oldestOpenPrAgeHours:
            roundMetric(
                oldestOpenPrAgeHours
            )
    };
};

const calculateIssueMetrics = ({
    signals,
    rangeStart
}) => {
    const opened =
        signals.filter(
            (signal) =>
                signal.type ===
                    "ISSUE_OPENED" &&
                signal.occurredAt >=
                    rangeStart
        ).length;

    const closed =
        signals.filter(
            (signal) =>
                signal.type ===
                    "ISSUE_CLOSED" &&
                signal.occurredAt >=
                    rangeStart
        ).length;

    return {
        opened,
        closed,
        netChange:
            opened - closed
    };
};

const calculateCommitMetrics = ({
    signals,
    rangeStart
}) => {
    const count =
        signals.filter(
            (signal) =>
                signal.type ===
                    "COMMIT" &&
                signal.occurredAt >=
                    rangeStart
        ).length;

    return {
        count
    };
};

const getGithubExecutionMetrics = async ({
    projectId,
    userId,
    days = 30,
    now = new Date()
}) => {
    validateProjectId(
        projectId
    );

    validateDays(days);

    if (!userId) {
        throw createError(
            401,
            "AUTHENTICATION_REQUIRED",
            "Authentication required"
        );
    }

    const project =
        await Project.findOne({
            _id: projectId,
            "members.user": userId
        })
            .select("_id")
            .lean();

    if (!project) {
        throw createError(
            404,
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    const rangeStart =
        new Date(
            now.getTime() -
                days *
                    HOURS_PER_DAY *
                    60 *
                    60 *
                    1000
        );

    const lifecycleSignals =
        await GithubSignal.find({
            project: projectId,
            type: {
                $in: [
                    "PULL_REQUEST_OPENED",
                    "PULL_REQUEST_MERGED",
                    "PULL_REQUEST_CLOSED"
                ]
            }
        })
            .select(
                "type occurredAt metadata"
            )
            .sort({
                occurredAt: 1,
                _id: 1
            })
            .lean();

    const rangeSignals =
        await GithubSignal.find({
            project: projectId,
            occurredAt: {
                $gte: rangeStart,
                $lte: now
            },
            type: {
                $in: [
                    "ISSUE_OPENED",
                    "ISSUE_CLOSED",
                    "COMMIT"
                ]
            }
        })
            .select(
                "type occurredAt metadata"
            )
            .lean();

    const pullRequests =
        calculatePullRequestMetrics({
            lifecycleSignals,
            rangeStart,
            now
        });

    const issues =
        calculateIssueMetrics({
            signals: rangeSignals,
            rangeStart
        });

    const commits =
        calculateCommitMetrics({
            signals: rangeSignals,
            rangeStart
        });

    return {
        projectId:
            projectId.toString(),

        range:
            `${days}d`,

        pullRequests,

        issues,

        commits
    };
};

module.exports = {
    ALLOWED_DAYS,
    calculateMedian,
    calculatePullRequestMetrics,
    calculateIssueMetrics,
    calculateCommitMetrics,
    getGithubExecutionMetrics
};