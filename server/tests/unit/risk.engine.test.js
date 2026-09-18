const { analyzeProject } = require("../../src/modules/risks/risk.engine");

const NOW = new Date("2026-09-17T12:00:00.000Z");

const createTask = (overrides = {}) => ({
    _id: "task-1",
    status: "in_progress",
    priority: "medium",
    dueDate: null,
    lastActivityAt: NOW,
    assignee: null,
    milestone: null,
    ...overrides
});

const createMilestone = (overrides = {}) => ({
    _id: "milestone-1",
    status: "planned",
    dueDate: "2026-09-20T12:00:00.000Z",
    ...overrides
});

const project = {
    _id: "project-1",
    name: "Risk Test Project"
};

describe("Risk Engine", () => {
    test("detects overdue unfinished task", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    dueDate: "2026-09-10T12:00:00.000Z"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "TASK_OVERDUE"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("HIGH");
        expect(risk.message).toContain("7 days overdue");
    });

    test("does not flag completed task as overdue", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    status: "completed",
                    dueDate: "2026-09-10T12:00:00.000Z"
                })
            ],
            now: NOW
        });

        expect(
            risks.some(
                (item) => item.type === "TASK_OVERDUE"
            )
        ).toBe(false);
    });

    test("detects stagnant task after five days", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    lastActivityAt:
                        "2026-09-12T12:00:00.000Z"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "TASK_STAGNANT"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("MEDIUM");
        expect(risk.message).toContain(
            "no activity for 5 days"
        );
    });

    test("detects critical stagnant task as high severity", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    priority: "critical",
                    lastActivityAt:
                        "2026-09-10T12:00:00.000Z"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "TASK_STAGNANT"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("HIGH");
    });

    test("detects blocked task", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    status: "blocked"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "TASK_BLOCKED"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("MEDIUM");
    });

    test("detects high-priority blocked task as high severity", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    status: "blocked",
                    priority: "high"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "TASK_BLOCKED"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("HIGH");
    });

    test("detects dependency bottleneck", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    _id: "task-a"
                }),
                createTask({
                    _id: "task-b"
                }),
                createTask({
                    _id: "task-c"
                }),
                createTask({
                    _id: "task-d"
                })
            ],
            dependencies: [
                {
                    fromTask: "task-a",
                    toTask: "task-b"
                },
                {
                    fromTask: "task-a",
                    toTask: "task-c"
                },
                {
                    fromTask: "task-a",
                    toTask: "task-d"
                }
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) =>
                item.type === "DEPENDENCY_BOTTLENECK"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("HIGH");
        expect(risk.taskId).toBe("task-a");
        expect(risk.message).toContain(
            "3 unfinished tasks"
        );
    });

    test("ignores completed downstream tasks for bottleneck detection", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    _id: "task-a"
                }),
                createTask({
                    _id: "task-b"
                }),
                createTask({
                    _id: "task-c",
                    status: "completed"
                }),
                createTask({
                    _id: "task-d"
                })
            ],
            dependencies: [
                {
                    fromTask: "task-a",
                    toTask: "task-b"
                },
                {
                    fromTask: "task-a",
                    toTask: "task-c"
                },
                {
                    fromTask: "task-a",
                    toTask: "task-d"
                }
            ],
            now: NOW
        });

        expect(
            risks.some(
                (item) =>
                    item.type ===
                    "DEPENDENCY_BOTTLENECK"
            )
        ).toBe(false);
    });

    test("detects exactly one milestone risk with unfinished tasks", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    _id: "task-1",
                    milestone: "milestone-1"
                }),
                createTask({
                    _id: "task-2",
                    milestone: "milestone-1"
                })
            ],
            milestones: [
                createMilestone()
            ],
            now: NOW
        });

        const milestoneRisks = risks.filter(
            (item) =>
                item.type === "MILESTONE_RISK"
        );

        expect(milestoneRisks).toHaveLength(1);

        const risk = milestoneRisks[0];

        expect(risk.severity).toBe("HIGH");
        expect(risk.milestoneId).toBe(
            "milestone-1"
        );
        expect(risk.message).toContain(
            "2 unfinished tasks"
        );
    });

    test("detects overdue milestone with unfinished tasks", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    _id: "task-1",
                    milestone: "milestone-1"
                })
            ],
            milestones: [
                createMilestone({
                    dueDate: "2026-09-10T12:00:00.000Z"
                })
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "MILESTONE_RISK"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("HIGH");
        expect(risk.milestoneId).toBe(
            "milestone-1"
        );
        expect(risk.daysUntilDue).toBe(-7);
        expect(risk.unfinishedTaskCount).toBe(1);
    });

    test("does not flag completed milestone", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    milestone: "milestone-1"
                })
            ],
            milestones: [
                createMilestone({
                    status: "completed"
                })
            ],
            now: NOW
        });

        expect(
            risks.some(
                (item) => item.type === "MILESTONE_RISK"
            )
        ).toBe(false);
    });

    test("detects workload imbalance", () => {
        const tasks = [
            ...Array.from(
                { length: 2 },
                (_, index) =>
                    createTask({
                        _id: `alice-${index}`,
                        assignee: "alice"
                    })
            ),
            ...Array.from(
                { length: 2 },
                (_, index) =>
                    createTask({
                        _id: `bob-${index}`,
                        assignee: "bob"
                    })
            ),
            ...Array.from(
                { length: 6 },
                (_, index) =>
                    createTask({
                        _id: `john-${index}`,
                        assignee: "john"
                    })
            )
        ];

        const risks = analyzeProject({
            project,
            tasks,
            now: NOW
        });

        const risk = risks.find(
            (item) =>
                item.type === "WORKLOAD_IMBALANCE"
        );

        expect(risk).toBeDefined();
        expect(risk.severity).toBe("MEDIUM");
        expect(risk.userId).toBe("john");
    });

    test("does not flag workload when only one contributor has tasks", () => {
        const tasks = Array.from(
            { length: 10 },
            (_, index) =>
                createTask({
                    _id: `task-${index}`,
                    assignee: "john"
                })
        );

        const risks = analyzeProject({
            project,
            tasks,
            now: NOW
        });

        expect(
            risks.some(
                (item) =>
                    item.type ===
                    "WORKLOAD_IMBALANCE"
            )
        ).toBe(false);
    });

    test("requires project data", () => {
        expect(() =>
            analyzeProject({
                project: null
            })
        ).toThrow("Project data is required");
    });
});