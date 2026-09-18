const request = require("supertest");

const app = require("../../src/app");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const GithubRepository = require("../../src/modules/github/github.model");

const githubClient = require("../../src/modules/github/github.client");

jest.mock("../../src/modules/github/github.client");

describe("GitHub API", () => {
    let token;
    let userId;
    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await GithubRepository.deleteMany({});

        jest.clearAllMocks();

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "GitHub API Test User",
                email: "github-api-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        userId = registerResponse.body.data.user.id;

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "github-api-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;

        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "GitHub API Test Project"
            });

        expect(projectResponse.status).toBe(201);

        projectId = projectResponse.body.data.project._id;
    });

    test("connects a GitHub repository for an authenticated project member", async () => {
        githubClient.getRepository.mockResolvedValue({
            id: 123456,
            name: "flowforge-test",
            full_name: "test-owner/flowforge-test",
            private: false,
            default_branch: "main",
            owner: {
                login: "test-owner"
            }
        });

        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "test-owner",
                repo: "flowforge-test"
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const repository =
            response.body.data.repository;

        expect(repository.project).toBe(projectId);
        expect(repository.owner).toBe("test-owner");
        expect(repository.repo).toBe("flowforge-test");
        expect(repository.fullName).toBe(
            "test-owner/flowforge-test"
        );
        expect(repository.githubId).toBe(123456);
        expect(repository.defaultBranch).toBe("main");
        expect(repository.private).toBe(false);

        expect(
            githubClient.getRepository
        ).toHaveBeenCalledWith(
            "test-owner",
            "flowforge-test"
        );

        const databaseRepository =
            await GithubRepository.findOne({
                project: projectId
            });

        expect(databaseRepository).not.toBeNull();
        expect(databaseRepository.fullName).toBe(
            "test-owner/flowforge-test"
        );
    });

    test("trims GitHub owner and repository name", async () => {
        githubClient.getRepository.mockResolvedValue({
            id: 123456,
            name: "flowforge-test",
            full_name: "test-owner/flowforge-test",
            private: false,
            default_branch: "main",
            owner: {
                login: "test-owner"
            }
        });

        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "  test-owner  ",
                repo: "  flowforge-test  "
            });

        expect(response.status).toBe(200);

        expect(
            githubClient.getRepository
        ).toHaveBeenCalledWith(
            "test-owner",
            "flowforge-test"
        );
    });

    test("rejects GitHub connection without authentication", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .send({
                owner: "test-owner",
                repo: "flowforge-test"
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "AUTHENTICATION_REQUIRED"
        );
    });

    test("rejects an invalid project ID", async () => {
        const response = await request(app)
            .post("/api/v1/projects/not-a-valid-id/github")
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "test-owner",
                repo: "flowforge-test"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "INVALID_ID"
        );
    });

    test("rejects a missing GitHub repository owner", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                repo: "flowforge-test"
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "INVALID_GITHUB_REPOSITORY"
        );

        expect(
            githubClient.getRepository
        ).not.toHaveBeenCalled();
    });

    test("rejects an empty GitHub repository name", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "test-owner",
                repo: "   "
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "INVALID_GITHUB_REPOSITORY"
        );

        expect(
            githubClient.getRepository
        ).not.toHaveBeenCalled();
    });

    test("returns GitHub repository not found error", async () => {
        const error = new Error(
            "GitHub repository not found or inaccessible"
        );

        error.statusCode = 404;
        error.code = "GITHUB_REPOSITORY_NOT_FOUND";

        githubClient.getRepository.mockRejectedValue(error);

        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "unknown-owner",
                repo: "unknown-repo"
            });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "GITHUB_REPOSITORY_NOT_FOUND"
        );
    });

    test("rejects a project the authenticated user cannot access", async () => {
        const otherUserResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Other GitHub User",
                email: "other-github-user@flowforge.local",
                password: "TestPassword123"
            });

        expect(otherUserResponse.status).toBe(201);

        const otherLoginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "other-github-user@flowforge.local",
                password: "TestPassword123"
            });

        expect(otherLoginResponse.status).toBe(200);

        const otherToken =
            otherLoginResponse.body.data.token;

        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set(
                "Authorization",
                `Bearer ${otherToken}`
            )
            .send({
                owner: "test-owner",
                repo: "flowforge-test"
            });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "PROJECT_NOT_FOUND"
        );

        expect(
            githubClient.getRepository
        ).not.toHaveBeenCalled();
    });

    test("retrieves the connected GitHub repository", async () => {
        githubClient.getRepository.mockResolvedValue({
            id: 123456,
            name: "flowforge-test",
            full_name: "test-owner/flowforge-test",
            private: false,
            default_branch: "main",
            owner: {
                login: "test-owner"
            }
        });

        await request(app)
            .post(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                owner: "test-owner",
                repo: "flowforge-test"
            });

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(
            response.body.data.repository.fullName
        ).toBe("test-owner/flowforge-test");

        expect(
            response.body.data.repository.defaultBranch
        ).toBe("main");
    });

    test("returns null when no GitHub repository is connected", async () => {
        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/github`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.repository).toBeNull();
    });

    test("rejects repository retrieval without authentication", async () => {
        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/github`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "AUTHENTICATION_REQUIRED"
        );
    });

    test("rejects repository retrieval for an invalid project ID", async () => {
        const response = await request(app)
            .get("/api/v1/projects/not-a-valid-id/github")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "INVALID_ID"
        );
    });
});