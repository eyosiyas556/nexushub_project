// socket.js - Centralized Socket.io instance
// Import this in any route file to emit real-time events

let io;

const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call init() first.');
  return io;
};

// Safe emit helper that never throws or crashes request handlers
const emitEvent = (event, data) => {
  try {
    if (io) {
      io.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit '${event}' because io is not initialized yet.`);
    }
  } catch (err) {
    console.error(`[Socket] Failed to emit '${event}':`, err.message);
  }
};

module.exports = { init, getIO, emitEvent };
