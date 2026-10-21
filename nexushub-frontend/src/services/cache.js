/**
 * Session Cache (Stale-While-Revalidate)
 * Stores in-memory session data so navigating between dashboard and other pages
 * is instant, active, and has 0 loading flicker.
 */
const sessionCache = new Map();

export const getCachedData = (key) => sessionCache.get(key) || null;

export const setCachedData = (key, data) => {
  sessionCache.set(key, data);
};

export const clearSessionCache = () => {
  sessionCache.clear();
};
