import { io } from 'socket.io-client';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  return import.meta.env.PROD
    ? 'https://nexushub-project-4.onrender.com'
    : 'http://localhost:5000';
};

const SOCKET_URL = getBaseUrl();

// Single shared socket instance for the whole app
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 10000,
  timeout: 15000,
});

socket.on('connect', () => {
  console.log('[Socket] Connected successfully to', SOCKET_URL, 'ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.warn('[Socket] Disconnected:', reason);
});

export default socket;
