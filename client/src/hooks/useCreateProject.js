import { useMutation, useQueryClient } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const useCreateProject = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => apiRequest("/projects", {
            method: "POST",
            body: payload,
            token
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["projects"]
            });
            queryClient.invalidateQueries({
                queryKey: ["overview"]
            });
        }
    });
};

export default useCreateProject;
