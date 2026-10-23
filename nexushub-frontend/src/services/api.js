import axios from 'axios';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    // When running in production on Render (or any live host), always talk to the same origin's /api
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${origin}/api`;
    }
  }
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes('nexushub-project-4') && !envUrl.includes('nexushub-project.onrender.com')) {
    return envUrl;
  }
  return 'http://localhost:5000/api';
};

const baseURL = getApiBaseUrl();

const API = axios.create({
    baseURL,
});

// Automatically attach JWT token to every request if available
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Helper to construct complete URLs for static media / profile pictures
export const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    const origin = (API.defaults.baseURL || baseURL).replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default API;