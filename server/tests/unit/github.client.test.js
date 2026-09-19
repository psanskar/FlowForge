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
        jest.useFakeTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403
        });

        const promise = expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 503,
            code: "GITHUB_RATE_LIMITED"
        });

        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(2000);

        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            3
        );

        jest.useRealTimers();
    });

    test("maps 429 to GITHUB_RATE_LIMITED", async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429
        });

        const promise = expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 503,
            code: "GITHUB_RATE_LIMITED"
        });

        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(2000);

        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            3
        );

        jest.useRealTimers();
    });

    test("maps other GitHub API errors to GITHUB_API_ERROR", async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        const promise = expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 502,
            code: "GITHUB_API_ERROR"
        });

        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(2000);

        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            3
        );

        jest.useRealTimers();
    });
        test("retries a 500 response before succeeding", async () => {
        jest.useFakeTimers();

        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 500
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    id: 123,
                    name: "flowforge"
                })
            });

        const promise = getRepository(
            "owner",
            "flowforge"
        );

        await jest.advanceTimersByTimeAsync(1000);

        const result = await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            2
        );

        expect(result).toEqual({
            id: 123,
            name: "flowforge"
        });

        jest.useRealTimers();
    });

    test("retries a 429 response before succeeding", async () => {
        jest.useFakeTimers();

        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: {
                    get: jest.fn().mockReturnValue(null)
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    id: 123,
                    name: "flowforge"
                })
            });

        const promise = getRepository(
            "owner",
            "flowforge"
        );

        await jest.advanceTimersByTimeAsync(1000);

        const result = await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            2
        );

        expect(result).toEqual({
            id: 123,
            name: "flowforge"
        });

        jest.useRealTimers();
    });

    test("respects Retry-After when GitHub provides it", async () => {
        jest.useFakeTimers();

        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: {
                    get: jest
                        .fn()
                        .mockReturnValue("2")
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    id: 123
                })
            });

        const promise = getRepository(
            "owner",
            "flowforge"
        );

        await jest.advanceTimersByTimeAsync(1999);

        expect(global.fetch).toHaveBeenCalledTimes(
            1
        );

        await jest.advanceTimersByTimeAsync(1);

        const result = await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            2
        );

        expect(result).toEqual({
            id: 123
        });

        jest.useRealTimers();
    });

    test("fails after retry limit is exhausted", async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        const promise = expect(
            getRepository("owner", "flowforge")
        ).rejects.toMatchObject({
            statusCode: 502,
            code: "GITHUB_API_ERROR"
        });

        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(2000);

        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(
            3
        );

        jest.useRealTimers();
    });

});