const GithubRepository = require(
    "../../src/modules/github/github.model"
);

const githubClient = require(
    "../../src/modules/github/github.client"
);

const githubSignalService = require(
    "../../src/modules/github/github.signal.service"
);

const {
    normalizeCommit,
    normalizePullRequest,
    normalizeIssue,
    ingestRepositoryActivity
} = require(
    "../../src/modules/github/github.ingestion.service"
);

describe("GitHub ingestion normalization", () => {
    test("normalizes a commit into a COMMIT signal", () => {
        const commit = {
            sha: "abc123",
            commit: {
                author: {
                    date:
                        "2026-09-15T10:30:00Z"
                },
                message:
                    "Implement project dashboard"
            },
            author: {
                id: 101,
                login: "alice"
            }
        };

        expect(
            normalizeCommit(commit)
        ).toEqual({
            type: "COMMIT",
            externalId: "abc123",
            occurredAt:
                "2026-09-15T10:30:00Z",
            actor: {
                id: 101,
                login: "alice"
            },
            metadata: {
                message:
                    "Implement project dashboard"
            }
        });
    });

    test("normalizes an opened pull request", () => {
        const pullRequest = {
            id: 500,
            number: 42,
            title:
                "Add project dashboard",
            state: "open",
            merged_at: null,
            created_at:
                "2026-09-15T11:00:00Z",
            user: {
                id: 102,
                login: "bob"
            }
        };

        expect(
            normalizePullRequest(
                pullRequest
            )
        ).toEqual({
            type:
                "PULL_REQUEST_OPENED",
            externalId: "pr:500",
            occurredAt:
                "2026-09-15T11:00:00Z",
            actor: {
                id: 102,
                login: "bob"
            },
            metadata: {
                number: 42,
                title:
                    "Add project dashboard",
                state: "open",
                merged: false
            }
        });
    });

    test("normalizes a merged pull request", () => {
        const pullRequest = {
            id: 501,
            number: 43,
            title:
                "Implement dashboard API",
            state: "closed",
            merged_at:
                "2026-09-15T12:00:00Z",
            created_at:
                "2026-09-15T11:30:00Z",
            user: {
                id: 103,
                login: "charlie"
            }
        };

        const signal =
            normalizePullRequest(
                pullRequest
            );

        expect(
            signal.type
        ).toBe(
            "PULL_REQUEST_MERGED"
        );

        expect(
            signal.externalId
        ).toBe("pr:501");

        expect(
            signal.metadata.merged
        ).toBe(true);
    });

    test("normalizes a closed pull request", () => {
        const pullRequest = {
            id: 502,
            number: 44,
            title:
                "Close outdated feature",
            state: "closed",
            merged_at: null,
            created_at:
                "2026-09-15T13:00:00Z",
            user: {
                id: 104,
                login: "david"
            }
        };

        const signal =
            normalizePullRequest(
                pullRequest
            );

        expect(
            signal.type
        ).toBe(
            "PULL_REQUEST_CLOSED"
        );

        expect(
            signal.externalId
        ).toBe("pr:502");
    });

    test("normalizes an opened issue", () => {
        const issue = {
            id: 700,
            number: 20,
            title:
                "Dashboard loading slowly",
            state: "open",
            created_at:
                "2026-09-15T14:00:00Z",
            user: {
                id: 105,
                login: "eve"
            }
        };

        expect(
            normalizeIssue(issue)
        ).toEqual({
            type: "ISSUE_OPENED",
            externalId: "issue:700",
            occurredAt:
                "2026-09-15T14:00:00Z",
            actor: {
                id: 105,
                login: "eve"
            },
            metadata: {
                number: 20,
                title:
                    "Dashboard loading slowly",
                state: "open"
            }
        });
    });

    test("normalizes a closed issue", () => {
        const issue = {
            id: 701,
            number: 21,
            title:
                "Fix deployment issue",
            state: "closed",
            created_at:
                "2026-09-15T15:00:00Z",
            user: {
                id: 106,
                login: "frank"
            }
        };

        const signal =
            normalizeIssue(issue);

        expect(
            signal.type
        ).toBe("ISSUE_CLOSED");

        expect(
            signal.externalId
        ).toBe("issue:701");
    });

    test("uses different namespaces for PR and issue IDs", () => {
        const pullRequest = {
            id: 900,
            number: 50,
            title: "Test PR",
            state: "open",
            merged_at: null,
            created_at:
                "2026-09-15T16:00:00Z",
            user: {
                id: 107,
                login: "grace"
            }
        };

        const issue = {
            id: 900,
            number: 51,
            title: "Test issue",
            state: "open",
            created_at:
                "2026-09-15T17:00:00Z",
            user: {
                id: 108,
                login: "henry"
            }
        };

        expect(
            normalizePullRequest(
                pullRequest
            ).externalId
        ).toBe("pr:900");

        expect(
            normalizeIssue(
                issue
            ).externalId
        ).toBe("issue:900");
    });

    test("handles a missing GitHub actor", () => {
        const commit = {
            sha: "missing-actor",
            commit: {
                author: {
                    date:
                        "2026-09-15T18:00:00Z"
                },
                message:
                    "Commit without actor"
            },
            author: null
        };

        expect(
            normalizeCommit(commit)
        ).toEqual({
            type: "COMMIT",
            externalId:
                "missing-actor",
            occurredAt:
                "2026-09-15T18:00:00Z",
            actor: {
                id: null,
                login: null
            },
            metadata: {
                message:
                    "Commit without actor"
            }
        });
    });
});

