import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useProjectMembership = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ action, memberId, email }) => {
            if (action === "invite") {
                return apiRequest(`/projects/${projectId}/members`, {
                    method: "POST",
                    body: { email },
                    token
                });
            }

            if (action === "cancel-invitation") {
                return apiRequest(`/projects/${projectId}/invitations/${memberId}`, {
                    method: "DELETE",
                    token
                });
            }

            if (action === "remove") {
                return apiRequest(`/projects/${projectId}/members/${memberId}`, {
                    method: "DELETE",
                    token
                });
            }

            if (action === "leave") {
                return apiRequest(`/projects/${projectId}/members/me`, {
                    method: "DELETE",
                    token
                });
            }

            return apiRequest(`/projects/${projectId}/owner`, {
                method: "PATCH",
                body: { newOwnerId: memberId },
                token
            });
        },
        onSuccess: async (_data, variables) => {
            if (variables.action === "leave") {
                // The member no longer has access; don't refetch the detail
                // query and turn a successful leave into a stale 404 screen.
                queryClient.removeQueries({ queryKey: ["project", projectId], exact: true });
            } else {
                await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["projects"] }),
                variables.action === "leave"
                    ? Promise.resolve()
                    : queryClient.invalidateQueries({ queryKey: ["project-dashboard", projectId] })
            ]);
        }
    });

    return mutation;
};

export default useProjectMembership;
