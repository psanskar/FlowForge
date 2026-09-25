import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import apiRequest from "../api/client";

const AuthContext = createContext(null);

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

        const restoreAuthentication = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }

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
            } catch {
                if (isMounted) {
                    clearAuthentication();
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

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider."
        );
    }

    return context;
};