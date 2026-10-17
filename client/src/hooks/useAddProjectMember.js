import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const addProjectMember = (projectId, payload, token) => {
    return apiRequest(`/projects/${projectId}/members`, {
        method: "POST",
        body: payload,
        token
    });
};

const useAddProjectMember = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) =>
            addProjectMember(projectId, payload, token),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project", projectId]
            });
        }
    });
};

export default useAddProjectMember;
