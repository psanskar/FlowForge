const GithubRepository = require(
    "./github.model"
);

const githubClient = require(
    "./github.client"
);

const githubSignalService = require(
    "./github.signal.service"
);

const createActor = (actor) => {
    if (!actor) {
        return {
            id: null,
            login: null
        };
    }

    return {
        id: actor.id ?? null,
        login: actor.login ?? null
    };
};

const normalizeCommit = (commit) => {
    return {
        type: "COMMIT",

        externalId: commit.sha,

        occurredAt:
            commit.commit?.author?.date ||
            commit.commit?.committer?.date,

        actor: createActor(
            commit.author
        ),

        metadata: {
            message:
                commit.commit?.message || null
        }
    };
};

const normalizePullRequest = (
    pullRequest
) => {
    let type;

    if (
        pullRequest.merged_at
    ) {
        type =
            "PULL_REQUEST_MERGED";
    } else if (
        pullRequest.state === "open"
    ) {
        type =
            "PULL_REQUEST_OPENED";
    } else {
        type =
            "PULL_REQUEST_CLOSED";
    }

    return {
        type,

        externalId:
            `pr:${pullRequest.id}`,

        occurredAt:
            pullRequest.created_at,

        actor: createActor(
            pullRequest.user
        ),

        metadata: {
            number:
                pullRequest.number,

            title:
                pullRequest.title || null,

            state:
                pullRequest.state,

            merged:
                Boolean(
                    pullRequest.merged_at
                )
        }
    };
};

const normalizeIssue = (
    issue
) => {
    return {
        type:
            issue.state === "open"
                ? "ISSUE_OPENED"
                : "ISSUE_CLOSED",

        externalId:
            `issue:${issue.id}`,

        occurredAt:
            issue.created_at,

        actor: createActor(
            issue.user
        ),

        metadata: {
            number:
                issue.number,

            title:
                issue.title || null,

            state:
                issue.state
        }
    };
};

const normalizeWebhookPush = (
    payload
) => {
    const repositoryId =
        payload.repository?.id;

    const commits =
        Array.isArray(payload.commits)
            ? payload.commits
            : [];

    return commits.map((commit) => ({
        type: "COMMIT",

        externalId: commit.id,

        occurredAt:
            commit.timestamp ||
            payload.head_commit?.timestamp ||
            new Date(),

        actor: createActor(
            commit.author
        ),

        metadata: {
            message:
                commit.message || "",
            branch:
                payload.ref || null
        },

        repositoryGithubId:
            repositoryId
    }));
};

const normalizeWebhookPullRequest = (
    payload,
    action
) => {
    const pullRequest =
        payload.pull_request;

    if (!pullRequest) {
        return null;
    }

    let type;

    if (action === "opened") {
        type = "PULL_REQUEST_OPENED";
    } else if (
        action === "closed" &&
        pullRequest.merged_at
    ) {
        type = "PULL_REQUEST_MERGED";
    } else if (action === "closed") {
        type = "PULL_REQUEST_CLOSED";
    } else {
        return null;
    }

    return {
        type,

        externalId:
            `pr:${pullRequest.id}`,

        occurredAt:
            pullRequest.updated_at ||
            pullRequest.created_at ||
            new Date(),

        actor: createActor(
            payload.sender ||
            pullRequest.user
        ),

        metadata: {
            number:
                pullRequest.number,
            title:
                pullRequest.title || "",
            state:
                pullRequest.state,
            merged:
                Boolean(
                    pullRequest.merged_at
                )
        },

        repositoryGithubId:
            payload.repository?.id
    };
};

const normalizeWebhookIssue = (
    payload,
    action
) => {
    const issue = payload.issue;

    if (!issue) {
        return null;
    }

    let type;

    if (action === "opened") {
        type = "ISSUE_OPENED";
    } else if (action === "closed") {
        type = "ISSUE_CLOSED";
    } else {
        return null;
    }

    return {
        type,

        externalId:
            `issue:${issue.id}`,

        occurredAt:
            issue.updated_at ||
            issue.created_at ||
            new Date(),

        actor: createActor(
            payload.sender ||
            issue.user
        ),

        metadata: {
            number:
                issue.number,
            title:
                issue.title || "",
            state:
                issue.state
        },

        repositoryGithubId:
            payload.repository?.id
    };
};

const ingestCommits = async ({
    projectId,
    repository,
    perPage,
    page
}) => {
    const commits =
        await githubClient.getCommits(
            repository.owner,
            repository.repo,
            {
                perPage,
                page
            }
        );

    const signals = [];

    for (
        const commit of commits
    ) {
        const signal =
            normalizeCommit(commit);

        await githubSignalService.persistSignal(
            projectId,
            {
                ...signal,
                repository:
                    repository._id
            }
        );

        signals.push(signal);
    }

    return signals;
};

const ingestPullRequests = async ({
    projectId,
    repository,
    perPage,
    page
}) => {
    const pullRequests =
        await githubClient.getPullRequests(
            repository.owner,
            repository.repo,
            {
                state: "all",
                perPage,
                page
            }
        );

    const signals = [];

    for (
        const pullRequest of pullRequests
    ) {
        const signal =
            normalizePullRequest(
                pullRequest
            );

        await githubSignalService.persistSignal(
            projectId,
            {
                ...signal,
                repository:
                    repository._id
            }
        );

        signals.push(signal);
    }

    return signals;
};

const ingestIssues = async ({
    projectId,
    repository,
    perPage,
    page
}) => {
    const issues =
        await githubClient.getIssues(
            repository.owner,
            repository.repo,
            {
                state: "all",
                perPage,
                page
            }
        );

    const signals = [];

    for (
        const issue of issues
    ) {
        // GitHub's /issues endpoint
        // also returns pull requests.
        if (issue.pull_request) {
            continue;
        }

        const signal =
            normalizeIssue(issue);

        await githubSignalService.persistSignal(
            projectId,
            {
                ...signal,
                repository:
                    repository._id
            }
        );

        signals.push(signal);
    }

    return signals;
};

const ingestRepositoryActivity =
    async (
        projectId,
        {
            perPage = 30,
            page = 1
        } = {}
    ) => {
        const repository =
            await GithubRepository.findOne({
                project: projectId
            });

        if (!repository) {
            const error =
                new Error(
                    "GitHub repository not connected to this project"
                );

            error.statusCode = 404;
            error.code =
                "GITHUB_REPOSITORY_NOT_CONNECTED";

            throw error;
        }

        const results = {
            commits: [],
            pullRequests: [],
            issues: []
        };

        results.commits =
            await ingestCommits({
                projectId,
                repository,
                perPage,
                page
            });

        results.pullRequests =
            await ingestPullRequests({
                projectId,
                repository,
                perPage,
                page
            });

        results.issues =
            await ingestIssues({
                projectId,
                repository,
                perPage,
                page
            });

        return results;
    };

module.exports = {
    normalizeCommit,
    normalizePullRequest,
    normalizeIssue,
    ingestRepositoryActivity,
    normalizeWebhookPush,
    normalizeWebhookPullRequest,
    normalizeWebhookIssue
};