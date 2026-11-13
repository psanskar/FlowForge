import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiRequest from "../api/client";
import AuthContext from "./auth-context";

const TOKEN_STORAGE_KEY = "flowforge_token";

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(
        () => localStorage.getItem(TOKEN_STORAGE_KEY)
    );

    const [user, setUser] = useState(null);

    const [isLoading, setIsLoading] = useState(
        Boolean(token)
    );
    const [authRestoreError, setAuthRestoreError] = useState("");
    const [restoreAttempt, setRestoreAttempt] = useState(0);

    const clearAuthentication = useCallback(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
        setAuthRestoreError("");
        setIsLoading(false);
    }, []);

    const login = async (credentials) => {
        const response = await apiRequest(
            "/auth/login",
            {
                method: "POST",
                body: credentials
            }
        );

        const newToken = response.data.token;
        const authenticatedUser = response.data.user;

        localStorage.setItem(
            TOKEN_STORAGE_KEY,
            newToken
        );

        setToken(newToken);
        setUser(authenticatedUser);
        setAuthRestoreError("");

        return authenticatedUser;
    };

    const register = async (userData) => {
        const response = await apiRequest(
            "/auth/register",
            {
                method: "POST",
                body: userData
            }
        );

        const newToken = response.data.token;
        const registeredUser = response.data.user;

        localStorage.setItem(
            TOKEN_STORAGE_KEY,
            newToken
        );

        setToken(newToken);
        setUser(registeredUser);
        setAuthRestoreError("");

        return registeredUser;
    };

    const logout = () => {
        clearAuthentication();
    };

    const retryAuthenticationRestore = () => {
        setAuthRestoreError("");
        setIsLoading(true);
        setRestoreAttempt((attempt) => attempt + 1);
    };

    useEffect(() => {
        let isMounted = true;

        const restoreAuthentication = async () => {
            if (!token) {
                setUser(null);
                setAuthRestoreError("");
                setIsLoading(false);
                return;
            }

            setAuthRestoreError("");
            try {
                const response = await apiRequest(
                    "/auth/me",
                    {
                        token
                    }
                );

                if (isMounted) {
                    setUser(response.data.user);
                }
            } catch (error) {
                if (isMounted) {
                    if (error.status === 401) {
                        clearAuthentication();
                    } else {
                        // Keep the saved token through network/API outages.
                        // Only a definitive unauthorized response means it
                        // is safe to discard the user's session.
                        setUser(null);
                        setAuthRestoreError(
                            "FlowForge could not validate your saved session. Check that the API is running, then retry. Your saved login has been kept."
                        );
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        restoreAuthentication();

        return () => {
            isMounted = false;
        };
    }, [token, clearAuthentication, restoreAttempt]);

    const value = {
        token,
        user,
        isAuthenticated: Boolean(token && user),
        isLoading,
        authRestoreError,
        retryAuthenticationRestore,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
