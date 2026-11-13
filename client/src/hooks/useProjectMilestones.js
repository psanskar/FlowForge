import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "./useAuth";

const useProjectMilestones = (projectId, enabled = true) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["project-milestones", projectId],
        queryFn: async () => {
            const response = await apiRequest(
                `/projects/${projectId}/milestones?limit=100`,
                { token }
            );

            return response.data.milestones;
        },
        enabled: Boolean(token && projectId && enabled),
        staleTime: 60 * 1000
    });
};

export default useProjectMilestones;
