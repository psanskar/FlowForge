const {
    normalizeWebhookPush,
    normalizeWebhookPullRequest,
    normalizeWebhookIssue
} = require(
    "../../src/modules/github/github.ingestion.service"
);

describe(
    "GitHub webhook normalization",
    () => {

        test(
            "normalizes push commits",
            () => {
                const payload = {
                    ref: "refs/heads/main",

                    repository: {
                        id: 123
                    },

                    commits: [
                        {
                            id: "abc123",

                            message:
                                "Fix authentication bug",

                            timestamp:
                                "2026-09-17T10:00:00Z",

                            author: {
                                id: 42,
                                login: "alice"
                            }
                        }
                    ]
                };

                const result =
                    normalizeWebhookPush(
                        payload
                    );

                expect(result).toHaveLength(1);

                expect(
                    result[0].type
                ).toBe("COMMIT");

                expect(
                    result[0].externalId
                ).toBe("abc123");

                expect(
                    result[0].actor
                ).toEqual({
                    id: 42,
                    login: "alice"
                });

                expect(
                    result[0].metadata.message
                ).toBe(
                    "Fix authentication bug"
                );

                expect(
                    result[0].metadata.branch
                ).toBe(
                    "refs/heads/main"
                );
            }
        );


        test(
            "normalizes pull request opened",
            () => {
                const payload = {
                    repository: {
                        id: 123
                    },

                    sender: {
                        id: 42,
                        login: "alice"
                    },

                    pull_request: {
                        id: 999,
                        number: 17,

                        title:
                            "Add dashboard",

                        state: "open",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T10:05:00Z",

                        user: {
                            id: 42,
                            login: "alice"
                        }
                    }
                };

                const result =
                    normalizeWebhookPullRequest(
                        payload,
                        "opened"
                    );

                expect(
                    result.type
                ).toBe(
                    "PULL_REQUEST_OPENED"
                );

                expect(
                    result.externalId
                ).toBe(
                    "pr:999:opened"
                );

                expect(
                    result.metadata.githubId
                ).toBe(999);

                expect(
                    result.metadata.number
                ).toBe(17);

                expect(
                    result.metadata.title
                ).toBe(
                    "Add dashboard"
                );
            }
        );


        test(
            "normalizes merged pull request",
            () => {
                const payload = {
                    repository: {
                        id: 123
                    },

                    sender: {
                        id: 42,
                        login: "alice"
                    },

                    pull_request: {
                        id: 999,
                        number: 17,

                        title:
                            "Add dashboard",

                        state: "closed",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T12:00:00Z",

                        merged_at:
                            "2026-09-17T12:00:00Z"
                    }
                };

                const result =
                    normalizeWebhookPullRequest(
                        payload,
                        "closed"
                    );

                expect(
                    result.type
                ).toBe(
                    "PULL_REQUEST_MERGED"
                );

                expect(
                    result.externalId
                ).toBe(
                    "pr:999:merged"
                );

                expect(
                    result.metadata.githubId
                ).toBe(999);

                expect(
                    result.metadata.merged
                ).toBe(true);
            }
        );


        test(
            "normalizes closed pull request",
            () => {
                const payload = {
                    repository: {
                        id: 123
                    },

                    pull_request: {
                        id: 999,
                        number: 17,

                        title:
                            "Old implementation",

                        state: "closed",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T12:00:00Z",

                        merged_at: null
                    }
                };

                const result =
                    normalizeWebhookPullRequest(
                        payload,
                        "closed"
                    );

                expect(
                    result.type
                ).toBe(
                    "PULL_REQUEST_CLOSED"
                );

                expect(
                    result.externalId
                ).toBe(
                    "pr:999:closed"
                );

                expect(
                    result.metadata.githubId
                ).toBe(999);

                expect(
                    result.metadata.merged
                ).toBe(false);
            }
        );


        test(
            "normalizes issue opened",
            () => {
                const payload = {
                    repository: {
                        id: 123
                    },

                    sender: {
                        id: 42,
                        login: "alice"
                    },

                    issue: {
                        id: 555,
                        number: 23,

                        title:
                            "Fix login bug",

                        state: "open",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T10:00:00Z"
                    }
                };

                const result =
                    normalizeWebhookIssue(
                        payload,
                        "opened"
                    );

                expect(
                    result.type
                ).toBe(
                    "ISSUE_OPENED"
                );

                expect(
                    result.externalId
                ).toBe(
                    "issue:555:opened"
                );

                expect(
                    result.metadata.githubId
                ).toBe(555);

                expect(
                    result.metadata.number
                ).toBe(23);
            }
        );


        test(
            "normalizes issue closed",
            () => {
                const payload = {
                    repository: {
                        id: 123
                    },

                    issue: {
                        id: 555,
                        number: 23,

                        title:
                            "Fix login bug",

                        state: "closed",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T12:00:00Z"
                    }
                };

                const result =
                    normalizeWebhookIssue(
                        payload,
                        "closed"
                    );

                expect(
                    result.type
                ).toBe(
                    "ISSUE_CLOSED"
                );

                expect(
                    result.externalId
                ).toBe(
                    "issue:555:closed"
                );

                expect(
                    result.metadata.githubId
                ).toBe(555);
            }
        );


        test(
            "ignores unsupported pull request action",
            () => {
                const payload = {
                    pull_request: {
                        id: 999
                    }
                };

                const result =
                    normalizeWebhookPullRequest(
                        payload,
                        "synchronize"
                    );

                expect(result).toBeNull();
            }
        );


        test(
            "ignores unsupported issue action",
            () => {
                const payload = {
                    issue: {
                        id: 555
                    }
                };

                const result =
                    normalizeWebhookIssue(
                        payload,
                        "reopened"
                    );

                expect(result).toBeNull();
            }
        );


        test(
            "uses different external IDs for PR lifecycle events",
            () => {
                const openedPayload = {
                    repository: {
                        id: 123
                    },

                    pull_request: {
                        id: 999,
                        number: 17,

                        title:
                            "Add dashboard",

                        state: "open",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T10:00:00Z",

                        merged_at: null
                    }
                };

                const mergedPayload = {
                    repository: {
                        id: 123
                    },

                    pull_request: {
                        id: 999,
                        number: 17,

                        title:
                            "Add dashboard",

                        state: "closed",

                        created_at:
                            "2026-09-17T10:00:00Z",

                        updated_at:
                            "2026-09-17T12:00:00Z",

                        merged_at:
                            "2026-09-17T12:00:00Z"
                    }
                };

                const opened =
                    normalizeWebhookPullRequest(
                        openedPayload,
                        "opened"
                    );

                const merged =
                    normalizeWebhookPullRequest(
                        mergedPayload,
                        "closed"
                    );

                expect(
                    opened.externalId
                ).toBe(
                    "pr:999:opened"
                );

                expect(
                    merged.externalId
                ).toBe(
                    "pr:999:merged"
                );

                expect(
                    opened.externalId
                ).not.toBe(
                    merged.externalId
                );
            }
        );

    }
);