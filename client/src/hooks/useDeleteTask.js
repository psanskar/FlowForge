import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const deleteTask = async (
    taskId,
    token
) => {
    return apiRequest(
        `/tasks/${taskId}`,
        {
            method: "DELETE",
            token
        }
    );
};

const useDeleteTask = (taskId, projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () =>
            deleteTask(
                taskId,
                token
            ),

        onSuccess: () => {
            queryClient.removeQueries({
                queryKey: [
                    "task",
                    taskId
                ]
            });

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

export default useDeleteTask;
