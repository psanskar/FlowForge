const request = require("supertest");

const app = require(
    "../../src/app"
);

const User = require(
    "../../src/modules/users/user.model"
);

const Project = require(
    "../../src/modules/projects/project.model"
);

const GithubRepository = require(
    "../../src/modules/github/github.model"
);

const GithubSignal = require(
    "../../src/modules/github/github.signal.model"
);
const GithubPullRequestState = require(
    "../../src/modules/github/github.pullRequestState.model"
);

describe(
    "GitHub Metrics API",
    () => {
        let token;
        let userId;
        let projectId;
        let repositoryId;

        beforeEach(
            async () => {
                await User.deleteMany({});
                await Project.deleteMany({});
                await GithubRepository.deleteMany({});
                await GithubSignal.deleteMany({});
                await GithubPullRequestState.deleteMany({});

                const registerResponse =
                    await request(app)
                        .post(
                            "/api/v1/auth/register"
                        )
                        .send({
                            name:
                                "GitHub Metrics Test User",
                            email:
                                "github-metrics-test@flowforge.local",
                            password:
                                "TestPassword123"
                        });

                expect(
                    registerResponse.status
                ).toBe(201);

                userId =
                    registerResponse.body
                        .data.user.id;

                const loginResponse =
                    await request(app)
                        .post(
                            "/api/v1/auth/login"
                        )
                        .send({
                            email:
                                "github-metrics-test@flowforge.local",
                            password:
                                "TestPassword123"
                        });

                expect(
                    loginResponse.status
                ).toBe(200);

                token =
                    loginResponse.body
                        .data.token;

                const projectResponse =
                    await request(app)
                        .post(
                            "/api/v1/projects"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        )
                        .send({
                            name:
                                "GitHub Metrics Test Project"
                        });

                expect(
                    projectResponse.status
                ).toBe(201);

                projectId =
                    projectResponse.body
                        .data.project._id;

                const repository =
                    await GithubRepository.create({
                        project:
                            projectId,
                        owner:
                            "example",
                        repo:
                            "flowforge-metrics",
                        fullName:
                            "example/flowforge-metrics",
                        githubId:
                            123456,
                        defaultBranch:
                            "main",
                        private:
                            false
                    });

                repositoryId =
                    repository._id;
            }
        );

        const daysAgo = (days) =>
            new Date(
                Date.now() -
                    days * 24 * 60 * 60 * 1000
            ).toISOString();

        const createSignal = async ({
            type,
            externalId,
            occurredAt,
            githubId = null
        }) => {
            return GithubSignal.create({
                project:
                    projectId,
                repository:
                    repositoryId,
                type,
                externalId,
                occurredAt:
                    new Date(occurredAt),
                metadata:
                    githubId !== null
                        ? {
                              githubId
                          }
                        : {}
            });
        };

        test(
            "returns GitHub execution metrics for a project member",
            async () => {
                await createSignal({
                    type:
                        "PULL_REQUEST_OPENED",
                    externalId:
                        "pr:101:opened",
                    occurredAt:
                        daysAgo(20),
                    githubId:
                        101
                });

                await createSignal({
                    type:
                        "PULL_REQUEST_MERGED",
                    externalId:
                        "pr:101:merged",
                    occurredAt:
                        daysAgo(19),
                    githubId:
                        101
                });

                await createSignal({
                    type:
                        "PULL_REQUEST_OPENED",
                    externalId:
                        "pr:102:opened",
                    occurredAt:
                        daysAgo(10),
                    githubId:
                        102
                });

                await createSignal({
                    type:
                        "ISSUE_OPENED",
                    externalId:
                        "issue:201:opened",
                    occurredAt:
                        daysAgo(15),
                    githubId:
                        201
                });

                await createSignal({
                    type:
                        "ISSUE_CLOSED",
                    externalId:
                        "issue:202:closed",
                    occurredAt:
                        daysAgo(14),
                    githubId:
                        202
                });

                await createSignal({
                    type:
                        "COMMIT",
                    externalId:
                        "commit:abc123",
                    occurredAt:
                        daysAgo(13)
                });

                await createSignal({
                    type:
                        "COMMIT",
                    externalId:
                        "commit:def456",
                    occurredAt:
                        daysAgo(12)
                });

                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics?days=30`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    response.status
                ).toBe(200);

                expect(
                    response.body
                ).toEqual({
                    projectId,
                    range:
                        "30d",
                    pullRequests: {
                        opened: 2,
                        merged: 1,
                        open: 1,
                        averageCycleTimeHours:
                            24,
                        medianCycleTimeHours:
                            24,
                        oldestOpenPrAgeHours:
                            expect.any(Number)
                    },
                    issues: {
                        opened: 1,
                        closed: 1,
                        netChange: 0
                    },
                    commits: {
                        count: 2
                    }
                });

                expect(
                    await GithubPullRequestState.countDocuments({
                        project: projectId
                    })
                ).toBe(2);

                const repositoryState =
                    await GithubRepository.findById(
                        repositoryId
                    ).select("pullRequestStateVersion").lean();

                expect(
                    repositoryState.pullRequestStateVersion
                ).toBe(1);
            }
        );

        test(
            "defaults to a 30 day range",
            async () => {
                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    response.status
                ).toBe(200);

                expect(
                    response.body.range
                ).toBe("30d");
            }
        );

        test(
            "counts a reopened pull request as open after a later reopen event",
            async () => {
                await createSignal({
                    type: "PULL_REQUEST_OPENED",
                    externalId: "pr:301:opened",
                    occurredAt: daysAgo(8),
                    githubId: 301
                });
                await createSignal({
                    type: "PULL_REQUEST_CLOSED",
                    externalId: "pr:301:closed",
                    occurredAt: daysAgo(4),
                    githubId: 301
                });
                await createSignal({
                    type: "PULL_REQUEST_OPENED",
                    externalId: "pr:301:reopened",
                    occurredAt: daysAgo(2),
                    githubId: 301
                });

                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics?days=30`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(response.status).toBe(200);
                expect(response.body.pullRequests).toMatchObject({
                    opened: 2,
                    merged: 0,
                    open: 1
                });
            }
        );

        test(
            "includes an older currently open PR in a short metrics range",
            async () => {
                await createSignal({
                    type: "PULL_REQUEST_OPENED",
                    externalId: "pr:302:opened",
                    occurredAt: daysAgo(50),
                    githubId: 302
                });

                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics?days=7`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(response.status).toBe(200);
                expect(response.body.pullRequests).toMatchObject({
                    opened: 0,
                    merged: 0,
                    open: 1,
                    oldestOpenPrAgeHours: 1200
                });
            }
        );

        test(
            "accepts supported metric ranges",
            async () => {
                const supportedDays = [
                    7,
                    14,
                    30,
                    60,
                    90
                ];

                for (
                    const days of supportedDays
                ) {
                    const response =
                        await request(app)
                            .get(
                                `/api/v1/projects/${projectId}/github/metrics?days=${days}`
                            )
                            .set(
                                "Authorization",
                                `Bearer ${token}`
                            );

                    expect(
                        response.status
                    ).toBe(200);

                    expect(
                        response.body.range
                    ).toBe(
                        `${days}d`
                    );
                }
            }
        );

        test(
            "rejects an unsupported metric range",
            async () => {
                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics?days=10`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    response.status
                ).toBe(400);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "INVALID_GITHUB_METRICS_RANGE"
                );
            }
        );

        test(
            "rejects a non-integer metric range",
            async () => {
                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics?days=30.5`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    response.status
                ).toBe(400);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "INVALID_GITHUB_METRICS_RANGE"
                );
            }
        );

        test(
            "rejects an invalid project ID",
            async () => {
                const response =
                    await request(app)
                        .get(
                            "/api/v1/projects/not-a-valid-id/github/metrics"
                        )
                        .set(
                            "Authorization",
                            `Bearer ${token}`
                        );

                expect(
                    response.status
                ).toBe(400);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "INVALID_ID"
                );
            }
        );

        test(
            "rejects access without authentication",
            async () => {
                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics`
                        );

                expect(
                    response.status
                ).toBe(401);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "AUTHENTICATION_REQUIRED"
                );
            }
        );

        test(
            "rejects access for a user who is not a project member",
            async () => {
                const otherUserResponse =
                    await request(app)
                        .post(
                            "/api/v1/auth/register"
                        )
                        .send({
                            name:
                                "Other Metrics User",
                            email:
                                "other-metrics-user@flowforge.local",
                            password:
                                "TestPassword123"
                        });

                expect(
                    otherUserResponse.status
                ).toBe(201);

                const otherLoginResponse =
                    await request(app)
                        .post(
                            "/api/v1/auth/login"
                        )
                        .send({
                            email:
                                "other-metrics-user@flowforge.local",
                            password:
                                "TestPassword123"
                        });

                expect(
                    otherLoginResponse.status
                ).toBe(200);

                const otherToken =
                    otherLoginResponse.body
                        .data.token;

                const response =
                    await request(app)
                        .get(
                            `/api/v1/projects/${projectId}/github/metrics`
                        )
                        .set(
                            "Authorization",
                            `Bearer ${otherToken}`
                        );

                expect(
                    response.status
                ).toBe(404);

                expect(
                    response.body.success
                ).toBe(false);

                expect(
                    response.body.error.code
                ).toBe(
                    "PROJECT_NOT_FOUND"
                );
            }
        );
    }
);
