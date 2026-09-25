const AuthLayout = ({ children }) => {
    return (
        <main className="auth-page">
            <section className="auth-container">
                <div className="auth-brand">
                    <span className="auth-brand-mark">
                        F
                    </span>

                    <span className="auth-brand-name">
                        FlowForge
                    </span>
                </div>

                <div className="auth-content">
                    {children}
                </div>
            </section>
        </main>
    );
};

export default AuthLayout;