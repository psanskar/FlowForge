const PR_WARNING_DAYS = 7;
const PR_HIGH_RISK_DAYS = 14;

const ISSUE_ANALYSIS_DAYS = 14;
const ISSUE_BACKLOG_THRESHOLD = 3;

const PR_ANALYSIS_DAYS = 14;
const MIN_PR_OPENED_FOR_THROUGHPUT = 3;

const PR_CYCLE_TIME_WARNING_HOURS = 72;
const PR_CYCLE_TIME_HIGH_RISK_HOURS = 168;
const MIN_MERGED_PRS_FOR_CYCLE_TIME = 3;

const MILLISECONDS_PER_DAY =
    1000 * 60 * 60 * 24;

const MILLISECONDS_PER_HOUR =
    1000 * 60 * 60;

const getDaysDifference = (from, to) => {
    return Math.floor(
        (to.getTime() - from.getTime()) /
            MILLISECONDS_PER_DAY
    );
};

const getSignalDate = (signal) => {
    const date = new Date(signal.occurredAt);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const getGithubItemId = (signal) => {
    if (signal.metadata?.githubId) {
        return String(signal.metadata.githubId);
    }

    const externalId = signal.externalId || "";

    const match = externalId.match(
        /^(?:pr|issue):([^:]+)/
    );

    return match ? match[1] : null;
};

const getPullRequestStates = (signals) => {
    const pullRequests = new Map();

    const pullRequestSignals = signals.filter(
        (signal) =>
            signal.type ===
                "PULL_REQUEST_OPENED" ||
            signal.type ===
                "PULL_REQUEST_MERGED" ||
            signal.type ===
                "PULL_REQUEST_CLOSED"
    );

    for (const signal of pullRequestSignals) {
        const id = getGithubItemId(signal);

        const occurredAt = getSignalDate(signal);

        if (!id || !occurredAt) {
            continue;
        }

        if (!pullRequests.has(id)) {
            pullRequests.set(id, []);
        }

        pullRequests.get(id).push(signal);
    }

    const states = [];

    for (const [id, itemSignals] of pullRequests) {
        const sortedSignals = [...itemSignals].sort(
            (a, b) =>
                getSignalDate(a) -
                getSignalDate(b)
        );

        let state = "unknown";
        let openedAt = null;
        let latestSignal = null;

        for (const signal of sortedSignals) {
            latestSignal = signal;

            if (
                signal.type ===
                "PULL_REQUEST_OPENED"
            ) {
                state = "open";
                openedAt = getSignalDate(signal);
            }

            if (
                signal.type ===
                    "PULL_REQUEST_MERGED" ||
                signal.type ===
                    "PULL_REQUEST_CLOSED"
            ) {
                state = "closed";
            }
        }

        states.push({
            id,
            state,
            openedAt,
            latestSignal
        });
    }

    return states;
};

const analyzeAgingPullRequests = (
    signals,
    now
) => {
    const risks = [];

    const pullRequests =
        getPullRequestStates(signals);

    for (const pullRequest of pullRequests) {
        if (
            pullRequest.state !== "open" ||
            !pullRequest.openedAt
        ) {
            continue;
        }

        const ageDays = getDaysDifference(
            pullRequest.openedAt,
            now
        );

        if (ageDays < PR_WARNING_DAYS) {
            continue;
        }

        const severity =
            ageDays >= PR_HIGH_RISK_DAYS
                ? "HIGH"
                : "MEDIUM";

        const metadata =
            pullRequest.latestSignal
                ?.metadata || {};

        const prNumber =
            metadata.number ?? null;

        const title =
            metadata.title || null;

        risks.push({
            type: "GITHUB_AGING_PR",
            severity,
            githubPrId: pullRequest.id,
            prNumber,
            title,
            ageDays,
            message:
                `Pull request has been open for ${ageDays} days`
        });
    }

    return risks;
};

const analyzeIssueBacklog = (
    signals,
    now
) => {
    const analysisStart = new Date(
        now.getTime() -
            ISSUE_ANALYSIS_DAYS *
                MILLISECONDS_PER_DAY
    );

    let openedCount = 0;
    let closedCount = 0;

    for (const signal of signals) {
        if (
            signal.type !==
                "ISSUE_OPENED" &&
            signal.type !==
                "ISSUE_CLOSED"
        ) {
            continue;
        }

        const occurredAt =
            getSignalDate(signal);

        if (
            !occurredAt ||
            occurredAt < analysisStart ||
            occurredAt > now
        ) {
            continue;
        }

        if (
            signal.type ===
            "ISSUE_OPENED"
        ) {
            openedCount++;
        }

        if (
            signal.type ===
            "ISSUE_CLOSED"
        ) {
            closedCount++;
        }
    }

    const backlogGrowth =
        openedCount - closedCount;

    if (
        openedCount < ISSUE_BACKLOG_THRESHOLD ||
        backlogGrowth <
            ISSUE_BACKLOG_THRESHOLD
    ) {
        return [];
    }

    return [
        {
            type: "GITHUB_ISSUE_BACKLOG",
            severity: "MEDIUM",
            windowDays: ISSUE_ANALYSIS_DAYS,
            openedCount,
            closedCount,
            backlogGrowth,
            message:
                `GitHub issue backlog grew by ${backlogGrowth} issues over the last ${ISSUE_ANALYSIS_DAYS} days`
        }
    ];
};

const analyzeMergeThroughput = (
    signals,
    now
) => {
    const analysisStart = new Date(
        now.getTime() -
            PR_ANALYSIS_DAYS *
                MILLISECONDS_PER_DAY
    );

    let openedCount = 0;
    let mergedCount = 0;

    for (const signal of signals) {
        if (
            signal.type !==
                "PULL_REQUEST_OPENED" &&
            signal.type !==
                "PULL_REQUEST_MERGED"
        ) {
            continue;
        }

        const occurredAt =
            getSignalDate(signal);

        if (
            !occurredAt ||
            occurredAt < analysisStart ||
            occurredAt > now
        ) {
            continue;
        }

        if (
            signal.type ===
            "PULL_REQUEST_OPENED"
        ) {
            openedCount++;
        }

        if (
            signal.type ===
            "PULL_REQUEST_MERGED"
        ) {
            mergedCount++;
        }
    }

    if (
        openedCount <
            MIN_PR_OPENED_FOR_THROUGHPUT ||
        mergedCount > 0
    ) {
        return [];
    }

    return [
        {
            type: "GITHUB_LOW_MERGE_THROUGHPUT",
            severity: "MEDIUM",
            windowDays: PR_ANALYSIS_DAYS,
            openedCount,
            mergedCount,
            message:
                `No pull requests were merged despite ${openedCount} pull requests being opened over the last ${PR_ANALYSIS_DAYS} days`
        }
    ];
};

const calculatePullRequestCycleTimes = (
    signals,
    now
) => {
    const pullRequests = new Map();

    const pullRequestSignals = signals.filter(
        (signal) =>
            signal.type ===
                "PULL_REQUEST_OPENED" ||
            signal.type ===
                "PULL_REQUEST_MERGED"
    );

    for (const signal of pullRequestSignals) {
        const id = getGithubItemId(signal);
        const occurredAt = getSignalDate(signal);

        if (!id || !occurredAt) {
            continue;
        }

        if (!pullRequests.has(id)) {
            pullRequests.set(id, {});
        }

        const pullRequest =
            pullRequests.get(id);

        if (
            signal.type ===
            "PULL_REQUEST_OPENED"
        ) {
            pullRequest.openedAt = occurredAt;
        }

        if (
            signal.type ===
            "PULL_REQUEST_MERGED"
        ) {
            pullRequest.mergedAt = occurredAt;
        }
    }

    const cycleTimes = [];

    for (const pullRequest of pullRequests.values()) {
        if (
            !pullRequest.openedAt ||
            !pullRequest.mergedAt
        ) {
            continue;
        }

        if (
            pullRequest.mergedAt >
            now
        ) {
            continue;
        }

        const cycleTimeHours =
            (
                pullRequest.mergedAt.getTime() -
                pullRequest.openedAt.getTime()
            ) /
            MILLISECONDS_PER_HOUR;

        if (cycleTimeHours < 0) {
            continue;
        }

        cycleTimes.push(cycleTimeHours);
    }

    return cycleTimes;
};

const calculateMedian = (values) => {
    if (!values.length) {
        return null;
    }

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const middle =
        Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;
    }

    return sorted[middle];
};

