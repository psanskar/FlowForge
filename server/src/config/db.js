const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        if (process.env.NODE_ENV === "production") {
            const topologyType = mongoose.connection
                .getClient()
                .topology
                .description
                .type;
            const transactionCapable = [
                "ReplicaSetWithPrimary",
                "Sharded",
                "LoadBalanced"
            ].includes(topologyType);

            if (!transactionCapable) {
                throw new Error(
                    "Production MongoDB must be a replica set or sharded cluster so dependency writes can use transactions."
                );
            }
        }

        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        await mongoose.disconnect().catch(() => {});
        throw error;
    }
};

module.exports = connectDB;
