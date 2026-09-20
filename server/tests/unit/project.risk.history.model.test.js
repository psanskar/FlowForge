const ProjectRiskHistory =
    require(
        "../../src/modules/risks/project.risk.history.model"
    );

describe(
    "ProjectRiskHistory model",
    () => {
        test(
            "accepts a valid active risk history document",
            () => {
                const document =
                    new ProjectRiskHistory({
                        project:
                            "507f1f77bcf86cd799439011",

                        identity:
                            "OVERDUE_TASK:task-1",

                        type:
                            "OVERDUE_TASK",

                        status: "ACTIVE",

                        currentSeverity:
                            "HIGH",

                        previousSeverity:
                            "MEDIUM",

                        snapshotKey: "project-1:2026-09-19",

                        firstDetectedAt:
                            new Date(
                                "2026-09-15T00:00:00.000Z"
                            ),

                        lastDetectedAt:
                            new Date(
                                "2026-09-19T00:00:00.000Z"
                            ),

                        detectionCount: 5,

                        lastLifecycle:
                            "ESCALATED",

                        evidence: {
                            previous: 2,
                            current: 5,
                            change: 3
                        }
                    });

                expect(
                    document.validateSync()
                ).toBeUndefined();
            }
        );

        test(
            "requires project, identity, type and severity",
            () => {
                const document =
                    new ProjectRiskHistory({});

                const error =
                    document.validateSync();

                expect(error).toBeDefined();

                expect(
                    error.errors.project
                ).toBeDefined();

                expect(
                    error.errors.identity
                ).toBeDefined();

                expect(
                    error.errors.type
                ).toBeDefined();

                expect(
                    error.errors.currentSeverity
                ).toBeDefined();
            }
        );

        test(
            "allows a resolved risk",
            () => {
                const document =
                    new ProjectRiskHistory({
                        project:
                            "507f1f77bcf86cd799439011",

                        identity:
                            "BLOCKED_TASK:task-2",

                        type:
                            "BLOCKED_TASK",

                        status: "RESOLVED",

                        currentSeverity:
                            "MEDIUM",

                        snapshotKey: "project-1:2026-09-19",

                        firstDetectedAt:
                            new Date(
                                "2026-09-15T00:00:00.000Z"
                            ),

                        lastDetectedAt:
                            new Date(
                                "2026-09-18T00:00:00.000Z"
                            ),

                        resolvedAt:
                            new Date(
                                "2026-09-19T00:00:00.000Z"
                            ),

                        detectionCount: 4,

                        lastLifecycle:
                            "RESOLVED"
                    });

                expect(
                    document.validateSync()
                ).toBeUndefined();
            }
        );

        test(
            "rejects invalid status",
            () => {
                const document =
                    new ProjectRiskHistory({
                        project:
                            "507f1f77bcf86cd799439011",

                        identity:
                            "RISK:1",

                        type: "RISK",

                        status:
                            "UNKNOWN",

                        currentSeverity:
                            "HIGH",

                        firstDetectedAt:
                            new Date(),

                        lastDetectedAt:
                            new Date(),

                        lastLifecycle:
                            "NEW"
                    });

                const error =
                    document.validateSync();

                expect(error).toBeDefined();

                expect(
                    error.errors.status
                ).toBeDefined();
            }
        );

        test(
            "rejects invalid severity",
            () => {
                const document =
                    new ProjectRiskHistory({
                        project:
                            "507f1f77bcf86cd799439011",

                        identity:
                            "RISK:1",

                        type: "RISK",

                        status: "ACTIVE",

                        currentSeverity:
                            "LOW",

                        firstDetectedAt:
                            new Date(),

                        lastDetectedAt:
                            new Date(),

                        lastLifecycle:
                            "NEW"
                    });

                const error =
                    document.validateSync();

                expect(error).toBeDefined();

                expect(
                    error.errors.currentSeverity
                ).toBeDefined();
            }
        );

        test(
            "rejects detection count below one",
            () => {
                const document =
                    new ProjectRiskHistory({
                        project:
                            "507f1f77bcf86cd799439011",

                        identity:
                            "RISK:1",

                        type: "RISK",

                        status: "ACTIVE",

                        currentSeverity:
                            "HIGH",

                        firstDetectedAt:
                            new Date(),

                        lastDetectedAt:
                            new Date(),

                        detectionCount: 0,

                        lastLifecycle:
                            "NEW"
                    });

                const error =
                    document.validateSync();

                expect(error).toBeDefined();

                expect(
                    error.errors.detectionCount
                ).toBeDefined();
            }
        );
    }
);