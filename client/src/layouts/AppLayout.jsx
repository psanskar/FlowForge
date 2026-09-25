import {
    NavLink,
    Outlet,
    useNavigate
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const AppLayout = () => {
    const navigate = useNavigate();

    const {
        user,
        logout
    } = useAuth();

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