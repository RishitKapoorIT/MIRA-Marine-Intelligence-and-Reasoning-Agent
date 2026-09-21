/**
 * Safe LocalStorage and SessionStorage utility with JSON fault tolerance,
 * quota handling, and input boundary validation.
 */

export const safeStorage = {
  getItem: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn(`[safeStorage] Error reading key "${key}":`, e);
      return defaultValue;
    }
  },

  setItem: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[safeStorage] Error saving key "${key}":`, e);
      return false;
    }
  },

  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[safeStorage] Error removing key "${key}":`, e);
      return false;
    }
  }
};

/**
 * Validates and clamps coordinates within valid geographic boundaries.
 */
export function sanitizeCoordinates(lat, lon) {
  const safeLat = Math.max(-90, Math.min(90, Number(lat) || 0));
  const safeLon = Math.max(-180, Math.min(180, Number(lon) || 0));
  return { lat: Number(safeLat.toFixed(6)), lon: Number(safeLon.toFixed(6)) };
}

/**
 * Escapes unsafe characters in strings before rendering or logging to prevent XSS.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
