// socket.js - Centralized Socket.io instance
// Import this in any route file to emit real-time events

let io;

const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        // Dynamically echo requesting origin (mobile/web) for CORS compliance with credentials
        callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Allow user clients to join their dedicated private room for targeted live updates
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`[Socket] Client ${socket.id} joined room user_${userId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

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

const emitToUser = (userId, event, data) => {
  try {
    if (io && userId) {
      io.to(`user_${userId}`).emit(event, data);
    }
  } catch (err) {
    console.error(`[Socket] Failed to emit '${event}' to user_${userId}:`, err.message);
  }
};

const getIO = () => {
  if (!io) {
    console.warn('[Socket] getIO() accessed before initialization. Using safe fallback.');
    return {
      emit: (event, data) => emitEvent(event, data),
      to: (room) => ({
        emit: (event, data) => {
          if (io) io.to(room).emit(event, data);
        },
      }),
    };
  }
  return io;
};

module.exports = { init, getIO, emitEvent, emitToUser };

