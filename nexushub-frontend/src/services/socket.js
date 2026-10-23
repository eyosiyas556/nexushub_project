import { io } from 'socket.io-client';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  // Guard against outdated URL without -4
  if (envUrl && !envUrl.includes('nexushub-project.onrender.com')) {
    return envUrl.replace(/\/api\/?$/, '');
  }

  // If running in browser and served directly by the backend on Render
  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    if (hostname.includes('onrender.com') && !hostname.includes('nexushub-project.')) {
      return origin;
    }
  }

  // Production backend fallback
  return import.meta.env.PROD
    ? 'https://nexushub-project-4.onrender.com'
    : 'http://localhost:5000';
};

const SOCKET_URL = getBaseUrl();

// Helper to register the current user with their private socket room
export const joinUserRoom = (userId) => {
  try {
    const targetId = userId || (() => {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored)?.id : null;
    })();
    if (targetId && socket && socket.connected) {
      socket.emit('join_user', targetId);
    }
  } catch (err) {
    console.warn('[Socket] Failed to join user room:', err);
  }
};

// Single shared resilient socket instance for the entire application
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

socket.on('connect', () => {
  console.log('[Socket] Connected successfully to', SOCKET_URL, 'ID:', socket.id);
  joinUserRoom();
});

socket.on('reconnect', (attempt) => {
  console.log('[Socket] Reconnected after attempt', attempt);
  joinUserRoom();
});

socket.on('disconnect', (reason) => {
  console.warn('[Socket] Disconnected:', reason);
});

export default socket;
