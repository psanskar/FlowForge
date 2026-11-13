import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useCreateMilestone = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => apiRequest(
            `/projects/${projectId}/milestones`,
            { method: "POST", body: payload, token }
        ),
        onSuccess: () => {
            return Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["project-dashboard", projectId]
                }),
                queryClient.invalidateQueries({
                    queryKey: ["project-milestones", projectId]
                })
            ]);
        }
    });
};

export default useCreateMilestone;
