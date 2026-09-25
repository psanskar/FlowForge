import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchHealthTrend = async (
    projectId,
    token,
    days
) => {
    return apiRequest(
        `/projects/${projectId}/health/trend?days=${days}`,
        {
            token
        }
    );
};

const useHealthTrend = (
    projectId,
    days = 30
) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: [
            "project-health-trend",
            projectId,
            days
        ],

        queryFn: () =>
            fetchHealthTrend(
                projectId,
                token,
                days
            ),

        enabled:
            Boolean(token) &&
            Boolean(projectId),

        staleTime: 60 * 1000
    });
};

export default useHealthTrend;