const express = require("express");

const requireOperationsKey = require("../../middleware/operationsKey.middleware");
const operationsController = require("./operations.controller");

const router = express.Router();

router.get("/ready", operationsController.getReadiness);
router.get(
    "/ops/queues",
    requireOperationsKey,
    operationsController.getQueueOperations
);

module.exports = router;
