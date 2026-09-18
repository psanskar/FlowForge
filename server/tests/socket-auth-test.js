const { io } = require("socket.io-client");

const token = process.env.SOCKET_TEST_TOKEN;
const projectId = process.env.SOCKET_TEST_PROJECT_ID;
const taskId = process.env.SOCKET_TEST_TASK_ID;

if (!token) {
    console.error("SOCKET_TEST_TOKEN is missing");
    process.exit(1);
}

if (!projectId) {
    console.error("SOCKET_TEST_PROJECT_ID is missing");
    process.exit(1);
}

if (!taskId) {
    console.error("SOCKET_TEST_TASK_ID is missing");
    process.exit(1);
}

const socket = io("http://localhost:5000", {
    auth: {
        token
    }
});

socket.on("connect", () => {
    console.log("Socket authentication: PASSED");

    socket.emit(
        "project:join",
        projectId,
        (response) => {
            if (!response.success) {
                console.error(
                    "Project room authorization: FAILED"
                );
                console.error(response);
                socket.disconnect();
                process.exit(1);
            }

            console.log(
                "Project room authorization: PASSED"
            );

            console.log(
                "Listening for task.updated..."
            );
        }
    );
});

socket.on("task.updated", (data) => {
    console.log(
        "task.updated event received: PASSED"
    );

    console.log(
        "Updated task ID:",
        data.task._id
    );

    console.log(
        "Updated task version:",
        data.task.version
    );

    console.log(
        "Updated task status:",
        data.task.status
    );

    socket.disconnect();
});

socket.on("connect_error", (error) => {
    console.error(
        "Socket authentication: FAILED"
    );
    console.error(error.message);

    process.exit(1);
});

socket.on("disconnect", () => {
    console.log("Socket disconnected");
});