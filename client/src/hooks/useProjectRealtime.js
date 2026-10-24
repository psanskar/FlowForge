import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

import { useAuth } from "../context/AuthContext";

const getSocketOrigin = () =>
    new URL(
        import.meta.env.VITE_API_BASE_URL,
        window.location.origin
    ).origin;

const useProjectRealtime = (projectId) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!projectId || !token) {
            return undefined;
        }

        const socket = io(getSocketOrigin(), {
            auth: { token },
            transports: ["websocket", "polling"]
        });

        const handleConnect = () => {
            socket.emit("project:join", projectId, (result) => {
                if (!result?.success) {
                    socket.disconnect();
                }
            });
        };

        const handleTaskUpdated = ({ task } = {}) => {
            if (
                !task ||
                String(task.project) !== String(projectId)
            ) {
                return;
            }

            queryClient.setQueryData(
                ["task", String(task._id)],
                (current) => current
                    ? { ...current, data: { ...current.data, task } }
                    : current
            );

            void queryClient.invalidateQueries({
                queryKey: ["project-tasks", projectId]
            });
            void queryClient.invalidateQueries({
                queryKey: ["project-dashboard", projectId]
            });
            void queryClient.invalidateQueries({
                queryKey: ["project-health-trend", projectId]
            });
            void queryClient.invalidateQueries({
                queryKey: ["project-dependencies", projectId]
            });
        };

        socket.on("connect", handleConnect);
        socket.on("task.updated", handleTaskUpdated);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("task.updated", handleTaskUpdated);
            socket.disconnect();
        };
    }, [projectId, queryClient, token]);
};

export default useProjectRealtime;
