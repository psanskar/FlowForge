import {
    useEffect,
    useState
} from "react";

import AuthContext from "./authContextValue";
import apiRequest from "../api/client";

const TOKEN_STORAGE_KEY = "flowforge_token";

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(
        () => localStorage.getItem(TOKEN_STORAGE_KEY)
    );

    const [user, setUser] = useState(null);

    const [isLoading, setIsLoading] = useState(
        Boolean(token)
    );

    const clearAuthentication = () => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
    };

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

        return registeredUser;
    };

    const logout = () => {
        clearAuthentication();
    };

    useEffect(() => {
        let isMounted = true;

        const tokenToRestore = localStorage.getItem(
            TOKEN_STORAGE_KEY
        );

        const restoreAuthentication = async () => {
            if (!tokenToRestore) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await apiRequest(
                    "/auth/me",
                    {
                        token: tokenToRestore
                    }
                );

                if (isMounted) {
                    setUser(response.data.user);
                }
            } catch {
                if (isMounted) {
                    localStorage.removeItem(TOKEN_STORAGE_KEY);
                    setToken(null);
                    setUser(null);
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
    }, []);

    const value = {
        token,
        user,
        isAuthenticated: Boolean(token && user),
        isLoading,
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