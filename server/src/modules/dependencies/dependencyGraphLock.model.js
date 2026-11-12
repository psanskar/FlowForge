const mongoose = require("mongoose");

const dependencyGraphLockSchema = new mongoose.Schema(
    {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        revision: {
            type: Number,
            default: 0
        }
    },
    {
        versionKey: false
    }
);

module.exports = mongoose.model(
    "DependencyGraphLock",
    dependencyGraphLockSchema
);
