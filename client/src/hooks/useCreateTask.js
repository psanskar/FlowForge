import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const createTask = async (
    projectId,
    payload,
    token
) => {
    return apiRequest(
        `/projects/${projectId}/tasks`,
        {
            method: "POST",
            body: payload,
            token
        }
    );
};

const useCreateTask = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) =>
            createTask(
                projectId,
                payload,
                token
            ),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [
                    "project-tasks",
                    projectId
                ]
            });

            queryClient.invalidateQueries({
                queryKey: [
                    "project",
                    projectId
                ]
            });
        }
    });
};

export default useCreateTask;
