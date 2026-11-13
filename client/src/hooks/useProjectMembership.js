import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useProjectMembership = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ action, memberId, email }) => {
            if (action === "add") {
                return apiRequest(`/projects/${projectId}/members`, {
                    method: "POST",
                    body: { email },
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
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
                queryClient.invalidateQueries({ queryKey: ["projects"] }),
                queryClient.invalidateQueries({ queryKey: ["project-dashboard", projectId] })
            ]);
        }
    });

    return mutation;
};

export default useProjectMembership;
