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
                severity: "MEDIUM"
            },
            {
                type: "TASK_OVERDUE",
                severity: "HIGH"
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

    test("limits top risks to five", () => {
        const risks = Array.from(
            { length: 8 },
            (_, index) => ({
                type: `RISK_${index}`,
                severity: "MEDIUM"
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
});