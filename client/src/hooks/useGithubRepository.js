import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/useAuth";

const fetchGithubRepository = (projectId, token) =>
    apiRequest(`/projects/${projectId}/github`, { token });

const useGithubRepository = (projectId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["github-repository", projectId],
        queryFn: () => fetchGithubRepository(projectId, token),
        enabled: Boolean(token && projectId),
        staleTime: 60 * 1000
    });
};

export default useGithubRepository;
