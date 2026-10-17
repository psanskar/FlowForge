import {
    useMutation,
    useQueryClient
} from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/useAuth";

const createProject = (payload, token) => {
    return apiRequest(
        "/projects",
        {
            method: "POST",
            body: payload,
            token
        }
    );
};

const useCreateProject = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) =>
            createProject(payload, token),

        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: ["projects"]
            })
    });
};

export default useCreateProject;