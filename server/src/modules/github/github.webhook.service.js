const GithubRepository =
    require("./github.model");

const githubSignalService =
    require("./github.signal.service");

const {
    normalizeWebhookPush,
    normalizeWebhookPullRequest,
    normalizeWebhookIssue
} = require("./github.ingestion.service");

const SUPPORTED_EVENTS = new Set([
    "push",
    "pull_request",
    "issues"
]);

const getSupportedEvents = () => {
    return Array.from(SUPPORTED_EVENTS);
};

const findRepositoryFromPayload =
    async (payload) => {
        const githubId =
            payload.repository?.id;

        if (!githubId) {
            const error = new Error(
                "GitHub repository information missing"
            );

            error.statusCode = 400;
            error.code =
                "GITHUB_WEBHOOK_REPOSITORY_MISSING";

            throw error;
        }

        const repository =
            await GithubRepository.findOne({
                githubId
            });

        if (!repository) {
            const error = new Error(
                "GitHub repository is not connected to FlowForge"
            );

            error.statusCode = 404;
            error.code =
                "GITHUB_REPOSITORY_NOT_CONNECTED";

            throw error;
        }

        return repository;
    };

const processPushWebhook =
    async (
        repository,
        payload
    ) => {
        const normalizedSignals =
            normalizeWebhookPush(
                payload
            );

        const persistedSignals = [];

        for (
            const signal of normalizedSignals
        ) {
            const persisted =
                await githubSignalService.persistSignal(
                    repository.project,
                    {
                        ...signal,
                        repository:
                            repository._id
                    }
                );

            persistedSignals.push(
                persisted
            );
        }

        return persistedSignals;
    };

const processPullRequestWebhook =
    async (
        repository,
        payload
    ) => {
        const normalizedSignal =
            normalizeWebhookPullRequest(
                payload,
                payload.action
            );

        if (!normalizedSignal) {
            return [];
        }

        const persisted =
            await githubSignalService.persistSignal(
                repository.project,
                {
                    ...normalizedSignal,
                    repository:
                        repository._id
                }
            );

        return [persisted];
    };

const processIssueWebhook =
    async (
        repository,
        payload
    ) => {
        const normalizedSignal =
            normalizeWebhookIssue(
                payload,
                payload.action
            );

        if (!normalizedSignal) {
            return [];
        }

        const persisted =
            await githubSignalService.persistSignal(
                repository.project,
                {
                    ...normalizedSignal,
                    repository:
                        repository._id
                }
            );

        return [persisted];
    };

const processGithubWebhook =
    async ({
        event,
        payload
    }) => {
        if (
            !SUPPORTED_EVENTS.has(event)
        ) {
            const error = new Error(
                `Unsupported GitHub webhook event: ${event}`
            );

            error.statusCode = 400;
            error.code =
                "GITHUB_WEBHOOK_EVENT_UNSUPPORTED";

            throw error;
        }

        const repository =
            await findRepositoryFromPayload(
                payload
            );

        let signals = [];

        if (event === "push") {
            signals =
                await processPushWebhook(
                    repository,
                    payload
                );
        }

        if (
            event === "pull_request"
        ) {
            signals =
                await processPullRequestWebhook(
                    repository,
                    payload
                );
        }

        if (event === "issues") {
            signals =
                await processIssueWebhook(
                    repository,
                    payload
                );
        }

        return {
            repository,
            signals
        };
    };

module.exports = {
    getSupportedEvents,
    processGithubWebhook
};