import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useProjectInvitations = (projectId, enabled = true) => {
    const { token } = useAuth();
    return useQuery({
        queryKey: ["project-invitations", projectId || "incoming"],
        queryFn: () => apiRequest(
            projectId ? `/projects/${projectId}/invitations` : "/projects/invitations",
            { token }
        ),
        enabled: Boolean(token) && enabled,
        staleTime: projectId ? 30_000 : 0,
        refetchInterval: projectId ? false : 30_000
    });
};

export const useRespondToProjectInvitation = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ invitationId, action }) => apiRequest(
            `/projects/invitations/${invitationId}/${action}`,
            { method: "POST", token }
        ),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["project-invitations"] }),
                queryClient.invalidateQueries({ queryKey: ["projects"] }),
                queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] })
            ]);
        }
    });
};

export default useProjectInvitations;
