const mongoose = require("mongoose");

const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const value = req.params[paramName];

        if (!mongoose.isValidObjectId(value)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_ID",
                    message: `Invalid ${paramName}`
                }
            });
        }

        next();
    };
};

module.exports = {
    validateObjectId
};