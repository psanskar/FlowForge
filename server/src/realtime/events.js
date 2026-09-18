let io = null;

function initializeRealtime(socketServer) {
    io = socketServer;
}

function emitToProject(projectId, event, payload) {
    if (!io) {
        return;
    }

    io.to(`project:${projectId}`).emit(event, payload);
}

module.exports = {
    initializeRealtime,
    emitToProject,
};