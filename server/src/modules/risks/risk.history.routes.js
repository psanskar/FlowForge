const express = require("express");

const requireAuth = require(
    "../../middleware/auth.middleware"
);

const {
    validateObjectId
} = require(
    "../../middleware/validation.middleware"
);

const {
    validateRiskHistoryQuery
} = require(
    "./risk.history.validation"
);

const riskHistoryController = require(
    "./risk.history.controller"
);

const router = express.Router();

router.get(
    "/:projectId/risks/history",
    requireAuth,
    validateObjectId("projectId"),
    validateRiskHistoryQuery,
    riskHistoryController.getRiskHistory
);

module.exports = router;