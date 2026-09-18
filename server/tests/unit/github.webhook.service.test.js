const mongoose = require("mongoose");

const GithubRepository =
    require("../../src/modules/github/github.model");

const GithubSignal =
    require("../../src/modules/github/github.signal.model");

const {
    processGithubWebhook
} = require(
    "../../src/modules/github/github.webhook.service"
);

describe(
    "GitHub webhook processing service",
    () => {
        let projectId;
        let repository;

        beforeEach(async () => {
            await GithubSignal.deleteMany({});
            await GithubRepository.deleteMany({});

            projectId =
                new mongoose.Types.ObjectId();

            repository =
                await GithubRepository.create({
                    project: projectId,
                    owner: "flowforge",
                    repo: "backend",
                    fullName:
                        "flowforge/backend",
                    githubId: 12345,
                    defaultBranch: "main",
                    private: false
                });
        });

        test(
            "processes a push webhook",
            async () => {
                const result =
                    await processGithubWebhook({
                        event: "push",

                        payload: {
                            repository: {
                                id: 12345
                            },

                            ref:
                                "refs/heads/main",

                            commits: [
                                {
                                    id: "commit-1",
                                    message:
                                        "Fix auth",
                                    timestamp:
                                        "2026-09-17T10:00:00Z",

                                    author: {
                                        id: 10,
                                        login:
                                            "alice"
                                    }
                                },

                                {
                                    id: "commit-2",
                                    message:
                                        "Add tests",
                                    timestamp:
                                        "2026-09-17T10:05:00Z",

                                    author: {
                                        id: 11,
                                        login:
                                            "bob"
                                    }
                                }
                            ]
                        }
                    });

                expect(
                    result.signals
                ).toHaveLength(2);

                const signals =
                    await GithubSignal.find({
                        project: projectId
                    });

                expect(
                    signals
                ).toHaveLength(2);

                expect(
                    signals.map(
                        (signal) =>
                            signal.externalId
                    )
                ).toEqual(
                    expect.arrayContaining([
                        "commit-1",
                        "commit-2"
                    ])
                );
            }
        );

        test(
            "processes a pull request webhook",
            async () => {
                const result =
                    await processGithubWebhook({
                        event:
                            "pull_request",

                        payload: {
                            action: "opened",

                            repository: {
                                id: 12345
                            },

                            sender: {
                                id: 10,
                                login: "alice"
                            },

                            pull_request: {
                                id: 500,
                                number: 12,
                                title:
                                    "Add dashboard",
                                state: "open",

                                created_at:
                                    "2026-09-17T10:00:00Z",

                                updated_at:
                                    "2026-09-17T10:00:00Z"
                            }
                        }
                    });

                expect(
                    result.signals
                ).toHaveLength(1);

                expect(
                    result.signals[0].type
                ).toBe(
                    "PULL_REQUEST_OPENED"
                );

                expect(
                    result.signals[0].externalId
                ).toBe("pr:500:opened");
            }
        );

        test(
            "processes an issue webhook",
            async () => {
                const result =
                    await processGithubWebhook({
                        event: "issues",

                        payload: {
                            action: "opened",

                            repository: {
                                id: 12345
                            },

                            sender: {
                                id: 10,
                                login: "alice"
                            },

                            issue: {
                                id: 700,
                                number: 20,
                                title:
                                    "Fix login",
                                state: "open",

                                created_at:
                                    "2026-09-17T10:00:00Z",

                                updated_at:
                                    "2026-09-17T10:00:00Z"
                            }
                        }
                    });

                expect(
                    result.signals
                ).toHaveLength(1);

                expect(
                    result.signals[0].type
                ).toBe(
                    "ISSUE_OPENED"
                );
            }
        );

        test(
            "rejects an unsupported event",
            async () => {
                await expect(
                    processGithubWebhook({
                        event: "star",
                        payload: {}
                    })
                ).rejects.toMatchObject({
                    statusCode: 400,
                    code:
                        "GITHUB_WEBHOOK_EVENT_UNSUPPORTED"
                });
            }
        );

        test(
            "rejects an unconnected repository",
            async () => {
                await expect(
                    processGithubWebhook({
                        event: "push",

                        payload: {
                            repository: {
                                id: 99999
                            },

                            commits: []
                        }
                    })
                ).rejects.toMatchObject({
                    statusCode: 404,
                    code:
                        "GITHUB_REPOSITORY_NOT_CONNECTED"
                });
            }
        );
    }
);