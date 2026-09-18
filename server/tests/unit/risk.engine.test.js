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

        test("adds a stable ID to task risks", () => {
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
        expect(risk.id).toBe(
            "TASK_OVERDUE:task-1"
        );
    });

    test("adds a stable ID to milestone risks", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    milestone: "milestone-1"
                })
            ],
            milestones: [
                createMilestone()
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) => item.type === "MILESTONE_RISK"
        );

        expect(risk).toBeDefined();
        expect(risk.id).toBe(
            "MILESTONE_RISK:milestone-1"
        );
    });

    test("adds a stable ID to workload risks", () => {
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
        expect(risk.id).toBe(
            "WORKLOAD_IMBALANCE:john"
        );
    });

    test("adds evidence to task risks", () => {
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
        expect(Array.isArray(risk.evidence))
            .toBe(true);

        expect(risk.evidence).toContain(
            "Task is 7 days overdue"
        );
    });

    test("adds evidence explaining a milestone risk", () => {
        const risks = analyzeProject({
            project,
            tasks: [
                createTask({
                    milestone: "milestone-1"
                })
            ],
            milestones: [
                createMilestone()
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) =>
                item.type === "MILESTONE_RISK"
        );

        expect(risk).toBeDefined();
        expect(risk.evidence).toEqual(
            expect.arrayContaining([
                "1 unfinished task remains before the milestone deadline",
                "Milestone deadline is within 3 days"
            ])
        );
    });

    test("adds evidence explaining workload imbalance", () => {
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
                item.type ===
                "WORKLOAD_IMBALANCE"
        );

        expect(risk).toBeDefined();

        expect(risk.evidence).toEqual(
            expect.arrayContaining([
                "Contributor has 6 active tasks",
                "Median contributor workload is 2"
            ])
        );
    });

    test("adds stable IDs and evidence to GitHub risks", () => {
        const risks = analyzeProject({
            project,
            githubSignals: [
                {
                    type: "PULL_REQUEST_OPENED",
                    externalId: "pr:501:opened",
                    occurredAt:
                        "2026-09-08T12:00:00.000Z",
                    metadata: {
                        githubId: 501,
                        number: 501,
                        title: "Long running feature"
                    }
                }
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) =>
                item.type ===
                "GITHUB_AGING_PR"
        );

        expect(risk).toBeDefined();

        expect(risk.id).toBe(
            "GITHUB_AGING_PR:501"
        );

        expect(risk.evidence).toEqual(
            expect.arrayContaining([
                "Pull request has been open for 9 days",
                "Open pull request exceeded the configured aging threshold"
            ])
        );
    });

    test("uses risk type as ID for project-level GitHub risks", () => {
        const risks = analyzeProject({
            project,
            githubSignals: [
                {
                    type: "ISSUE_OPENED",
                    externalId: "issue:1:opened",
                    occurredAt:
                        "2026-09-10T12:00:00.000Z"
                },
                {
                    type: "ISSUE_OPENED",
                    externalId: "issue:2:opened",
                    occurredAt:
                        "2026-09-11T12:00:00.000Z"
                },
                {
                    type: "ISSUE_OPENED",
                    externalId: "issue:3:opened",
                    occurredAt:
                        "2026-09-12T12:00:00.000Z"
                }
            ],
            now: NOW
        });

        const risk = risks.find(
            (item) =>
                item.type ===
                "GITHUB_ISSUE_BACKLOG"
        );

        expect(risk).toBeDefined();
        expect(risk.id).toBe(
            "GITHUB_ISSUE_BACKLOG"
        );

        expect(risk.evidence).toEqual(
            expect.arrayContaining([
                "3 issues were opened in the analysis window",
                "0 issues were closed in the analysis window",
                "Net issue backlog growth is 3"
            ])
        );
    });

    test("requires project data", () => {
        expect(() =>
            analyzeProject({
                project: null
            })
        ).toThrow("Project data is required");
    });
});