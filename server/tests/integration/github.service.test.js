const mongoose = require("mongoose");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const GithubRepository = require("../../src/modules/github/github.model");

jest.mock("../../src/modules/github/github.client", () => ({
    getRepository: jest.fn()
}));

const {
    getRepository
} = require("../../src/modules/github/github.client");

const {
    connectRepository,
    getRepositoryConnection
} = require("../../src/modules/github/github.service");

describe("GitHub Service", () => {
    let user;
    let project;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await GithubRepository.deleteMany({});

        user = await User.create({
            name: "GitHub Test User",
            email: "github-test@flowforge.local",
            passwordHash: "test-password-hash"
        });

        project = await Project.create({
            name: "GitHub Integration Project",
            description: "GitHub service test project",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active"
        });

        getRepository.mockReset();
    });

    test("connects a valid GitHub repository for a project member", async () => {
        getRepository.mockResolvedValue({
            id: 123456,
            name: "flowforge-repo",
            full_name: "example/flowforge-repo",
            private: false,
            default_branch: "main",
            owner: {
                login: "example"
            }
        });

        const connection = await connectRepository(
            project._id.toString(),
            user._id.toString(),
            {
                owner: "example",
                repo: "flowforge-repo"
            }
        );

        expect(connection).not.toBeNull();

        expect(connection.project.toString()).toBe(
            project._id.toString()
        );

        expect(connection.owner).toBe("example");
        expect(connection.repo).toBe("flowforge-repo");
        expect(connection.fullName).toBe(
            "example/flowforge-repo"
        );
        expect(connection.githubId).toBe(123456);
        expect(connection.defaultBranch).toBe("main");
        expect(connection.private).toBe(false);

        expect(getRepository).toHaveBeenCalledWith(
            "example",
            "flowforge-repo"
        );

        const databaseConnection =
            await GithubRepository.findOne({
                project: project._id
            });

        expect(databaseConnection).not.toBeNull();
        expect(databaseConnection.fullName).toBe(
            "example/flowforge-repo"
        );
    });

    test("trims repository owner and name before calling GitHub API", async () => {
        getRepository.mockResolvedValue({
            id: 123456,
            name: "flowforge-repo",
            full_name: "example/flowforge-repo",
            private: false,
            default_branch: "main",
            owner: {
                login: "example"
            }
        });

        await connectRepository(
            project._id.toString(),
            user._id.toString(),
            {
                owner: "  example  ",
                repo: "  flowforge-repo  "
            }
        );

        expect(getRepository).toHaveBeenCalledWith(
            "example",
            "flowforge-repo"
        );
    });

    test("updates an existing repository connection instead of creating a duplicate", async () => {
        getRepository.mockResolvedValueOnce({
            id: 111111,
            name: "first-repo",
            full_name: "example/first-repo",
            private: false,
            default_branch: "main",
            owner: {
                login: "example"
            }
        });

        const firstConnection =
            await connectRepository(
                project._id.toString(),
                user._id.toString(),
                {
                    owner: "example",
                    repo: "first-repo"
                }
            );

        getRepository.mockResolvedValueOnce({
            id: 222222,
            name: "second-repo",
            full_name: "example/second-repo",
            private: true,
            default_branch: "develop",
            owner: {
                login: "example"
            }
        });

        const secondConnection =
            await connectRepository(
                project._id.toString(),
                user._id.toString(),
                {
                    owner: "example",
                    repo: "second-repo"
                }
            );

        expect(
            secondConnection._id.toString()
        ).toBe(firstConnection._id.toString());

        expect(secondConnection.fullName).toBe(
            "example/second-repo"
        );

        expect(secondConnection.githubId).toBe(222222);
        expect(secondConnection.defaultBranch).toBe(
            "develop"
        );
        expect(secondConnection.private).toBe(true);

        const connections =
            await GithubRepository.find({
                project: project._id
            });

        expect(connections).toHaveLength(1);
    });

    test("rejects repository connection when user is not a project member", async () => {
        const otherUser = await User.create({
            name: "Other User",
            email: "other-github-test@flowforge.local",
            passwordHash: "test-password-hash"
        });

        await expect(
            connectRepository(
                project._id.toString(),
                otherUser._id.toString(),
                {
                    owner: "example",
                    repo: "flowforge-repo"
                }
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });

        expect(getRepository).not.toHaveBeenCalled();
    });

    test("rejects an invalid project ID", async () => {
        await expect(
            connectRepository(
                "invalid-project-id",
                user._id.toString(),
                {
                    owner: "example",
                    repo: "flowforge-repo"
                }
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });

        expect(getRepository).not.toHaveBeenCalled();
    });

    test("propagates GitHub repository not found errors", async () => {
        const githubError = new Error(
            "GitHub repository not found or inaccessible"
        );

        githubError.statusCode = 404;
        githubError.code =
            "GITHUB_REPOSITORY_NOT_FOUND";

        getRepository.mockRejectedValue(githubError);

        await expect(
            connectRepository(
                project._id.toString(),
                user._id.toString(),
                {
                    owner: "example",
                    repo: "missing-repo"
                }
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "GITHUB_REPOSITORY_NOT_FOUND"
        });

        expect(
            await GithubRepository.countDocuments({})
        ).toBe(0);
    });

    test("retrieves an existing repository connection", async () => {
        await GithubRepository.create({
            project: project._id,
            owner: "example",
            repo: "flowforge-repo",
            fullName: "example/flowforge-repo",
            githubId: 123456,
            defaultBranch: "main",
            private: false
        });

        const connection =
            await getRepositoryConnection(
                project._id.toString(),
                user._id.toString()
            );

        expect(connection).not.toBeNull();
        expect(connection.project.toString()).toBe(
            project._id.toString()
        );
        expect(connection.fullName).toBe(
            "example/flowforge-repo"
        );
    });

    test("returns null when the project has no GitHub repository connection", async () => {
        const connection =
            await getRepositoryConnection(
                project._id.toString(),
                user._id.toString()
            );

        expect(connection).toBeNull();
    });

    test("rejects repository retrieval when user is not a project member", async () => {
        const otherUser = await User.create({
            name: "Other User",
            email: "other-retrieval-test@flowforge.local",
            passwordHash: "test-password-hash"
        });

        await expect(
            getRepositoryConnection(
                project._id.toString(),
                otherUser._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });
    });

    test("rejects repository retrieval with an invalid project ID", async () => {
        await expect(
            getRepositoryConnection(
                "invalid-project-id",
                user._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });
});