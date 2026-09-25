import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchTasks = async (
    projectId,
    token,
    {
        page,
        limit,
        status,
        priority,
        assignee,
        sort
    }
) => {
    const params = new URLSearchParams();

    params.set("page", page);
    params.set("limit", limit);
    params.set("sort", sort);

    if (status) {
        params.set("status", status);
    }

    if (priority) {
        params.set("priority", priority);
    }

    if (assignee) {
        params.set("assignee", assignee);
    }

    return apiRequest(
        `/projects/${projectId}/tasks?${params.toString()}`,
        {
            token
        }
    );
};

const useTasks = (
    projectId,
    {
        page = 1,
        limit = 20,
        status = "",
        priority = "",
        assignee = "",
        sort = "dueDate"
    } = {}
) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: [
            "project-tasks",
            projectId,
            page,
            limit,
            status,
            priority,
            assignee,
            sort
        ],

        queryFn: () =>
            fetchTasks(
                projectId,
                token,
                {
                    page,
                    limit,
                    status,
                    priority,
                    assignee,
                    sort
                }
            ),

        enabled:
            Boolean(token) &&
            Boolean(projectId),

        staleTime: 30 * 1000
    });
};

export default useTasks;