describe("GitHub repository activity ingestion", () => {
    const projectId =
        "68b1f0000000000000000001";

    const repositoryId =
        "68b1f0000000000000000002";

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    test("ingests commits, pull requests, and issues", async () => {
        jest.spyOn(
            GithubRepository,
            "findOne"
        ).mockResolvedValue({
            _id: repositoryId,
            project: projectId,
            owner: "flowforge",
            repo: "backend"
        });

        jest.spyOn(
            githubClient,
            "getCommits"
        ).mockResolvedValue([
            {
                sha: "commit-1",
                commit: {
                    author: {
                        date:
                            "2026-09-15T10:00:00Z"
                    },
                    message:
                        "Add dashboard"
                },
                author: {
                    id: 1,
                    login: "alice"
                }
            }
        ]);

        jest.spyOn(
            githubClient,
            "getPullRequests"
        ).mockResolvedValue([
            {
                id: 100,
                number: 10,
                title:
                    "Add dashboard",
                state: "open",
                merged_at: null,
                created_at:
                    "2026-09-15T11:00:00Z",
                user: {
                    id: 2,
                    login: "bob"
                }
            }
        ]);

        jest.spyOn(
            githubClient,
            "getIssues"
        ).mockResolvedValue([
            {
                id: 200,
                number: 20,
                title:
                    "Dashboard bug",
                state: "open",
                created_at:
                    "2026-09-15T12:00:00Z",
                user: {
                    id: 3,
                    login: "charlie"
                }
            }
        ]);

        const persistSignal =
            jest.spyOn(
                githubSignalService,
                "persistSignal"
            ).mockImplementation(
                async (
                    projectId,
                    signal
                ) => ({
                    project:
                        projectId,
                    ...signal
                })
            );

        const result =
            await ingestRepositoryActivity(
                projectId
            );

        expect(
            result.commits
        ).toHaveLength(1);

        expect(
            result.pullRequests
        ).toHaveLength(1);

        expect(
            result.issues
        ).toHaveLength(1);

        expect(
            persistSignal
        ).toHaveBeenCalledTimes(3);
    });

    test("passes repository owner and repo to GitHub client", async () => {
        jest.spyOn(
            GithubRepository,
            "findOne"
        ).mockResolvedValue({
            _id: repositoryId,
            project: projectId,
            owner: "flowforge",
            repo: "backend"
        });

        const getCommits =
            jest.spyOn(
                githubClient,
                "getCommits"
            ).mockResolvedValue([]);

        const getPullRequests =
            jest.spyOn(
                githubClient,
                "getPullRequests"
            ).mockResolvedValue([]);

        const getIssues =
            jest.spyOn(
                githubClient,
                "getIssues"
            ).mockResolvedValue([]);

        jest.spyOn(
            githubSignalService,
            "persistSignal"
        ).mockResolvedValue({});

        await ingestRepositoryActivity(
            projectId,
            {
                perPage: 20,
                page: 3
            }
        );

        expect(
            getCommits
        ).toHaveBeenCalledWith(
            "flowforge",
            "backend",
            {
                perPage: 20,
                page: 3
            }
        );

        expect(
            getPullRequests
        ).toHaveBeenCalledWith(
            "flowforge",
            "backend",
            {
                state: "all",
                perPage: 20,
                page: 3
            }
        );

        expect(
            getIssues
        ).toHaveBeenCalledWith(
            "flowforge",
            "backend",
            {
                state: "all",
                perPage: 20,
                page: 3
            }
        );
    });

    test("skips pull requests returned by the issues endpoint", async () => {
        jest.spyOn(
            GithubRepository,
            "findOne"
        ).mockResolvedValue({
            _id: repositoryId,
            project: projectId,
            owner: "flowforge",
            repo: "backend"
        });

        jest.spyOn(
            githubClient,
            "getCommits"
        ).mockResolvedValue([]);

        jest.spyOn(
            githubClient,
            "getPullRequests"
        ).mockResolvedValue([]);

        jest.spyOn(
            githubClient,
            "getIssues"
        ).mockResolvedValue([
            {
                id: 300,
                number: 30,
                title:
                    "This is actually a PR",
                state: "closed",
                created_at:
                    "2026-09-15T13:00:00Z",
                user: {
                    id: 4,
                    login: "david"
                },
                pull_request: {
                    url:
                        "https://api.github.com/repos/flowforge/backend/pulls/30"
                }
            },
            {
                id: 301,
                number: 31,
                title:
                    "Real issue",
                state: "open",
                created_at:
                    "2026-09-15T14:00:00Z",
                user: {
                    id: 5,
                    login: "eve"
                }
            }
        ]);

        const persistSignal =
            jest.spyOn(
                githubSignalService,
                "persistSignal"
            ).mockResolvedValue({});

        const result =
            await ingestRepositoryActivity(
                projectId
            );

        expect(
            result.issues
        ).toHaveLength(1);

        expect(
            result.issues[0].externalId
        ).toBe("issue:301");

        expect(
            persistSignal
        ).toHaveBeenCalledTimes(1);
    });

    test("persists normalized signals with the connected repository", async () => {
        jest.spyOn(
            GithubRepository,
            "findOne"
        ).mockResolvedValue({
            _id: repositoryId,
            project: projectId,
            owner: "flowforge",
            repo: "backend"
        });

        jest.spyOn(
            githubClient,
            "getCommits"
        ).mockResolvedValue([
            {
                sha: "commit-2",
                commit: {
                    author: {
                        date:
                            "2026-09-15T15:00:00Z"
                    },
                    message:
                        "Fix risk calculation"
                },
                author: {
                    id: 6,
                    login: "frank"
                }
            }
        ]);

        jest.spyOn(
            githubClient,
            "getPullRequests"
        ).mockResolvedValue([]);

        jest.spyOn(
            githubClient,
            "getIssues"
        ).mockResolvedValue([]);

        const persistSignal =
            jest.spyOn(
                githubSignalService,
                "persistSignal"
            ).mockResolvedValue({});

        await ingestRepositoryActivity(
            projectId
        );

        expect(
            persistSignal
        ).toHaveBeenCalledWith(
            projectId,
            expect.objectContaining({
                type: "COMMIT",
                externalId: "commit-2",
                repository:
                    repositoryId
            })
        );
    });

    test("throws when the project has no connected GitHub repository", async () => {
        jest.spyOn(
            GithubRepository,
            "findOne"
        ).mockResolvedValue(null);

        await expect(
            ingestRepositoryActivity(
                projectId
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code:
                "GITHUB_REPOSITORY_NOT_CONNECTED"
        });
    });
});