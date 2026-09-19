const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const Project = require("../modules/projects/project.model");
const { initializeRealtime } = require("./events");

let io;

const authenticateSocket = (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(
                new Error("AUTHENTICATION_REQUIRED")
            );
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = {
            id: decoded.userId
        };

        next();
    } catch (error) {
        return next(
            new Error("INVALID_TOKEN")
        );
    }
};

const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin:
                process.env.CLIENT_URL ||
                "http://localhost:5173",
            credentials: true
        }
    });

    initializeRealtime(io);

    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        console.log(
            `Socket connected: ${socket.id} (user: ${socket.user.id})`
        );

        socket.on("project:join", async (projectId, callback) => {
            try {
                const project = await Project.findOne({
                    _id: projectId,
                    "members.user": socket.user.id
                })
                    .select("_id")
                    .lean();

                if (!project) {
                    return callback({
                        success: false,
                        error: {
                            code: "PROJECT_ACCESS_DENIED",
                            message:
                                "You do not have access to this project"
                        }
                    });
                }

                const room = `project:${projectId}`;

                await socket.join(room);

                return callback({
                    success: true,
                    data: {
                        projectId
                    }
                });
            } catch (error) {
                console.error(
                    "Project room join error:",
                    error
                );

                return callback({
                    success: false,
                    error: {
                        code: "PROJECT_ROOM_ERROR",
                        message:
                            "Unable to join project room"
                    }
                });
            }
        });

        socket.on("project:leave", async (projectId, callback) => {
            const room = `project:${projectId}`;

            await socket.leave(room);

            return callback({
                success: true,
                data: {
                    projectId
                }
            });
        });

        socket.on("disconnect", () => {
            console.log(
                `Socket disconnected: ${socket.id}`
            );
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error(
            "Socket.IO has not been initialized"
        );
    }

    return io;
};

module.exports = {
    initializeSocket,
    getIO
};