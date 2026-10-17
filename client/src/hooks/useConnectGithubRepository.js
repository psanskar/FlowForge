import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const connectGithubRepository = (projectId, repository, token) =>
    apiRequest(`/projects/${projectId}/github`, {
        method: "POST",
        body: repository,
        token
    });

const useConnectGithubRepository = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (repository) =>
            connectGithubRepository(projectId, repository, token),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["github-repository", projectId]
            });
            queryClient.invalidateQueries({
                queryKey: ["github-metrics", projectId]
            });
        }
    });
};

export default useConnectGithubRepository;
