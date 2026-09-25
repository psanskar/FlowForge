import {
    Navigate,
    Route,
    Routes
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import OverviewPage from "../pages/OverviewPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectWorkspacePage from "../pages/ProjectWorkspacePage";
import ProjectTasksPage from "../pages/ProjectTasksPage";
import TaskDetailPage from "../pages/TaskDetailPage";

import AppLayout from "../layouts/AppLayout";

const ProtectedRoute = ({ children }) => {
    const {
        isAuthenticated,
        isLoading
    } = useAuth();

    if (isLoading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return children;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route
                path="/login"
                element={<LoginPage />}
            />

            <Route
                path="/register"
                element={<RegisterPage />}
            />

            <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    index
                    element={<OverviewPage />}
                />

                <Route
                    path="projects"
                    element={<ProjectsPage />}
                />

                <Route
                    path="projects/:projectId"
                    element={<ProjectWorkspacePage />}
                />

                <Route
                    path="projects/:projectId/tasks"
                    element={<ProjectTasksPage />}
                />

                <Route
                    path="tasks/:taskId"
                    element={<TaskDetailPage />}
                />
            </Route>

            <Route
                path="/"
                element={
                    <Navigate
                        to="/app"
                        replace
                    />
                }
            />

            <Route
                path="*"
                element={
                    <Navigate
                        to="/app"
                        replace
                    />
                }
            />
        </Routes>
    );
};

export default AppRoutes;