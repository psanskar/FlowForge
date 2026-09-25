const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
    throw new Error(
        "VITE_API_BASE_URL is not configured."
    );
}

const apiRequest = async (
    endpoint,
    {
        method = "GET",
        body,
        token,
        headers = {}
    } = {}
) => {
    const requestHeaders = {
        ...headers
    };

    if (body !== undefined) {
        requestHeaders["Content-Type"] = "application/json";
    }

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            method,
            headers: requestHeaders,
            body:
                body !== undefined
                    ? JSON.stringify(body)
                    : undefined
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error = new Error(
            data?.error?.message ||
            "An unexpected API error occurred."
        );

        error.status = response.status;
        error.code =
            data?.error?.code ||
            "API_ERROR";
        error.data = data;

        throw error;
    }

    return data;
};

export default apiRequest;