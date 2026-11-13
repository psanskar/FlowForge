import {
    NavLink,
    Outlet,
    useNavigate
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "../components/ThemeToggle";
import useProjectInvitations from "../hooks/useProjectInvitations";

const AppLayout = () => {
    const navigate = useNavigate();

    const {
        user,
        logout
    } = useAuth();
    const invitationsQuery = useProjectInvitations();
    const pendingInvitationCount = invitationsQuery.data?.data?.invitations?.length || 0;

    const handleLogout = () => {
        logout();

        navigate("/login", {
            replace: true
        });
    };

    return (
        <div className="app-shell">
            <aside className="app-sidebar">
                <div className="app-sidebar-header">
                    <div className="app-brand-mark">
                        F
                    </div>

                    <span className="app-brand-name">
                        FlowForge
                    </span>
                </div>

                <nav className="app-navigation">
                    <NavLink
                        to="/app"
                        end
                        title="Overview"
                        className={({ isActive }) =>
                            `app-nav-link ${
                                isActive
                                    ? "active"
                                    : ""
                            }`
                        }
                    >
                        Overview
                    </NavLink>

                    <NavLink
                        to="/app/projects"
                        title="Projects"
                        className={({ isActive }) =>
                            `app-nav-link ${
                                isActive
                                    ? "active"
                                    : ""
                            }`
                        }
                    >
                        Projects
                    </NavLink>

                    <NavLink
                        to="/app/invitations"
                        title="Project requests"
                        className={({ isActive }) => `app-nav-link ${isActive ? "active" : ""}`}
                    >
                        Project requests
                        {pendingInvitationCount > 0 && <span className="app-nav-count">{pendingInvitationCount}</span>}
                    </NavLink>
                </nav>
            </aside>

            <div className="app-main">
                <header className="app-header">
                    <div>
                        <span className="app-header-label">
                            Execution workspace
                        </span>
                    </div>

                    <div className="app-user-area">
                        <ThemeToggle className="app-theme-toggle" />
                        <div className="app-user-info">
                            <span className="app-user-name">
                                {user?.name}
                            </span>

                            <span className="app-user-email">
                                {user?.email}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="app-logout-button"
                            onClick={handleLogout}
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <main className="app-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
