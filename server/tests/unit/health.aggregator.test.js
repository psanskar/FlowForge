const {
    aggregateProjectHealth
} = require("../../src/modules/risks/health.aggregator");

const NOW = new Date("2026-09-17T12:00:00.000Z");

const createTask = (overrides = {}) => ({
    _id: "task-1",
    status: "in_progress",
    dueDate: null,
    ...overrides
});

describe("Health Aggregator", () => {
    test("returns healthy for a project with no risks", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask(),
                createTask({
                    _id: "task-2",
                    status: "completed"
                })
            ],
            risks: [],
            now: NOW
        });

        expect(result.score).toBe(100);
        expect(result.health).toBe("HEALTHY");

        expect(result.summary).toEqual({
            totalTasks: 2,
            completedTasks: 1,
            overdueTasks: 0,
            blockedTasks: 0,
            stagnantTasks: 0,
            workloadRisks: 0
        });

        expect(result.risks).toEqual([]);
    });

    test("deducts 15 points for a high severity risk", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                })
            ],
            risks: [
                {
                    type: "TASK_OVERDUE",
                    severity: "HIGH",
                    taskId: "task-1"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(85);
        expect(result.health).toBe("ON_TRACK");
    });

    test("deducts 7 points for a medium severity risk", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                })
            ],
            risks: [
                {
                    type: "TASK_STAGNANT",
                    severity: "MEDIUM",
                    taskId: "task-1"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(93);
        expect(result.health).toBe("HEALTHY");
    });

    test("caps deductions from risks on the same task at 25 points", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                })
            ],
            risks: [
                {
                    type: "TASK_OVERDUE",
                    severity: "HIGH",
                    taskId: "task-1"
                },
                {
                    type: "TASK_STAGNANT",
                    severity: "MEDIUM",
                    taskId: "task-1"
                },
                {
                    type: "TASK_BLOCKED",
                    severity: "MEDIUM",
                    taskId: "task-1"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(75);
        expect(result.health).toBe("ON_TRACK");
    });

    test("applies deductions from different tasks independently", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                }),
                createTask({
                    _id: "task-2"
                })
            ],
            risks: [
                {
                    type: "TASK_OVERDUE",
                    severity: "HIGH",
                    taskId: "task-1"
                },
                {
                    type: "TASK_OVERDUE",
                    severity: "HIGH",
                    taskId: "task-2"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(70);
        expect(result.health).toBe("ON_TRACK");
    });

    test("applies non-task risks directly", () => {
        const result = aggregateProjectHealth({
            tasks: [],
            risks: [
                {
                    type: "WORKLOAD_IMBALANCE",
                    severity: "MEDIUM",
                    userId: "user-1"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "milestone-1"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(78);
        expect(result.health).toBe("ON_TRACK");
    });

    test("does not allow the score to fall below zero", () => {
        const result = aggregateProjectHealth({
            tasks: [],
            risks: [
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m1"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m2"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m3"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m4"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m5"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m6"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m7"
                }
            ],
            now: NOW
        });

        expect(result.score).toBe(0);
        expect(result.health).toBe("CRITICAL");
    });

    test("counts completed tasks correctly", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    status: "completed"
                }),
                createTask({
                    _id: "task-2",
                    status: "completed"
                }),
                createTask({
                    _id: "task-3",
                    status: "in_progress"
                })
            ],
            risks: [],
            now: NOW
        });

        expect(result.summary.totalTasks).toBe(3);
        expect(result.summary.completedTasks).toBe(2);
    });

    test("counts overdue unfinished tasks", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    dueDate: "2026-09-10T12:00:00.000Z"
                }),
                createTask({
                    _id: "task-2",
                    status: "completed",
                    dueDate: "2026-09-10T12:00:00.000Z"
                }),
                createTask({
                    _id: "task-3",
                    dueDate: "2026-09-20T12:00:00.000Z"
                })
            ],
            risks: [],
            now: NOW
        });

        expect(result.summary.overdueTasks).toBe(1);
    });

    test("counts blocked tasks", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    status: "blocked"
                }),
                createTask({
                    _id: "task-2",
                    status: "in_progress"
                }),
                createTask({
                    _id: "task-3",
                    status: "blocked"
                })
            ],
            risks: [],
            now: NOW
        });

        expect(result.summary.blockedTasks).toBe(2);
    });

    test("counts stagnant and workload risks", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                })
            ],
            risks: [
                {
                    type: "TASK_STAGNANT",
                    severity: "MEDIUM",
                    taskId: "task-1"
                },
                {
                    type: "WORKLOAD_IMBALANCE",
                    severity: "MEDIUM",
                    userId: "user-1"
                },
                {
                    type: "WORKLOAD_IMBALANCE",
                    severity: "MEDIUM",
                    userId: "user-2"
                }
            ],
            now: NOW
        });

        expect(result.summary.stagnantTasks).toBe(1);
        expect(result.summary.workloadRisks).toBe(2);
    });

    test("returns all original risk signals", () => {
        const risks = [
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                taskId: "task-1",
                message: "Task is overdue"
            },
            {
                type: "TASK_BLOCKED",
                severity: "MEDIUM",
                taskId: "task-2",
                message: "Task is blocked"
            }
        ];

        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    _id: "task-1"
                }),
                createTask({
                    _id: "task-2"
                })
            ],
            risks,
            now: NOW
        });

        expect(result.risks).toEqual(risks);
    });

    test("uses fixed now when calculating overdue tasks", () => {
        const result = aggregateProjectHealth({
            tasks: [
                createTask({
                    dueDate: "2026-09-18T12:00:00.000Z"
                })
            ],
            risks: [],
            now: NOW
        });

        expect(result.summary.overdueTasks).toBe(0);
    });

    test("maps score boundaries to the correct health status", () => {
        const healthy = aggregateProjectHealth({
            tasks: [],
            risks: [
                {
                    type: "MILESTONE_RISK",
                    severity: "MEDIUM",
                    milestoneId: "m1"
                }
            ],
            now: NOW
        });

        expect(healthy.score).toBe(93);
        expect(healthy.health).toBe("HEALTHY");

        const onTrack = aggregateProjectHealth({
            tasks: [],
            risks: [
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m1"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m2"
                }
            ],
            now: NOW
        });

        expect(onTrack.score).toBe(70);
        expect(onTrack.health).toBe("ON_TRACK");

        const atRisk = aggregateProjectHealth({
            tasks: [],
            risks: [
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m1"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m2"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m3"
                },
                {
                    type: "MILESTONE_RISK",
                    severity: "HIGH",
                    milestoneId: "m4"
                }
            ],
            now: NOW
        });

        expect(atRisk.score).toBe(40);
        expect(atRisk.health).toBe("CRITICAL");
    });
});