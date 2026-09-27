import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const updateTask = async (
    taskId,
    payload,
    token
) => {
    return apiRequest(
        `/tasks/${taskId}`,
        {
            method: "PATCH",
            body: payload,
            token
        }
    );
};

const useUpdateTask = (taskId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) =>
            updateTask(
                taskId,
                payload,
                token
            ),

        onSuccess: (response) => {
            const updatedTask =
                response?.data?.task;

            queryClient.invalidateQueries({
                queryKey: [
                    "task",
                    taskId
                ]
            });

            if (updatedTask?.project) {
                const projectId =
                    typeof updatedTask.project === "object"
                        ? updatedTask.project?._id
                        : updatedTask.project;

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
        }
    });
};

export default useUpdateTask;
