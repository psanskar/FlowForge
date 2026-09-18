const {
    getRepository,
    getCommits,
    getPullRequests,
    getIssues
} = require(
    "../../src/modules/github/github.client"
);

describe("GitHub client", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test("getRepository calls the correct GitHub API endpoint", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                id: 123,
                name: "flowforge"
            })
        });

        const result = await getRepository(
            "owner",
            "flowforge"
        );

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/flowforge",
            expect.objectContaining({
                method: "GET",
                headers: expect.objectContaining({
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "FlowForge"
                })
            })
        );

        expect(result).toEqual({
            id: 123,
            name: "flowforge"
        });
    });

    test("getCommits builds pagination parameters", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue([])
        });

        await getCommits("owner", "flowforge", {
            perPage: 20,
            page: 3
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/flowforge/commits?per_page=20&page=3",
            expect.any(Object)
        );
    });

    test("getPullRequests builds state and pagination parameters", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue([])
        });

        await getPullRequests("owner", "flowforge", {
            state: "open",
            perPage: 15,
            page: 2
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/flowforge/pulls?state=open&per_page=15&page=2",
            expect.any(Object)
        );
    });

    test("getIssues builds state and pagination parameters", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue([])
        });

        await getIssues("owner", "flowforge", {
            state: "closed",
            perPage: 10,
            page: 4
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/flowforge/issues?state=closed&per_page=10&page=4",
            expect.any(Object)
        );
    });

    test("maps 404 to GITHUB_REPOSITORY_NOT_FOUND", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404
        });

        await expect(
            getRepository("owner", "missing")
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "GITHUB_REPOSITORY_NOT_FOUND"
        });
    });

    test("maps 403 to GITHUB_RATE_LIMITED", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403
        });

        await expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 503,
            code: "GITHUB_RATE_LIMITED"
        });
    });

    test("maps 429 to GITHUB_RATE_LIMITED", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429
        });

        await expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 503,
            code: "GITHUB_RATE_LIMITED"
        });
    });

    test("maps other GitHub API errors to GITHUB_API_ERROR", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        await expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 502,
            code: "GITHUB_API_ERROR"
        });
    });
});