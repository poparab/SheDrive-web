/**
 * storage.js — SheDrive safe localStorage wrapper
 * All access is wrapped in try/catch to handle Safari private mode,
 * which throws SecurityError on localStorage reads/writes.
 */

export const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },

  has(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  },
};
