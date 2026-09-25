import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchDependencies = async (
    projectId,
    token
) => {
    return apiRequest(
        `/projects/${projectId}/dependencies`,
        {
            token
        }
    );
};

const useDependencies = (projectId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: [
            "project-dependencies",
            projectId
        ],

        queryFn: () =>
            fetchDependencies(
                projectId,
                token
            ),

        enabled:
            Boolean(token) &&
            Boolean(projectId),

        staleTime: 30 * 1000
    });
};

export default useDependencies;