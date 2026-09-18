const validateRegister = (req, res, next) => {
    const { name, email, password } = req.body;

    const errors = {};

    if (typeof name !== "string" || name.trim().length < 2) {
        errors.name = "Name must be at least 2 characters long";
    }

    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        errors.email = "A valid email address is required";
    }

    if (typeof password !== "string" || password.length < 8) {
        errors.password = "Password must be at least 8 characters long";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: errors
            }
        });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    const errors = {};

    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        errors.email = "A valid email address is required";
    }

    if (typeof password !== "string" || password.length < 8) {
        errors.password = "Password must be at least 8 characters long";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: errors
            }
        });
    }

    next();
};

module.exports = {
    validateRegister,
    validateLogin
};