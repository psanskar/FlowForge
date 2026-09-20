const {
    RISK_LIFECYCLE,
    getRiskIdentity,
    compareSeverity,
    analyzeRiskLifecycle
} =
    require(
        "../../src/modules/risks/risk.lifecycle.engine"
    );

describe(
    "risk.lifecycle.engine",
    () => {
        test(
            "creates a new risk",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [],
                        currentRisks: [
                            {
                                identity:
                                    "OVERDUE_TASK:task-1",
                                type:
                                    "OVERDUE_TASK",
                                severity:
                                    "HIGH"
                            }
                        ]
                    });

                expect(result).toEqual([
                    expect.objectContaining({
                        identity:
                            "OVERDUE_TASK:task-1",
                        lifecycle:
                            RISK_LIFECYCLE.NEW,
                        severity: "HIGH",
                        previousSeverity:
                            null
                    })
                ]);
            }
        );

        test(
            "detects a persistent risk",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "MEDIUM"
                            }
                        ],
                        currentRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "MEDIUM"
                            }
                        ]
                    });

                expect(result[0]).toEqual(
                    expect.objectContaining({
                        lifecycle:
                            RISK_LIFECYCLE.PERSISTENT,
                        previousSeverity:
                            "MEDIUM"
                    })
                );
            }
        );

        test(
            "detects escalation",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "MEDIUM"
                            }
                        ],
                        currentRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "HIGH"
                            }
                        ]
                    });

                expect(result[0]).toEqual(
                    expect.objectContaining({
                        lifecycle:
                            RISK_LIFECYCLE.ESCALATED,
                        previousSeverity:
                            "MEDIUM",
                        severity: "HIGH"
                    })
                );
            }
        );

        test(
            "detects de-escalation",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "HIGH"
                            }
                        ],
                        currentRisks: [
                            {
                                identity:
                                    "BLOCKED_TASK:task-1",
                                type:
                                    "BLOCKED_TASK",
                                severity:
                                    "MEDIUM"
                            }
                        ]
                    });

                expect(result[0]).toEqual(
                    expect.objectContaining({
                        lifecycle:
                            RISK_LIFECYCLE.DE_ESCALATED,
                        previousSeverity:
                            "HIGH",
                        severity: "MEDIUM"
                    })
                );
            }
        );

        test(
            "detects a resolved risk",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [
                            {
                                identity:
                                    "OVERDUE_TASK:task-1",
                                type:
                                    "OVERDUE_TASK",
                                severity:
                                    "HIGH"
                            }
                        ],
                        currentRisks: []
                    });

                expect(result[0]).toEqual(
                    expect.objectContaining({
                        identity:
                            "OVERDUE_TASK:task-1",
                        lifecycle:
                            RISK_LIFECYCLE.RESOLVED,
                        previousSeverity:
                            "HIGH"
                    })
                );
            }
        );

        test(
            "uses existing risk identity",
            () => {
                const risk = {
                    identity:
                        "CUSTOM:123",
                    type: "CUSTOM"
                };

                expect(
                    getRiskIdentity(risk)
                ).toBe("CUSTOM:123");
            }
        );

        test(
            "builds identity from task",
            () => {
                const risk = {
                    type:
                        "OVERDUE_TASK",
                    taskId: "task-123"
                };

                expect(
                    getRiskIdentity(risk)
                ).toBe(
                    "OVERDUE_TASK:task-123"
                );
            }
        );

        test(
            "compares severity correctly",
            () => {
                expect(
                    compareSeverity(
                        "MEDIUM",
                        "HIGH"
                    )
                ).toBe("ESCALATED");

                expect(
                    compareSeverity(
                        "HIGH",
                        "MEDIUM"
                    )
                ).toBe("DE_ESCALATED");

                expect(
                    compareSeverity(
                        "HIGH",
                        "HIGH"
                    )
                ).toBe("PERSISTENT");
            }
        );

        test(
            "handles multiple lifecycle changes",
            () => {
                const result =
                    analyzeRiskLifecycle({
                        previousRisks: [
                            {
                                identity:
                                    "RISK_A",
                                type: "RISK_A",
                                severity:
                                    "MEDIUM"
                            },
                            {
                                identity:
                                    "RISK_B",
                                type: "RISK_B",
                                severity:
                                    "HIGH"
                            }
                        ],
                        currentRisks: [
                            {
                                identity:
                                    "RISK_A",
                                type: "RISK_A",
                                severity:
                                    "HIGH"
                            },
                            {
                                identity:
                                    "RISK_C",
                                type: "RISK_C",
                                severity:
                                    "MEDIUM"
                            }
                        ]
                    });

                expect(result).toHaveLength(3);

                expect(
                    result
                        .find(
                            (risk) =>
                                risk.identity ===
                                "RISK_A"
                        )
                        .lifecycle
                ).toBe(
                    RISK_LIFECYCLE.ESCALATED
                );

                expect(
                    result
                        .find(
                            (risk) =>
                                risk.identity ===
                                "RISK_B"
                        )
                        .lifecycle
                ).toBe(
                    RISK_LIFECYCLE.RESOLVED
                );

                expect(
                    result
                        .find(
                            (risk) =>
                                risk.identity ===
                                "RISK_C"
                        )
                        .lifecycle
                ).toBe(
                    RISK_LIFECYCLE.NEW
                );
            }
        );
    }
);