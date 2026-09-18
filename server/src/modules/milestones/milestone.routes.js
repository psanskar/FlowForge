const express = require("express");

const router = express.Router();

const milestoneController = require("./milestone.controller");

const requireAuth = require("../../middleware/auth.middleware");
const {
    validateCreateMilestone,
    validateUpdateMilestone,
    validateMilestoneListQuery
} = require("./milestone.validation");

const { validateObjectId } = require("../../middleware/validation.middleware");

router.post(
    "/:projectId/milestones",
    requireAuth,
    validateObjectId("projectId"),
    validateCreateMilestone,
    milestoneController.createMilestone
);

router.get(
    "/:projectId/milestones",
    requireAuth,
    validateObjectId("projectId"),
    validateMilestoneListQuery,
    milestoneController.listMilestones
);

router.get(
    "/milestones/:milestoneId",
    requireAuth,
    validateObjectId("milestoneId"),
    milestoneController.getMilestone
);

router.patch(
    "/milestones/:milestoneId",
    requireAuth,
    validateObjectId("milestoneId"),
    validateUpdateMilestone,
    milestoneController.updateMilestone
);

router.delete(
    "/milestones/:milestoneId",
    requireAuth,
    validateObjectId("milestoneId"),
    milestoneController.deleteMilestone
);

module.exports = router;