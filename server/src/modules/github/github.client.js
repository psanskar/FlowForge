const GITHUB_API_URL = "https://api.github.com";

const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

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

const sleep = (ms) =>
    new Promise((resolve) =>
        setTimeout(resolve, ms)
    );

const getRetryAfterDelay = (response) => {
    const retryAfter = response.headers?.get(
        "retry-after"
    );

    if (retryAfter) {
        const seconds = Number(retryAfter);

        if (Number.isFinite(seconds)) {
            return Math.max(seconds * 1000, 0);
        }

        const retryAt = Date.parse(retryAfter);
        if (!Number.isNaN(retryAt)) {
            return Math.max(retryAt - Date.now(), 0);
        }
    }

    const remaining = response.headers?.get(
        "x-ratelimit-remaining"
    );
    const reset = Number(
        response.headers?.get("x-ratelimit-reset")
    );

    if (
        remaining === "0" &&
        Number.isFinite(reset) &&
        reset > 0
    ) {
        return Math.max(reset * 1000 - Date.now(), 0);
    }

    return null;
};

const getExponentialBackoff = (attempt) => {
    return Math.min(
        DEFAULT_RETRY_DELAY_MS *
            2 ** attempt,
        MAX_RETRY_DELAY_MS
    );
};

const getRateLimitMessage = async (response) => {
    if (typeof response.clone !== "function") {
        return "";
    }

    try {
        const body = await response.clone().json();
        return String(body?.message || "").toLowerCase();
    } catch {
        return "";
    }
};

const isRateLimited = async (response) => {
    if (response.status === 429) {
        return true;
    }

    if (response.status !== 403) {
        return false;
    }

    if (
        response.headers?.get("retry-after") ||
        response.headers?.get("x-ratelimit-remaining") === "0"
    ) {
        return true;
    }

    const message = await getRateLimitMessage(response);
    return message.includes("rate limit");
};

const githubRequest = async (
    path,
    options = {}
) => {
    for (
        let attempt = 0;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
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

            if (await isRateLimited(response)) {
                const error = createGithubError(
                    503,
                    "GITHUB_RATE_LIMITED",
                    "GitHub API rate limit reached"
                );
                error.retryAfterMs =
                    getRetryAfterDelay(response);
                throw error;
            }

            if (response.status === 403) {
                throw createGithubError(
                    403,
                    "GITHUB_API_FORBIDDEN",
                    "GitHub denied access to this resource"
                );
            }

            if (response.status >= 500) {
                if (attempt < MAX_RETRIES) {
                    await sleep(
                        getExponentialBackoff(attempt)
                    );
                    continue;
                }

                throw createGithubError(
                    502,
                    "GITHUB_API_ERROR",
                    "GitHub API request failed"
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
        } catch (error) {
            if (error.statusCode) {
                throw error;
            }

            if (attempt < MAX_RETRIES) {
                await sleep(
                    getExponentialBackoff(attempt)
                );
                continue;
            }

            throw createGithubError(
                502,
                "GITHUB_API_ERROR",
                "GitHub API request failed"
            );
        }
    }

    throw createGithubError(
        502,
        "GITHUB_API_ERROR",
        "GitHub API request failed"
    );
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