const analyzePullRequestCycleTime = (
    signals,
    now
) => {
    const cycleTimes =
        calculatePullRequestCycleTimes(
            signals,
            now
        );

    if (
        cycleTimes.length <
        MIN_MERGED_PRS_FOR_CYCLE_TIME
    ) {
        return [];
    }

    const medianCycleTimeHours =
        calculateMedian(cycleTimes);

    if (
        medianCycleTimeHours <
        PR_CYCLE_TIME_WARNING_HOURS
    ) {
        return [];
    }

    const severity =
        medianCycleTimeHours >=
        PR_CYCLE_TIME_HIGH_RISK_HOURS
            ? "HIGH"
            : "MEDIUM";

    return [
        {
            type: "GITHUB_HIGH_PR_CYCLE_TIME",
            severity,
            mergedPrCount: cycleTimes.length,
            medianCycleTimeHours:
                Number(
                    medianCycleTimeHours.toFixed(
                        1
                    )
                ),
            message:
                `Median pull request cycle time is ${medianCycleTimeHours.toFixed(1)} hours`
        }
    ];
};

const analyzeGithubProject = ({
    githubSignals = [],
    now = new Date()
}) => {
    return [
        ...analyzeAgingPullRequests(
            githubSignals,
            now
        ),

        ...analyzeIssueBacklog(
            githubSignals,
            now
        ),

        ...analyzeMergeThroughput(
            githubSignals,
            now
        ),

        ...analyzePullRequestCycleTime(
            githubSignals,
            now
        )
    ];
};

module.exports = {
    analyzeGithubProject
};