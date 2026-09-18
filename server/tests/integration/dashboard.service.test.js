const bcrypt = require("bcryptjs");

const User = require(
    "../../src/modules/users/user.model"
);

const Project = require(
    "../../src/modules/projects/project.model"
);

const Task = require(
    "../../src/modules/tasks/task.model"
);

const {
    getProjectDashboard
} = require(
    "../../src/modules/projects/dashboard.service"
);

describe("Dashboard Service", () => {
    let user;
    let project;

    beforeEach(async () => {
        const passwordHash = await bcrypt.hash(
            "password123",
            10
        );

        user = await User.create({
            name: "Dashboard User",
            email: `dashboard-${Date.now()}-${Math.random()}@example.com`,
            passwordHash
        });

        project = await Project.create({
            name: "Dashboard Test Project",
            description: "Dashboard service test",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active",
            startDate: new Date("2026-09-01"),
            targetDate: new Date("2026-12-01")
        });
    });

    test("returns dashboard data for a project member", async () => {
        await Task.create({
            project: project._id,
            title: "Completed task",
            status: "completed",
            progress: 100,
            createdBy: user._id,
            assignee: user._id,
            completedAt: new Date(),
            lastActivityAt: new Date()
        });

        await Task.create({
            project: project._id,
            title: "Active task",
            status: "in_progress",
            progress: 50,
            createdBy: user._id,
            assignee: user._id,
            lastActivityAt: new Date()
        });

        const dashboard =
            await getProjectDashboard(
                project._id.toString(),
                user._id.toString()
            );

        expect(dashboard.project.name)
            .toBe("Dashboard Test Project");

        expect(dashboard.health)
            .toBeDefined();

        expect(dashboard.taskSummary.totalTasks)
            .toBe(2);

        expect(dashboard.taskSummary.completedTasks)
            .toBe(1);

        expect(dashboard.milestones)
            .toEqual([]);

        expect(dashboard.topRisks)
            .toBeInstanceOf(Array);

        expect(dashboard.workload)
            .toEqual([
                {
                    userId: user._id.toString(),
                    name: "Dashboard User",
                    activeTasks: 1
                }
            ]);
    });

    test("rejects a user who is not a project member", async () => {
        const otherUser =
            await User.create({
                name: "Other User",
                email: "other@example.com",
                passwordHash:
                    await bcrypt.hash(
                        "password123",
                        10
                    )
            });

        await expect(
            getProjectDashboard(
                project._id.toString(),
                otherUser._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });
    });

    test("rejects an invalid project ID", async () => {
        await expect(
            getProjectDashboard(
                "invalid-project-id",
                user._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });
});