const {
    buildSnapshotKey,
    createHistoryDocument,
    updateProjectRiskHistory
} =
    require(
        "../../src/modules/risks/risk.history.service"
    );

const ProjectRiskHistory =
    require(
        "../../src/modules/risks/project.risk.history.model"
    );

const {
    RISK_LIFECYCLE
} = require("../../src/modules/risks/risk.lifecycle.engine");

describe(
    "risk.history.service",
    () => {
        beforeEach(async () => {
            await ProjectRiskHistory.deleteMany({});
        });
        const projectId =
            "507f1f77bcf86cd799439011";

        const capturedAt =
            new Date(
                "2026-09-19T00:00:00.000Z"
            );

        test(
            "builds a deterministic snapshot key",
            () => {
                expect(
                    buildSnapshotKey({
                        projectId,
                        snapshotDate:
                            "2026-09-19"
                    })
                ).toBe(
                    "507f1f77bcf86cd799439011:2026-09-19"
                );
            }
        );

        test(
            "requires project id",
            () => {
                expect(() =>
                    buildSnapshotKey({
                        snapshotDate:
                            "2026-09-19"
                    })
                ).toThrow(
                    "Project id is required"
                );
            }
        );

        test(
            "creates a new history document",
            () => {
                const document =
                    createHistoryDocument({
                        projectId,
                        risk: {
                            identity:
                                "OVERDUE_TASK:task-1",
                            type:
                                "OVERDUE_TASK",
                            severity:
                                "HIGH",
                            evidence: {
                                change: 3
                            }
                        },
                        lifecycle: "NEW",
                        capturedAt,
                        snapshotKey:
                            "project:2026-09-19"
                    });

                expect(document).toEqual(
                    expect.objectContaining({
                        project:
                            projectId,
                        identity:
                            "OVERDUE_TASK:task-1",
                        status: "ACTIVE",
                        currentSeverity:
                            "HIGH",
                        detectionCount: 1,
                        lastLifecycle: "NEW",
                        snapshotKey:
                            "project:2026-09-19"
                    })
                );
            }
        );

        test(
            "increments an existing active risk",
            async () => {
                const history =
                    await ProjectRiskHistory.create(
                        {
                            project:
                                projectId,
                            identity:
                                "BLOCKED_TASK:task-1",
                            type:
                                "BLOCKED_TASK",
                            status: "ACTIVE",
                            currentSeverity:
                                "MEDIUM",
                            firstDetectedAt:
                                new Date(
                                    "2026-09-18T00:00:00.000Z"
                                ),
                            lastDetectedAt:
                                new Date(
                                    "2026-09-18T00:00:00.000Z"
                                ),
                            detectionCount: 1,
                            lastLifecycle:
                                "NEW",
                            snapshotKey:
                                "project:2026-09-18"
                        }
                    );

                await updateProjectRiskHistory({
                    projectId,
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
                    ],
                    capturedAt,
                    snapshotDate:
                        "2026-09-19"
                });

                const updated =
                    await ProjectRiskHistory.findById(
                        history._id
                    );

                expect(
                    updated.detectionCount
                ).toBe(2);

                expect(
                    updated.lastLifecycle
                ).toBe("PERSISTENT");
            }
        );

        test(
            "does not double count the same snapshot",
            async () => {
                await ProjectRiskHistory.create(
                    {
                        project:
                            projectId,
                        identity:
                            "OVERDUE_TASK:task-2",
                        type:
                            "OVERDUE_TASK",
                        status: "ACTIVE",
                        currentSeverity:
                            "HIGH",
                        firstDetectedAt:
                            capturedAt,
                        lastDetectedAt:
                            capturedAt,
                        detectionCount: 1,
                        lastLifecycle:
                            "NEW",
                        snapshotKey:
                            `${projectId}:2026-09-19`
                    }
                );

                await updateProjectRiskHistory({
                    projectId,
                    previousRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-2",
                            type:
                                "OVERDUE_TASK",
                            severity:
                                "HIGH"
                        }
                    ],
                    currentRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-2",
                            type:
                                "OVERDUE_TASK",
                            severity:
                                "HIGH"
                        }
                    ],
                    capturedAt,
                    snapshotDate:
                        "2026-09-19"
                });

                const records =
                    await ProjectRiskHistory.find(
                        {
                            project:
                                projectId,
                            identity:
                                "OVERDUE_TASK:task-2"
                        }
                    );

                expect(
                    records
                ).toHaveLength(1);

                expect(
                    records[0]
                        .detectionCount
                ).toBe(1);
            }
        );

        test(
            "does not allow an older snapshot to overwrite newer risk history",
            async () => {
                await ProjectRiskHistory.create({
                    project: projectId,
                    identity:
                        "OVERDUE_TASK:task-6",
                    type: "OVERDUE_TASK",
                    status: "ACTIVE",
                    currentSeverity: "HIGH",
                    firstDetectedAt:
                        new Date(
                            "2026-09-17T00:00:00.000Z"
                        ),
                    lastDetectedAt:
                        new Date(
                            "2026-09-19T00:00:00.000Z"
                        ),
                    detectionCount: 3,
                    lastLifecycle:
                        "PERSISTENT",
                    snapshotKey:
                        `${projectId}:2026-09-19`
                });

                await updateProjectRiskHistory({
                    projectId,
                    previousRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-6",
                            type:
                                "OVERDUE_TASK",
                            severity: "HIGH"
                        }
                    ],
                    currentRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-6",
                            type:
                                "OVERDUE_TASK",
                            severity: "MEDIUM"
                        }
                    ],
                    capturedAt:
                        new Date(
                            "2026-09-18T00:00:00.000Z"
                        ),
                    snapshotDate:
                        "2026-09-18"
                });

                const history =
                    await ProjectRiskHistory.findOne({
                        project: projectId,
                        identity:
                            "OVERDUE_TASK:task-6"
                    });

                expect(
                    history.snapshotKey
                ).toBe(
                    `${projectId}:2026-09-19`
                );

                expect(
                    history.currentSeverity
                ).toBe("HIGH");

                expect(
                    history.detectionCount
                ).toBe(3);

                expect(
                    history.lastDetectedAt
                ).toEqual(
                    new Date(
                        "2026-09-19T00:00:00.000Z"
                    )
                );
            }
        );

        test(
            "allows a newer snapshot to update existing risk history",
            async () => {
                await ProjectRiskHistory.create({
                    project: projectId,
                    identity:
                        "OVERDUE_TASK:task-7",
                    type: "OVERDUE_TASK",
                    status: "ACTIVE",
                    currentSeverity: "MEDIUM",
                    firstDetectedAt:
                        new Date(
                            "2026-09-18T00:00:00.000Z"
                        ),
                    lastDetectedAt:
                        new Date(
                            "2026-09-18T00:00:00.000Z"
                        ),
                    detectionCount: 1,
                    lastLifecycle: "NEW",
                    snapshotKey:
                        `${projectId}:2026-09-18`
                });

                await updateProjectRiskHistory({
                    projectId,
                    previousRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-7",
                            type:
                                "OVERDUE_TASK",
                            severity: "MEDIUM"
                        }
                    ],
                    currentRisks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-7",
                            type:
                                "OVERDUE_TASK",
                            severity: "HIGH"
                        }
                    ],
                    capturedAt:
                        new Date(
                            "2026-09-19T00:00:00.000Z"
                        ),
                    snapshotDate:
                        "2026-09-19"
                });

                const history =
                    await ProjectRiskHistory.findOne({
                        project: projectId,
                        identity:
                            "OVERDUE_TASK:task-7"
                    });

                expect(
                    history.snapshotKey
                ).toBe(
                    `${projectId}:2026-09-19`
                );

                expect(
                    history.currentSeverity
                ).toBe("HIGH");

                expect(
                    history.detectionCount
                ).toBe(2);

                expect(
                    history.lastLifecycle
                ).toBe("ESCALATED");

                expect(
                    history.lastDetectedAt
                ).toEqual(
                    new Date(
                        "2026-09-19T00:00:00.000Z"
                    )
                );
            }
        );

        test(
            "marks a risk as resolved",
            async () => {
                await ProjectRiskHistory.create(
                    {
                        project:
                            projectId,
                        identity:
                            "DEPENDENCY_BOTTLENECK:task-3",
                        type:
                            "DEPENDENCY_BOTTLENECK",
                        status: "ACTIVE",
                        currentSeverity:
                            "HIGH",
                        firstDetectedAt:
                            new Date(
                                "2026-09-17T00:00:00.000Z"
                            ),
                        lastDetectedAt:
                            new Date(
                                "2026-09-18T00:00:00.000Z"
                            ),
                        detectionCount: 2,
                        lastLifecycle:
                            "PERSISTENT",
                        snapshotKey:
                            "project:2026-09-18"
                    }
                );

                await updateProjectRiskHistory({
                    projectId,
                    previousRisks: [
                        {
                            identity:
                                "DEPENDENCY_BOTTLENECK:task-3",
                            type:
                                "DEPENDENCY_BOTTLENECK",
                            severity:
                                "HIGH"
                        }
                    ],
                    currentRisks: [],
                    capturedAt,
                    snapshotDate:
                        "2026-09-19"
                });

                const updated =
                    await ProjectRiskHistory.findOne(
                        {
                            project:
                                projectId,
                            identity:
                                "DEPENDENCY_BOTTLENECK:task-3"
                        }
                    );

                expect(
                    updated.status
                ).toBe("RESOLVED");

                expect(
                    updated.lastLifecycle
                ).toBe("RESOLVED");

                expect(
                    updated.resolvedAt
                ).toEqual(capturedAt);

                expect(
                    updated.detectionCount
                ).toBe(2);
            }
        );

        test(
            "handles a new risk and resolved risk together",
            async () => {
                await ProjectRiskHistory.create(
                    {
                        project:
                            projectId,
                        identity:
                            "OLD_RISK:task-4",
                        type: "OLD_RISK",
                        status: "ACTIVE",
                        currentSeverity:
                            "MEDIUM",
                        firstDetectedAt:
                            capturedAt,
                        lastDetectedAt:
                            capturedAt,
                        detectionCount: 1,
                        lastLifecycle:
                            "NEW",
                        snapshotKey:
                            "project:2026-09-18"
                    }
                );

                const results =
                    await updateProjectRiskHistory({
                        projectId,
                        previousRisks: [
                            {
                                identity:
                                    "OLD_RISK:task-4",
                                type:
                                    "OLD_RISK",
                                severity:
                                    "MEDIUM"
                            }
                        ],
                        currentRisks: [
                            {
                                identity:
                                    "NEW_RISK:task-5",
                                type:
                                    "NEW_RISK",
                                severity:
                                    "HIGH"
                            }
                        ],
                        capturedAt,
                        snapshotDate:
                            "2026-09-19"
                    });

                expect(
                    results
                ).toHaveLength(2);

                const oldRisk =
                    await ProjectRiskHistory.findOne(
                        {
                            project:
                                projectId,
                            identity:
                                "OLD_RISK:task-4"
                        }
                    );

                const newRisk =
                    await ProjectRiskHistory.findOne(
                        {
                            project:
                                projectId,
                            identity:
                                "NEW_RISK:task-5"
                        }
                    );

                expect(
                    oldRisk.status
                ).toBe("RESOLVED");

                expect(
                    newRisk.status
                ).toBe("ACTIVE");

                expect(
                    newRisk.detectionCount
                ).toBe(1);
            }
        );

        it("does not create a new history document for a resolved risk", () => {
            expect(() =>
                createHistoryDocument({
                    projectId,
                    risk: {
                        identity: "OVERDUE_TASK:task-1",
                        type: "OVERDUE_TASK",
                        severity: "HIGH",
                        evidence: {
                            taskId: "task-1"
                        }
                    },
                    lifecycle: RISK_LIFECYCLE.RESOLVED,
                    capturedAt,
                    snapshotKey: "project-1:2026-09-19"
                })
            ).toThrow(
                "A resolved risk cannot create a new history document"
            );
        });
    }
);