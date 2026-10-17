import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiRequest from "../api/client";
import { useAuth } from "../context/useAuth";

const deleteDependency = async (
    projectId,
    dependencyId,
    token
) => {
    return apiRequest(
        `/projects/${projectId}/dependencies/${dependencyId}`,
        {
            method: "DELETE",
            token
        }
    );
};

const useDeleteDependency = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dependencyId) =>
            deleteDependency(
                projectId,
                dependencyId,
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

export default useDeleteDependency;