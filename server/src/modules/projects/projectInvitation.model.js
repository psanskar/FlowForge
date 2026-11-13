const mongoose = require("mongoose");

const projectInvitationSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    inviter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    invitee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "declined", "cancelled"],
        default: "pending",
        required: true
    },
    respondedAt: { type: Date, default: null }
}, { timestamps: true });

projectInvitationSchema.index(
    { project: 1, invitee: 1 },
    { unique: true, partialFilterExpression: { status: "pending" } }
);
projectInvitationSchema.index({ invitee: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ProjectInvitation", projectInvitationSchema);
