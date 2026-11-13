import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useGithubRepository = (projectId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["github-repository", projectId],
        queryFn: async () => {
            const response = await apiRequest(
                `/projects/${projectId}/github`,
                { token }
            );

            return response.data.repository;
        },
        enabled: Boolean(token && projectId)
    });
};

const useGithubMetrics = (projectId, enabled) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["github-metrics", projectId, 30],
        queryFn: () => apiRequest(
            `/projects/${projectId}/github/metrics?days=30`,
            { token }
        ),
        enabled: Boolean(token && projectId && enabled),
        staleTime: 60 * 1000
    });
};

const useConnectGithubRepository = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (repository) => apiRequest(
            `/projects/${projectId}/github`,
            {
                method: "POST",
                body: repository,
                token
            }
        ),
        onSuccess: () => Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["github-repository", projectId]
            }),
            queryClient.invalidateQueries({
                queryKey: ["github-metrics", projectId]
            })
        ])
    });
};

export {
    useConnectGithubRepository,
    useGithubMetrics,
    useGithubRepository
};
