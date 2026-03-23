let _io = null;

/**
 * Store the socket.io Server instance. Called once from server.js.
 * @param {import('socket.io').Server} io
 */
function setIo(io) {
    _io = io;
}

/**
 * Emit a notification to a specific user's room.
 * Best-effort — if socket is not initialised, fails silently.
 * @param {string} userId  - UUID of the target user
 * @param {object} payload - The full notification row from DB
 */
function emitNotification(userId, payload) {
    if (!_io) return;
    try {
        _io.to(`user:${userId}`).emit('notification:new', payload);
        console.log(`[Socket] Emitted notification:new to user:${userId} — type: ${payload.type}`);
    } catch (err) {
        console.error('[Socket] emitNotification error:', err.message);
    }
}

export { setIo, emitNotification };
