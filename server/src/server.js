require("dotenv").config();

const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const { initializeSocket } = require("./realtime/socket");

const PORT = process.env.PORT || 5000;

const createServer = () => {
    const httpServer = http.createServer(app);

    initializeSocket(httpServer);

    return httpServer;
};

const startServer = async () => {
    await connectDB();

    const httpServer = createServer();

    httpServer.listen(PORT, () => {
        console.log(
            `FlowForge API running on port ${PORT}`
        );
    });

    return httpServer;
};

if (require.main === module) {
    startServer();
}

module.exports = {
    createServer,
    startServer
};