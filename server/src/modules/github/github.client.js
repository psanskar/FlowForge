const GITHUB_API_URL = "https://api.github.com";

const createGithubError = (
    statusCode,
    code,
    message
) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

const githubRequest = async (
    path,
    options = {}
) => {
    const response = await fetch(
        `${GITHUB_API_URL}${path}`,
        {
            method: "GET",
            headers: {
                Accept:
                    "application/vnd.github+json",
                "X-GitHub-Api-Version":
                    "2022-11-28",
                "User-Agent": "FlowForge",
                ...(options.headers || {})
            }
        }
    );

    if (response.status === 404) {
        throw createGithubError(
            404,
            options.notFoundCode ||
                "GITHUB_RESOURCE_NOT_FOUND",
            "GitHub resource not found or inaccessible"
        );
    }

    if (
        response.status === 403 ||
        response.status === 429
    ) {
        throw createGithubError(
            503,
            "GITHUB_RATE_LIMITED",
            "GitHub API rate limit reached"
        );
    }

    if (!response.ok) {
        throw createGithubError(
            502,
            "GITHUB_API_ERROR",
            "GitHub API request failed"
        );
    }

    return response.json();
};

const getRepository = async (
    owner,
    repo
) => {
    return githubRequest(
        `/repos/${encodeURIComponent(
            owner
        )}/${encodeURIComponent(
            repo
        )}`,
        {
            notFoundCode:
                "GITHUB_REPOSITORY_NOT_FOUND"
        }
    );
};

const getCommits = async (
    owner,
    repo,
    {
        perPage = 30,
        page = 1
    } = {}
) => {
    return githubRequest(
        `/repos/${encodeURIComponent(
            owner
        )}/${encodeURIComponent(
            repo
        )}/commits?per_page=${perPage}&page=${page}`
    );
};

const getPullRequests = async (
    owner,
    repo,
    {
        state = "all",
        perPage = 30,
        page = 1
    } = {}
) => {
    return githubRequest(
        `/repos/${encodeURIComponent(
            owner
        )}/${encodeURIComponent(
            repo
        )}/pulls?state=${encodeURIComponent(
            state
        )}&per_page=${perPage}&page=${page}`
    );
};

const getIssues = async (
    owner,
    repo,
    {
        state = "all",
        perPage = 30,
        page = 1
    } = {}
) => {
    return githubRequest(
        `/repos/${encodeURIComponent(
            owner
        )}/${encodeURIComponent(
            repo
        )}/issues?state=${encodeURIComponent(
            state
        )}&per_page=${perPage}&page=${page}`
    );
};

module.exports = {
    getRepository,
    getCommits,
    getPullRequests,
    getIssues
};