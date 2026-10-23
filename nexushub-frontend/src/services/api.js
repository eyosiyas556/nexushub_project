import axios from 'axios';

const getApiBaseUrl = () => {
  // If running in the browser
  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    // If the frontend is being served directly by the Express backend
    if (hostname.includes('nexushub-project-4.onrender.com') || hostname.includes('nexushub-project.onrender.com')) {
      return `${origin}/api`;
    }
  }

  // If VITE_API_URL is configured and is an absolute URL
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl;
  }

  // Default live production backend API
  return 'https://nexushub-project-4.onrender.com/api';
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
