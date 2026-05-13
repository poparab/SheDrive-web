/**
 * auth.js — SheDrive mock authentication layer
 * Backed by localStorage. Replace with real API calls when backend is ready.
 * Session shape: { role: 'rider'|'driver', phone: string, loginAt: number }
 */

import { storage } from './storage.js';
import { STORAGE_KEYS } from './config.js';

export const auth = {
  /**
   * Persist a session for the given role.
   * @param {'rider'|'driver'} role
   * @param {string} phone
   */
  login(role, phone = '') {
    const session = { role, phone, loginAt: Date.now() };
    storage.set(STORAGE_KEYS.SESSION, session);
    return session;
  },

  /** Remove the current session */
  logout() {
    storage.remove(STORAGE_KEYS.SESSION);
  },

  /**
   * Return the current session object, or null if not logged in.
   * @returns {{ role: string, phone: string, loginAt: number } | null}
   */
  getSession() {
    return storage.get(STORAGE_KEYS.SESSION);
  },

  /** Return true if a valid session exists */
  isLoggedIn() {
    return this.getSession() !== null;
  },

  /**
   * Guard for home pages. Redirects to login if no session.
   * Call at the top of home.js before any other logic.
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.replace('./index.html');
    }
  },
};
