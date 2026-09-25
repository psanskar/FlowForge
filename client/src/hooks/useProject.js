import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchProject = async (projectId, token) => {
    return apiRequest(
        `/projects/${projectId}`,
        {
            token
        }
    );
};

const useProject = (projectId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["project", projectId],
        queryFn: () =>
            fetchProject(projectId, token),
        enabled:
            Boolean(token) &&
            Boolean(projectId)
    });
};

export default useProject;