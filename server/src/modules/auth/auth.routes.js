const express = require("express");

const authController = require("./auth.controller");
const {
    validateRegister,
    validateLogin
} = require("./auth.validation");

const requireAuth = require("../../middleware/auth.middleware");
const {
    loginRateLimit,
    registrationRateLimit
} = require("../../middleware/authRateLimit.middleware");

const router = express.Router();

router.post(
    "/register",
    registrationRateLimit,
    validateRegister,
    authController.register
);

router.post(
    "/login",
    loginRateLimit,
    validateLogin,
    authController.login
);

router.get(
    "/me",
    requireAuth,
    authController.getMe
);

module.exports = router;
