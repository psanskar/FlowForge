import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchGithubMetrics = (projectId, days, token) =>
    apiRequest(
        `/projects/${projectId}/github/metrics?days=${days}`,
        { token }
    );

const useGithubMetrics = (projectId, enabled = true, days = 30) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["github-metrics", projectId, days],
        queryFn: () => fetchGithubMetrics(projectId, days, token),
        enabled: Boolean(token && projectId && enabled),
        staleTime: 30 * 1000
    });
};

export default useGithubMetrics;
