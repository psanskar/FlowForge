import { useQuery } from "@tanstack/react-query";

import apiRequest from "../api/client";
import { useAuth } from "../context/AuthContext";

const fetchProjects = async (token) => {
    return apiRequest(
        "/projects",
        {
            token
        }
    );
};

const useProjects = () => {
    const { token } = useAuth();

    return useQuery({
        queryKey: ["projects"],
        queryFn: () => fetchProjects(token),
        enabled: Boolean(token)
    });
};

export default useProjects;