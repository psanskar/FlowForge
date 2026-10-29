import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const useCreateMilestone = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => apiRequest(
            `/projects/${projectId}/milestones`,
            { method: "POST", body: payload, token }
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-dashboard", projectId]
            });
        }
    });
};

export default useCreateMilestone;
