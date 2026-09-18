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

const GithubSignal = require(
    "../../src/modules/github/github.signal.model"
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

    test("includes GitHub execution risks and health impact in dashboard", async () => {
        await GithubSignal.create({
            project: project._id,
            repository: "68b0a7e2c9f4a1d3e5f60718",
            type: "PULL_REQUEST_OPENED",
            externalId: "pr:501:opened",
            occurredAt: new Date(
                "2026-09-08T12:00:00.000Z"
            ),
            actor: {
                id: 456,
                login: "github-developer"
            },
            metadata: {
                githubId: 501,
                number: 501,
                title: "Long running dashboard feature"
            }
        });

        const dashboard =
            await getProjectDashboard(
                project._id.toString(),
                user._id.toString(),
                new Date("2026-09-17T12:00:00.000Z")
            );

        const githubRisk =
            dashboard.topRisks.find(
                (risk) =>
                    risk.type === "GITHUB_AGING_PR"
            );

        expect(githubRisk)
            .toBeDefined();

        expect(githubRisk)
            .toMatchObject({
                type: "GITHUB_AGING_PR",
                severity: "MEDIUM",
                githubPrId: "501",
                prNumber: 501,
                title: "Long running dashboard feature",
                ageDays: 9
            });

        expect(dashboard.health.score)
            .toBe(93);
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