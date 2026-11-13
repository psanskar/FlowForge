import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useProjectArchive = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (action) => apiRequest(
            `/projects/${projectId}/${action}`,
            { method: "POST", token }
        ),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
                queryClient.invalidateQueries({ queryKey: ["projects"] }),
                queryClient.invalidateQueries({ queryKey: ["project-dashboard", projectId] }),
                queryClient.invalidateQueries({ queryKey: ["project-health-trend", projectId] })
            ]);
        }
    });
};

export default useProjectArchive;
