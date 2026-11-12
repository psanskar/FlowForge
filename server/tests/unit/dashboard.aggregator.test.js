const {
    getTopRisks,
    getMilestoneProgress,
    getWorkload,
    buildDashboardData
} = require(
    "../../src/modules/projects/dashboard.aggregator"
);

describe("Dashboard Aggregator", () => {
    test("returns top risks ordered by severity", () => {
        const risks = [
            {
                type: "TASK_STAGNANT",
                severity: "MEDIUM",
                inactiveDays: 6
            },
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                daysOverdue: 2
            },
            {
                type: "TASK_BLOCKED",
                severity: "HIGH"
            }
        ];

        const result = getTopRisks(risks);

        expect(result).toHaveLength(3);
        expect(result[0].severity).toBe("HIGH");
        expect(result[1].severity).toBe("HIGH");
        expect(result[2].severity).toBe("MEDIUM");
    });

    test("prioritizes higher impact risk within the same severity", () => {
        const risks = [
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                daysOverdue: 2
            },
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                daysOverdue: 10
            },
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                daysOverdue: 5
            }
        ];

        const result = getTopRisks(risks);

        expect(result.map((risk) => risk.daysOverdue))
            .toEqual([10, 5, 2]);
    });

    test("prioritizes overdue milestone risk above upcoming milestone risk", () => {
        const risks = [
            {
                type: "MILESTONE_RISK",
                severity: "HIGH",
                daysUntilDue: 3,
                unfinishedTaskCount: 4
            },
            {
                type: "MILESTONE_RISK",
                severity: "HIGH",
                daysUntilDue: -2,
                unfinishedTaskCount: 2
            }
        ];

        const result = getTopRisks(risks);

        expect(result[0].daysUntilDue).toBe(-2);
        expect(result[1].daysUntilDue).toBe(3);
    });

    test("prioritizes higher pull request cycle time within the same severity", () => {
        const risks = [
            {
                type: "GITHUB_HIGH_PR_CYCLE_TIME",
                severity: "MEDIUM",
                medianCycleTimeHours: 80
            },
            {
                type: "GITHUB_HIGH_PR_CYCLE_TIME",
                severity: "MEDIUM",
                medianCycleTimeHours: 170
            },
            {
                type: "GITHUB_HIGH_PR_CYCLE_TIME",
                severity: "MEDIUM",
                medianCycleTimeHours: 120
            }
        ];

        const result = getTopRisks(risks);

        expect(result.map((risk) => risk.medianCycleTimeHours))
            .toEqual([170, 120, 80]);
    });

    test("uses deterministic type ordering when severity and impact are equal", () => {
        const risks = [
            {
                type: "TASK_STAGNANT",
                severity: "MEDIUM",
                inactiveDays: 5
            },
            {
                type: "TASK_OVERDUE",
                severity: "MEDIUM",
                daysOverdue: 5
            },
            {
                type: "WORKLOAD_IMBALANCE",
                severity: "MEDIUM",
                activeTasks: 5
            }
        ];

        const result = getTopRisks(risks);

        expect(result.map((risk) => risk.type))
            .toEqual([
                "TASK_OVERDUE",
                "TASK_STAGNANT",
                "WORKLOAD_IMBALANCE"
            ]);
    });

    test("limits top risks to five", () => {
        const risks = Array.from(
            { length: 8 },
            (_, index) => ({
                type: `RISK_${index}`,
                severity: "MEDIUM",
                activeTasks: index
            })
        );

        const result = getTopRisks(risks);

        expect(result).toHaveLength(5);
    });

    test("calculates milestone task progress", () => {
        const milestones = [
            {
                _id: "milestone1",
                name: "MVP",
                description: "Initial release",
                dueDate: new Date("2026-10-01"),
                status: "planned"
            }
        ];

        const tasks = [
            {
                _id: "task1",
                milestone: "milestone1",
                status: "completed"
            },
            {
                _id: "task2",
                milestone: "milestone1",
                status: "in_progress"
            },
            {
                _id: "task3",
                milestone: "milestone1",
                status: "todo"
            }
        ];

        const result = getMilestoneProgress(
            milestones,
            tasks
        );

        expect(result[0]).toMatchObject({
            id: "milestone1",
            name: "MVP",
            totalTasks: 3,
            completedTasks: 1,
            unfinishedTasks: 2
        });
    });

    test("calculates contributor workload", () => {
        const tasks = [
            {
                assignee: "user1",
                status: "todo"
            },
            {
                assignee: "user1",
                status: "in_progress"
            },
            {
                assignee: "user2",
                status: "blocked"
            },
            {
                assignee: "user2",
                status: "completed"
            },
            {
                assignee: null,
                status: "todo"
            }
        ];

        const users = [
            {
                _id: "user1",
                name: "Rahul"
            },
            {
                _id: "user2",
                name: "Priya"
            }
        ];

        const result = getWorkload(tasks, users);

        expect(result).toEqual([
            {
                userId: "user1",
                name: "Rahul",
                activeTasks: 2
            },
            {
                userId: "user2",
                name: "Priya",
                activeTasks: 1
            }
        ]);
    });

    test("builds complete dashboard data", () => {
        const project = {
            _id: "project1",
            name: "FlowForge",
            description: "Project monitoring platform",
            status: "active",
            startDate: new Date("2026-09-01"),
            targetDate: new Date("2026-12-01")
        };

        const health = {
            score: 85,
            health: "ON_TRACK",
            summary: {
                totalTasks: 10,
                completedTasks: 6,
                overdueTasks: 1,
                blockedTasks: 1,
                stagnantTasks: 1,
                workloadRisks: 0
            }
        };

        const tasks = [];
        const milestones = [];
        const risks = [];

        const result = buildDashboardData({
            project,
            health,
            tasks,
            milestones,
            risks
        });

        expect(result.project.name)
            .toBe("FlowForge");

        expect(result.health)
            .toEqual({
                score: 85,
                health: "ON_TRACK"
            });

        expect(result.taskSummary.totalTasks)
            .toBe(10);

        expect(result.milestones)
            .toEqual([]);

        expect(result.topRisks)
            .toEqual([]);

        expect(result.workload)
            .toEqual([]);
    });

    test("provides task, milestone, workload, and GitHub next actions", () => {
        const risks = [
            {
                type: "TASK_OVERDUE",
                severity: "HIGH",
                taskId: "task-1",
                daysOverdue: 4
            },
            {
                type: "MILESTONE_RISK",
                severity: "HIGH",
                milestoneId: "milestone-1",
                daysUntilDue: 2,
                unfinishedTaskCount: 2
            },
            {
                type: "WORKLOAD_IMBALANCE",
                severity: "MEDIUM",
                userId: "user-1",
                activeTasks: 6,
                medianWorkload: 2
            },
            {
                type: "GITHUB_AGING_PR",
                severity: "HIGH",
                githubPrId: "pr-1",
                prNumber: 42,
                ageDays: 15
            }
        ];

        const dashboard = buildDashboardData({
            project: { _id: "project-1" },
            health: {
                score: 45,
                health: "CRITICAL",
                summary: {}
            },
            tasks: [
                {
                    _id: "task-1",
                    title: "Recover delayed API",
                    assignee: "user-1"
                }
            ],
            milestones: [
                {
                    _id: "milestone-1",
                    name: "Beta release"
                }
            ],
            users: [
                {
                    _id: "user-1",
                    name: "Asha"
                }
            ],
            risks,
            githubRepository: {
                fullName: "flowforge/demo"
            }
        });

        const actionsByType = Object.fromEntries(
            dashboard.topRisks.map((risk) => [
                risk.type,
                risk.nextAction
            ])
        );

        expect(actionsByType.TASK_OVERDUE).toMatchObject({
            label: "Open task",
            href: "/app/tasks/task-1",
            external: false
        });
        expect(
            dashboard.topRisks.find(
                (risk) => risk.type === "TASK_OVERDUE"
            ).context
        ).toEqual({
            label: "Task",
            title: "Recover delayed API",
            owner: "Asha"
        });
        expect(
            dashboard.topRisks.find(
                (risk) => risk.type === "MILESTONE_RISK"
            ).context
        ).toEqual({
            label: "Milestone",
            title: "Beta release",
            owner: null
        });
        expect(actionsByType.MILESTONE_RISK.href)
            .toBe("/app/projects/project-1#milestones");
        expect(actionsByType.WORKLOAD_IMBALANCE.href)
            .toBe("/app/projects/project-1/tasks?assignee=user-1");
        expect(actionsByType.GITHUB_AGING_PR).toMatchObject({
            label: "Open pull request",
            href: "https://github.com/flowforge/demo/pull/42",
            external: true
        });
        expect(
            dashboard.topRisks.find(
                (risk) => risk.type === "GITHUB_AGING_PR"
            ).context
        ).toEqual({
            label: "Pull request #42",
            title: null,
            owner: null
        });
    });
});
