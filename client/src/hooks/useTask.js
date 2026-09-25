import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchTask = async (
    taskId,
    token
) => {
    return apiRequest(
        `/tasks/${taskId}`,
        {
            token
        }
    );
};

const useTask = (taskId) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: [
            "task",
            taskId
        ],

        queryFn: () =>
            fetchTask(
                taskId,
                token
            ),

        enabled:
            Boolean(token) &&
            Boolean(taskId),

        staleTime: 30 * 1000
    });
};

export default useTask;