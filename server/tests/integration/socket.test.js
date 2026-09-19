const http = require("http");
const jwt = require("jsonwebtoken");
const { io: createClient } = require("socket.io-client");
const request = require("supertest");

const app = require("../../src/app");
const {
    initializeSocket,
    getIO
} = require("../../src/realtime/socket");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");

describe("Socket.IO integration", () => {
    let httpServer;
    let ioServer;
    let port;

    let user;
    let unauthorizedUser;
    let project;
    let secondProject;

    const createSocketClient = (token) => {
        return createClient(
            `http://localhost:${port}`,
            {
                transports: ["websocket"],
                auth: {
                    token
                }
            }
        );
    };

    const createToken = (userId) => {
        return jwt.sign(
            { userId: userId.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
    };

    const connectSocket = async (socket) => {
        await new Promise((resolve, reject) => {
            socket.on("connect", resolve);
            socket.on("connect_error", reject);
        });
    };

    beforeAll(async () => {
        user = await User.create({
            name: "Socket Test User",
            email: "socket-integration@example.com",
            passwordHash: "test-password-hash"
        });

        unauthorizedUser = await User.create({
            name: "Unauthorized Socket User",
            email: "socket-unauthorized@example.com",
            passwordHash: "test-password-hash"
        });

        project = await Project.create({
            name: "Socket Integration Project",
            description: "Project used for Socket.IO integration tests",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active",
            startDate: new Date(),
            targetDate: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            )
        });

        secondProject = await Project.create({
            name: "Second Socket Integration Project",
            description: "Second project used for room isolation tests",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active",
            startDate: new Date(),
            targetDate: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            )
        });

        httpServer = http.createServer(app);

        ioServer = initializeSocket(httpServer);

        await new Promise((resolve) => {
            httpServer.listen(0, resolve);
        });

        port = httpServer.address().port;
    });

    afterAll(async () => {
        if (ioServer) {
            await new Promise((resolve) => {
                ioServer.close(() => {
                    resolve();
                });
            });
        }

        if (httpServer?.listening) {
            await new Promise((resolve, reject) => {
                httpServer.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        }
    });

    test("starts the Socket.IO test server", () => {
        expect(httpServer.listening).toBe(true);
        expect(port).toBeGreaterThan(0);
    });

    test("accepts a valid JWT connection", async () => {
        const token = createToken(user._id);

        const socket = createSocketClient(token);

        await connectSocket(socket);

        expect(socket.connected).toBe(true);

        socket.disconnect();
    });

    test("rejects a connection with an invalid JWT", async () => {
        const socket = createSocketClient("invalid-token");

        await new Promise((resolve, reject) => {
            socket.on("connect", () => {
                reject(
                    new Error(
                        "Socket connected with an invalid JWT"
                    )
                );
            });

            socket.on("connect_error", (error) => {
                expect(error.message).toBe(
                    "INVALID_TOKEN"
                );

                resolve();
            });
        });

        expect(socket.connected).toBe(false);

        socket.disconnect();
    });

    test("allows a project member to join the project room", async () => {
        const token = createToken(user._id);

        const socket = createSocketClient(token);

        await connectSocket(socket);

        const response = await new Promise((resolve) => {
            socket.emit(
                "project:join",
                project._id.toString(),
                resolve
            );
        });

        expect(response.success).toBe(true);
        expect(response.data.projectId).toBe(
            project._id.toString()
        );

        socket.disconnect();
    });

    test("rejects a non-member from joining the project room", async () => {
        const token = createToken(
            unauthorizedUser._id
        );

        const socket = createSocketClient(token);

        await connectSocket(socket);

        const response = await new Promise((resolve) => {
            socket.emit(
                "project:join",
                project._id.toString(),
                resolve
            );
        });

        expect(response.success).toBe(false);
        expect(response.error.code).toBe(
            "PROJECT_ACCESS_DENIED"
        );

        socket.disconnect();
    });

    test("allows a project member to leave the project room", async () => {
        const token = createToken(user._id);

        const socket = createSocketClient(token);

        await connectSocket(socket);

        const joinResponse = await new Promise((resolve) => {
            socket.emit(
                "project:join",
                project._id.toString(),
                resolve
            );
        });

        expect(joinResponse.success).toBe(true);

        const leaveResponse = await new Promise((resolve) => {
            socket.emit(
                "project:leave",
                project._id.toString(),
                resolve
            );
        });

        expect(leaveResponse.success).toBe(true);
        expect(leaveResponse.data.projectId).toBe(
            project._id.toString()
        );

        socket.disconnect();
    });

    test("isolates events between project rooms", async () => {
        const token = createToken(user._id);

        const socket = createSocketClient(token);

        await connectSocket(socket);

        const joinResponse = await new Promise((resolve) => {
            socket.emit(
                "project:join",
                project._id.toString(),
                resolve
            );
        });

        expect(joinResponse.success).toBe(true);

        const io = getIO();

        const receivedEvents = [];

        socket.on("test.project.event", (data) => {
            receivedEvents.push(data);
        });

        io.to(`project:${secondProject._id}`).emit(
            "test.project.event",
            {
                projectId: secondProject._id.toString()
            }
        );

        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });

        expect(receivedEvents).toHaveLength(0);

        socket.disconnect();
    });

    test("emits task.updated when a task is updated through the API", async () => {
        const token = createToken(user._id);

        const createResponse = await request(app)
            .post(
                `/api/v1/projects/${project._id}/tasks`
            )
            .set(
                "Authorization",
                `Bearer ${token}`
            )
            .send({
                title: "Realtime task",
                description:
                    "Task used for Socket.IO update testing",
                priority: "high",
                status: "todo"
            });

        expect(createResponse.status).toBe(201);

        const taskId =
            createResponse.body.data.task._id;

        expect(
            createResponse.body.data.task.version
        ).toBe(1);

        const socket = createSocketClient(token);

        await connectSocket(socket);

        const joinResponse = await new Promise((resolve) => {
            socket.emit(
                "project:join",
                project._id.toString(),
                resolve
            );
        });

        expect(joinResponse.success).toBe(true);

        const taskUpdatedEvent = new Promise(
            (resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(
                        new Error(
                            "Timed out waiting for task.updated event"
                        )
                    );
                }, 3000);

                socket.once(
                    "task.updated",
                    (data) => {
                        clearTimeout(timeout);
                        resolve(data);
                    }
                );
            }
        );

        const updateResponse = await request(app)
            .patch(`/api/v1/tasks/${taskId}`)
            .set(
                "Authorization",
                `Bearer ${token}`
            )
            .send({
                version: 1,
                progress: 50,
                status: "in_progress"
            });

        expect(updateResponse.status).toBe(200);
        expect(
            updateResponse.body.success
        ).toBe(true);

        const updatedTask =
            updateResponse.body.data.task;

        expect(updatedTask.version).toBe(2);
        expect(updatedTask.progress).toBe(50);
        expect(updatedTask.status).toBe(
            "in_progress"
        );

        const eventPayload =
            await taskUpdatedEvent;

        expect(eventPayload).toBeDefined();
        expect(eventPayload.task).toBeDefined();

        expect(
            eventPayload.task._id.toString()
        ).toBe(taskId.toString());

        expect(
            eventPayload.task.project.toString()
        ).toBe(project._id.toString());

        expect(eventPayload.task.version).toBe(2);
        expect(eventPayload.task.progress).toBe(50);
        expect(eventPayload.task.status).toBe(
            "in_progress"
        );

        const databaseTask =
            await Task.findById(taskId);

        expect(databaseTask).not.toBeNull();
        expect(databaseTask.version).toBe(2);
        expect(databaseTask.progress).toBe(50);
        expect(databaseTask.status).toBe(
            "in_progress"
        );

        socket.disconnect();
    });
});