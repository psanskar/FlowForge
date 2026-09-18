const express = require("express");

const authController = require("./auth.controller");
const {
    validateRegister,
    validateLogin
} = require("./auth.validation");

const requireAuth = require("../../middleware/auth.middleware");

const router = express.Router();

router.post(
    "/register",
    validateRegister,
    authController.register
);

router.post(
    "/login",
    validateLogin,
    authController.login
);

router.get(
    "/me",
    requireAuth,
    authController.getMe
);

module.exports = router;