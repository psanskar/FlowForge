import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const createDependency = async (
    projectId,
    payload,
    token
) => {
    return apiRequest(
        `/projects/${projectId}/dependencies`,
        {
            method: "POST",
            body: payload,
            token
        }
    );
};

const useCreateDependency = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) =>
            createDependency(
                projectId,
                payload,
                token
            ),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [
                    "project-dependencies",
                    projectId
                ]
            });
        }
    });
};

export default useCreateDependency;
