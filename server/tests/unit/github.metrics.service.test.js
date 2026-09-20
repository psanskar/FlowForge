const {
    calculateMedian,
    calculatePullRequestMetrics,
    calculateIssueMetrics,
    calculateCommitMetrics
} = require(
    "../../src/modules/github/github.metrics.service"
);

describe(
    "GitHub metrics service",
    () => {
        const now =
            new Date(
                "2026-09-19T12:00:00.000Z"
            );

        const rangeStart =
            new Date(
                "2026-08-20T12:00:00.000Z"
            );

        const signal = ({
            type,
            occurredAt,
            githubId
        }) => ({
            type,
            occurredAt:
                new Date(occurredAt),
            metadata: {
                githubId
            }
        });

        describe(
            "calculateMedian",
            () => {
                test(
                    "returns null for empty values",
                    () => {
                        expect(
                            calculateMedian([])
                        ).toBeNull();
                    }
                );

                test(
                    "returns middle value for odd-length array",
                    () => {
                        expect(
                            calculateMedian([
                                10,
                                2,
                                7
                            ])
                        ).toBe(7);
                    }
                );

                test(
                    "returns average of middle values for even-length array",
                    () => {
                        expect(
                            calculateMedian([
                                10,
                                2,
                                8,
                                4
                            ])
                        ).toBe(6);
                    }
                );
            }
        );

        describe(
            "calculatePullRequestMetrics",
            () => {
                test(
                    "calculates PR opened and merged counts",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-01T10:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-02T10:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-10T10:00:00.000Z",
                                githubId: 102
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.opened
                        ).toBe(2);

                        expect(
                            result.merged
                        ).toBe(1);

                        expect(
                            result.open
                        ).toBe(1);
                    }
                );

                test(
                    "calculates PR cycle time",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-01T10:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-02T10:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-03T10:00:00.000Z",
                                githubId: 102
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-03T16:00:00.000Z",
                                githubId: 102
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.averageCycleTimeHours
                        ).toBe(15);

                        expect(
                            result.medianCycleTimeHours
                        ).toBe(15);
                    }
                );

                test(
                    "calculates median cycle time independently from average",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-01T00:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-01T01:00:00.000Z",
                                githubId: 101
                            }),

                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-02T00:00:00.000Z",
                                githubId: 102
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-02T02:00:00.000Z",
                                githubId: 102
                            }),

                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-03T00:00:00.000Z",
                                githubId: 103
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-13T00:00:00.000Z",
                                githubId: 103
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.averageCycleTimeHours
                        ).toBe(81);

                        expect(
                            result.medianCycleTimeHours
                        ).toBe(2);
                    }
                );

                test(
                    "calculates oldest open PR age",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-15T12:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-10T12:00:00.000Z",
                                githubId: 102
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.open
                        ).toBe(2);

                        expect(
                            result.oldestOpenPrAgeHours
                        ).toBe(216);
                    }
                );

                test(
                    "does not count a closed PR as open",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-10T12:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_CLOSED",
                                occurredAt:
                                    "2026-09-12T12:00:00.000Z",
                                githubId: 101
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.open
                        ).toBe(0);
                    }
                );

                test(
                    "does not count a merged PR as open",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-10T12:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-12T12:00:00.000Z",
                                githubId: 101
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.open
                        ).toBe(0);
                    }
                );

                test(
                    "does not include PRs opened before the selected range in opened count",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-08-01T12:00:00.000Z",
                                githubId: 101
                            }),
                            signal({
                                type:
                                    "PULL_REQUEST_MERGED",
                                occurredAt:
                                    "2026-09-01T12:00:00.000Z",
                                githubId: 101
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.opened
                        ).toBe(0);

                        expect(
                            result.merged
                        ).toBe(1);

                        expect(
                            result.averageCycleTimeHours
                        ).toBe(744);
                    }
                );

                test(
                    "returns null cycle metrics when no PRs were merged",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "PULL_REQUEST_OPENED",
                                occurredAt:
                                    "2026-09-10T12:00:00.000Z",
                                githubId: 101
                            })
                        ];

                        const result =
                            calculatePullRequestMetrics({
                                lifecycleSignals:
                                    signals,
                                rangeStart,
                                now
                            });

                        expect(
                            result.averageCycleTimeHours
                        ).toBeNull();

                        expect(
                            result.medianCycleTimeHours
                        ).toBeNull();
                    }
                );
            }
        );

        describe(
            "calculateIssueMetrics",
            () => {
                test(
                    "calculates issue opened, closed, and net change",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "ISSUE_OPENED",
                                occurredAt:
                                    "2026-09-01T10:00:00.000Z",
                                githubId: 201
                            }),
                            signal({
                                type:
                                    "ISSUE_OPENED",
                                occurredAt:
                                    "2026-09-02T10:00:00.000Z",
                                githubId: 202
                            }),
                            signal({
                                type:
                                    "ISSUE_CLOSED",
                                occurredAt:
                                    "2026-09-03T10:00:00.000Z",
                                githubId: 201
                            })
                        ];

                        const result =
                            calculateIssueMetrics({
                                signals,
                                rangeStart
                            });

                        expect(
                            result.opened
                        ).toBe(2);

                        expect(
                            result.closed
                        ).toBe(1);

                        expect(
                            result.netChange
                        ).toBe(1);
                    }
                );

                test(
                    "ignores issues outside the selected range",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "ISSUE_OPENED",
                                occurredAt:
                                    "2026-08-01T10:00:00.000Z",
                                githubId: 201
                            }),
                            signal({
                                type:
                                    "ISSUE_CLOSED",
                                occurredAt:
                                    "2026-09-03T10:00:00.000Z",
                                githubId: 201
                            })
                        ];

                        const result =
                            calculateIssueMetrics({
                                signals,
                                rangeStart
                            });

                        expect(
                            result.opened
                        ).toBe(0);

                        expect(
                            result.closed
                        ).toBe(1);

                        expect(
                            result.netChange
                        ).toBe(-1);
                    }
                );
            }
        );

        describe(
            "calculateCommitMetrics",
            () => {
                test(
                    "counts commits inside the selected range",
                    () => {
                        const signals = [
                            signal({
                                type:
                                    "COMMIT",
                                occurredAt:
                                    "2026-09-01T10:00:00.000Z",
                                githubId: null
                            }),
                            signal({
                                type:
                                    "COMMIT",
                                occurredAt:
                                    "2026-09-02T10:00:00.000Z",
                                githubId: null
                            }),
                            signal({
                                type:
                                    "COMMIT",
                                occurredAt:
                                    "2026-08-01T10:00:00.000Z",
                                githubId: null
                            })
                        ];

                        const result =
                            calculateCommitMetrics({
                                signals,
                                rangeStart
                            });

                        expect(
                            result.count
                        ).toBe(2);
                    }
                );

                test(
                    "returns zero when there are no commits",
                    () => {
                        const result =
                            calculateCommitMetrics({
                                signals: [],
                                rangeStart
                            });

                        expect(
                            result.count
                        ).toBe(0);
                    }
                );
            }
        );
    }
);