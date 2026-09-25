import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchProjectDashboard = async (
    projectId,
    token
) => {
    return apiRequest(
        `/projects/${projectId}/dashboard`,
        {
            token
        }
    );
};

const useProjectDashboard = (projectId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: [
            "project-dashboard",
            projectId
        ],

        queryFn: () =>
            fetchProjectDashboard(
                projectId,
                token
            ),

        enabled:
            Boolean(token) &&
            Boolean(projectId)
    });
};

export default useProjectDashboard;