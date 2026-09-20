const {
    analyzeGithubProject
} = require("../../src/modules/risks/github.risk.engine");

describe("GitHub Risk Engine", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");

    const createSignal = ({
        type,
        occurredAt,
        externalId,
        metadata = {}
    }) => ({
        type,
        occurredAt: new Date(occurredAt),
        externalId,
        metadata
    });

    describe("Aging pull requests", () => {
        test("does not flag an open PR younger than 7 days", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "pr:101:opened",
                    metadata: {
                        githubId: 101,
                        number: 101,
                        title: "Recent feature"
                    }
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(risks).toEqual([]);
        });
    });

    describe("Issue backlog", () => {
        test("flags growing issue backlog", () => {
            const signals = [
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "issue:201:opened"
                }),
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-11T12:00:00.000Z",
                    externalId: "issue:202:opened"
                }),
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "issue:203:opened"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(risks).toHaveLength(1);

            expect(risks[0]).toMatchObject({
                type: "GITHUB_ISSUE_BACKLOG",
                severity: "MEDIUM",
                windowDays: 14,
                openedCount: 3,
                closedCount: 0,
                backlogGrowth: 3
            });
        });

        test("does not flag backlog when issues are being closed", () => {
            const signals = [
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "issue:204:opened"
                }),
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-11T12:00:00.000Z",
                    externalId: "issue:205:opened"
                }),
                createSignal({
                    type: "ISSUE_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "issue:206:opened"
                }),
                createSignal({
                    type: "ISSUE_CLOSED",
                    occurredAt: "2026-09-13T12:00:00.000Z",
                    externalId: "issue:204:closed"
                }),
                createSignal({
                    type: "ISSUE_CLOSED",
                    occurredAt: "2026-09-14T12:00:00.000Z",
                    externalId: "issue:205:closed"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(risks).toEqual([]);
        });
    });

    describe("Pull request merge throughput", () => {   
        test("flags low merge throughput when no PRs are merged", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:301:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-11T12:00:00.000Z",
                    externalId: "pr:302:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "pr:303:opened"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            const throughputRisk = risks.find(
                (risk) =>
                    risk.type ===
                    "GITHUB_LOW_MERGE_THROUGHPUT"
            );

            expect(throughputRisk).toBeDefined();

            expect(throughputRisk).toMatchObject({
                type: "GITHUB_LOW_MERGE_THROUGHPUT",
                severity: "MEDIUM",
                windowDays: 14,
                openedCount: 3,
                mergedCount: 0
            });
        });

        test("does not flag normal merge throughput", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:304:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-11T12:00:00.000Z",
                    externalId: "pr:305:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "pr:306:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-13T12:00:00.000Z",
                    externalId: "pr:304:merged"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(risks).toEqual([]);
        });
    });

        describe("Pull request cycle time", () => {
        test("flags elevated median PR cycle time", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-01T12:00:00.000Z",
                    externalId: "pr:401:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-05T12:00:00.000Z",
                    externalId: "pr:401:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-02T12:00:00.000Z",
                    externalId: "pr:402:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-07T12:00:00.000Z",
                    externalId: "pr:402:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-03T12:00:00.000Z",
                    externalId: "pr:403:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:403:merged"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            const cycleTimeRisk = risks.find(
                (risk) =>
                    risk.type ===
                    "GITHUB_HIGH_PR_CYCLE_TIME"
            );

            expect(cycleTimeRisk).toBeDefined();

            expect(cycleTimeRisk).toMatchObject({
            type: "GITHUB_HIGH_PR_CYCLE_TIME",
            severity: "MEDIUM",
            mergedPrCount: 3,
            medianCycleTimeHours: 120
        });
        });

        test("flags very high median PR cycle time as HIGH", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-03T12:00:00.000Z",
                    externalId: "pr:408:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:408:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-03T12:00:00.000Z",
                    externalId: "pr:409:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:409:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-03T12:00:00.000Z",
                    externalId: "pr:410:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:410:merged"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            const cycleTimeRisk = risks.find(
                (risk) =>
                    risk.type ===
                    "GITHUB_HIGH_PR_CYCLE_TIME"
            );

            expect(cycleTimeRisk).toBeDefined();

            expect(cycleTimeRisk).toMatchObject({
                type: "GITHUB_HIGH_PR_CYCLE_TIME",
                severity: "HIGH",
                mergedPrCount: 3,
                medianCycleTimeHours: 168
            });
        });

        test("does not flag normal PR cycle time", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-14T12:00:00.000Z",
                    externalId: "pr:404:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-15T12:00:00.000Z",
                    externalId: "pr:404:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-13T12:00:00.000Z",
                    externalId: "pr:405:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-14T12:00:00.000Z",
                    externalId: "pr:405:merged"
                }),

                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-12T12:00:00.000Z",
                    externalId: "pr:406:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-13T12:00:00.000Z",
                    externalId: "pr:406:merged"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(
                risks.some(
                    (risk) =>
                        risk.type ===
                        "GITHUB_HIGH_PR_CYCLE_TIME"
                )
            ).toBe(false);
        });

        test("does not evaluate cycle time with fewer than three merged PRs", () => {
            const signals = [
                createSignal({
                    type: "PULL_REQUEST_OPENED",
                    occurredAt: "2026-09-01T12:00:00.000Z",
                    externalId: "pr:407:opened"
                }),
                createSignal({
                    type: "PULL_REQUEST_MERGED",
                    occurredAt: "2026-09-10T12:00:00.000Z",
                    externalId: "pr:407:merged"
                })
            ];

            const risks = analyzeGithubProject({
                githubSignals: signals,
                now
            });

            expect(
                risks.some(
                    (risk) =>
                        risk.type ===
                        "GITHUB_HIGH_PR_CYCLE_TIME"
                )
            ).toBe(false);
        });
    });

    test("flags an open PR at 7 days as MEDIUM risk", () => {
        const signals = [
            createSignal({
                type: "PULL_REQUEST_OPENED",
                occurredAt: "2026-09-10T12:00:00.000Z",
                externalId: "pr:102:opened",
                metadata: {
                    githubId: 102,
                    number: 102,
                    title: "Delayed feature"
                }
            })
        ];

        const risks = analyzeGithubProject({
            githubSignals: signals,
            now
        });

        expect(risks).toHaveLength(1);

        expect(risks[0]).toMatchObject({
            type: "GITHUB_AGING_PR",
            severity: "MEDIUM",
            githubPrId: "102",
            prNumber: 102,
            title: "Delayed feature",
            ageDays: 7
        });
    });

    test("flags an open PR at 14 days as HIGH risk", () => {
        const signals = [
            createSignal({
                type: "PULL_REQUEST_OPENED",
                occurredAt: "2026-09-03T12:00:00.000Z",
                externalId: "pr:103:opened",
                metadata: {
                    githubId: 103,
                    number: 103,
                    title: "Long-running feature"
                }
            })
        ];

        const risks = analyzeGithubProject({
            githubSignals: signals,
            now
        });

        expect(risks).toHaveLength(1);

        expect(risks[0]).toMatchObject({
            type: "GITHUB_AGING_PR",
            severity: "HIGH",
            githubPrId: "103",
            prNumber: 103,
            title: "Long-running feature",
            ageDays: 14
        });
    });

    test("does not flag a PR that was already merged", () => {
        const signals = [
            createSignal({
                type: "PULL_REQUEST_OPENED",
                occurredAt: "2026-08-20T12:00:00.000Z",
                externalId: "pr:104:opened",
                metadata: {
                    githubId: 104,
                    number: 104,
                    title: "Completed feature"
                }
            }),
            createSignal({
                type: "PULL_REQUEST_MERGED",
                occurredAt: "2026-08-25T12:00:00.000Z",
                externalId: "pr:104:merged",
                metadata: {
                    githubId: 104,
                    number: 104,
                    title: "Completed feature"
                }
            })
        ];

        const risks = analyzeGithubProject({
            githubSignals: signals,
            now
        });

        expect(risks).toEqual([]);
    });
});