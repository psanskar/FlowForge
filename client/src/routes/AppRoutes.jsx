import {
    Navigate,
    Route,
    Routes
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import OverviewPage from "../pages/OverviewPage";
import ProjectsPage from "../pages/ProjectsPage";
import CreateProjectPage from "../pages/CreateProjectPage";
import ProjectWorkspacePage from "../pages/ProjectWorkspacePage";
import ProjectTasksPage from "../pages/ProjectTasksPage";
import CreateTaskPage from "../pages/CreateTaskPage";
import CreateMilestonePage from "../pages/CreateMilestonePage";
import TaskDetailPage from "../pages/TaskDetailPage";
import EditTaskPage from "../pages/EditTaskPage";
import ProjectInvitationsPage from "../pages/ProjectInvitationsPage";

import AppLayout from "../layouts/AppLayout";

const ProtectedRoute = ({ children }) => {
    const {
        isAuthenticated,
        isLoading,
        token,
        authRestoreError,
        retryAuthenticationRestore,
        logout
    } = useAuth();

    if (isLoading) {
        return <p>Loading...</p>;
    }

    if (token && authRestoreError) {
        return (
            <section className="page-section">
                <div className="empty-state" role="alert">
                    <h2>Connection interrupted</h2>
                    <p>{authRestoreError}</p>
                    <div className="empty-state-actions">
                        <button
                            type="button"
                            className="primary-button"
                            onClick={retryAuthenticationRestore}
                        >
                            Retry connection
                        </button>
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={logout}
                        >
                            Sign in again
                        </button>
                    </div>
                </div>
            </section>
        );
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

                <Route path="invitations" element={<ProjectInvitationsPage />} />

                <Route
                    path="projects/new"
                    element={<CreateProjectPage />}
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
                    path="projects/:projectId/tasks/new"
                    element={<CreateTaskPage />}
                />

                <Route
                    path="projects/:projectId/milestones/new"
                    element={<CreateMilestonePage />}
                />

                <Route
                    path="tasks/:taskId/edit"
                    element={<EditTaskPage />}
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
