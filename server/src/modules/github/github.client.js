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

    if (!retryAfter) {
        return null;
    }

    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds)) {
        return Math.min(
            seconds * 1000,
            MAX_RETRY_DELAY_MS
        );
    }

    const retryAt = Date.parse(retryAfter);

    if (Number.isNaN(retryAt)) {
        return null;
    }

    return Math.min(
        Math.max(retryAt - Date.now(), 0),
        MAX_RETRY_DELAY_MS
    );
};

const getExponentialBackoff = (attempt) => {
    return Math.min(
        DEFAULT_RETRY_DELAY_MS *
            2 ** attempt,
        MAX_RETRY_DELAY_MS
    );
};

const isRetryableStatus = (status) => {
    return (
        status === 403 ||
        status === 429 ||
        status >= 500
    );
};

const githubRequest = async (
    path,
    options = {}
) => {
    let lastResponse = null;

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

            lastResponse = response;

            if (response.status === 404) {
                throw createGithubError(
                    404,
                    options.notFoundCode ||
                        "GITHUB_RESOURCE_NOT_FOUND",
                    "GitHub resource not found or inaccessible"
                );
            }

            if (
                isRetryableStatus(
                    response.status
                ) &&
                attempt < MAX_RETRIES
            ) {
                const retryAfter =
                    getRetryAfterDelay(response);

                const delay =
                    retryAfter ??
                    getExponentialBackoff(
                        attempt
                    );

                await sleep(delay);
                continue;
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

            if (response.status >= 500) {
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
            if (
                error.code ===
                    "GITHUB_RATE_LIMITED" ||
                error.code ===
                    "GITHUB_API_ERROR" ||
                error.code ===
                    "GITHUB_RESOURCE_NOT_FOUND" ||
                error.code ===
                    "GITHUB_REPOSITORY_NOT_FOUND"
            ) {
                if (
                    lastResponse &&
                    isRetryableStatus(
                        lastResponse.status
                    ) &&
                    attempt < MAX_RETRIES
                ) {
                    const retryAfter =
                        getRetryAfterDelay(
                            lastResponse
                        );

                    const delay =
                        retryAfter ??
                        getExponentialBackoff(
                            attempt
                        );

                    await sleep(delay);
                    continue;
                }

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