const mongoose = require("mongoose");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const GithubRepository = require(
    "../../src/modules/github/github.model"
);
const GithubSignal = require(
    "../../src/modules/github/github.signal.model"
);

const {
    createSignal
} = require(
    "../../src/modules/github/github.signal.service"
);

describe("GitHub Signal Service", () => {
    let user;
    let project;
    let repository;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await GithubRepository.deleteMany({});
        await GithubSignal.deleteMany({});

        user = await User.create({
            name: "GitHub Signal Test User",
            email: "github-signal-test@flowforge.local",
            passwordHash: "test-password-hash"
        });

        project = await Project.create({
            name: "GitHub Signal Project",
            description: "GitHub signal service test project",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active"
        });

        repository = await GithubRepository.create({
            project: project._id,
            owner: "example",
            repo: "flowforge-repo",
            fullName: "example/flowforge-repo",
            githubId: 123456,
            defaultBranch: "main",
            private: false
        });
    });

    const createSignalData = (overrides = {}) => ({
        type: "COMMIT",
        externalId: "commit-abc123",
        occurredAt: new Date(
            "2026-09-17T12:00:00.000Z"
        ),
        actor: {
            id: 12345,
            login: "octocat"
        },
        metadata: {
            message: "Fix authentication bug"
        },
        ...overrides
    });

    test("creates a normalized GitHub signal for a project member", async () => {
        const signal = await createSignal(
            project._id.toString(),
            user._id.toString(),
            createSignalData()
        );

        expect(signal).not.toBeNull();

        expect(signal.project.toString()).toBe(
            project._id.toString()
        );

        expect(signal.repository.toString()).toBe(
            repository._id.toString()
        );

        expect(signal.type).toBe("COMMIT");

        expect(signal.externalId).toBe(
            "commit-abc123"
        );

        expect(signal.actor.login).toBe(
            "octocat"
        );

        const databaseSignal =
            await GithubSignal.findOne({
                externalId: "commit-abc123"
            });

        expect(databaseSignal).not.toBeNull();
    });

    test("rejects an invalid project ID", async () => {
        await expect(
            createSignal(
                "invalid-project-id",
                user._id.toString(),
                createSignalData()
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });

    test("rejects signal creation when user is not a project member", async () => {
        const otherUser = await User.create({
            name: "Other Signal User",
            email: "other-signal-test@flowforge.local",
            passwordHash: "test-password-hash"
        });

        await expect(
            createSignal(
                project._id.toString(),
                otherUser._id.toString(),
                createSignalData()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });

        expect(
            await GithubSignal.countDocuments({})
        ).toBe(0);
    });

    test("rejects signal creation when project has no GitHub repository", async () => {
        await GithubRepository.deleteMany({
            project: project._id
        });

        await expect(
            createSignal(
                project._id.toString(),
                user._id.toString(),
                createSignalData()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "GITHUB_REPOSITORY_NOT_CONNECTED"
        });

        expect(
            await GithubSignal.countDocuments({})
        ).toBe(0);
    });

    test("uses the project's connected repository", async () => {
        const signal = await createSignal(
            project._id.toString(),
            user._id.toString(),
            createSignalData()
        );

        expect(
            signal.repository.toString()
        ).toBe(repository._id.toString());
    });

    test("rejects a repository that does not belong to the project", async () => {
        const otherProject = await Project.create({
            name: "Other Project",
            description: "Another project",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active"
        });

        const otherRepository =
            await GithubRepository.create({
                project: otherProject._id,
                owner: "example",
                repo: "other-repo",
                fullName: "example/other-repo",
                githubId: 999999,
                defaultBranch: "main",
                private: false
            });

        await expect(
            createSignal(
                project._id.toString(),
                user._id.toString(),
                createSignalData({
                    repository: otherRepository._id
                })
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "GITHUB_REPOSITORY_MISMATCH"
        });

        expect(
            await GithubSignal.countDocuments({})
        ).toBe(0);
    });

    test("returns the existing signal when the same event is received again", async () => {
        const signalData = createSignalData();

        const firstSignal = await createSignal(
            project._id.toString(),
            user._id.toString(),
            signalData
        );

        const secondSignal = await createSignal(
            project._id.toString(),
            user._id.toString(),
            signalData
        );

        expect(
            secondSignal._id.toString()
        ).toBe(firstSignal._id.toString());

        expect(
            await GithubSignal.countDocuments({})
        ).toBe(1);
    });

    test("allows the same external ID in different repositories", async () => {
        const otherProject = await Project.create({
            name: "Second GitHub Project",
            description: "Second project",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active"
        });

        const otherRepository =
            await GithubRepository.create({
                project: otherProject._id,
                owner: "example",
                repo: "second-repo",
                fullName: "example/second-repo",
                githubId: 777777,
                defaultBranch: "main",
                private: false
            });

        const signalData = createSignalData();

        const firstSignal = await createSignal(
            project._id.toString(),
            user._id.toString(),
            signalData
        );

        const secondSignal = await createSignal(
            otherProject._id.toString(),
            user._id.toString(),
            {
                ...signalData,
                repository: otherRepository._id
            }
        );

        expect(
            firstSignal._id.toString()
        ).not.toBe(
            secondSignal._id.toString()
        );

        expect(
            await GithubSignal.countDocuments({})
        ).toBe(2);
    });
});