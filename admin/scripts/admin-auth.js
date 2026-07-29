/**
 * admin-auth.js — SheDrive admin portal session guard
 * Mirrors shared/scripts/auth.js but keeps its own storage key so an admin
 * session never collides with a rider or driver session in the same browser.
 */

import { storage } from '../../shared/scripts/storage.js';

export const ADMIN_SESSION_KEY = 'shedrive.adminSession';
const LOGIN_URL = './index.html';

export const adminAuth = {
  /** @returns {{email: string, role: string, loginAt: number} | null} */
  getSession() {
    const session = storage.get(ADMIN_SESSION_KEY);
    return session && session.email ? session : null;
  },

  login(email) {
    const session = { email, role: 'super_admin', loginAt: Date.now() };
    storage.set(ADMIN_SESSION_KEY, session);
    return session;
  },

  logout() {
    storage.remove(ADMIN_SESSION_KEY);
  },

  /**
   * Redirect to the login screen when there is no session (#1656 Scenario 6).
   * @returns {boolean} true when a session exists and the page may render
   */
  requireAdmin() {
    if (this.getSession()) return true;
    window.location.replace(LOGIN_URL);
    return false;
  },

  /** Send an already-authenticated admin on to the dashboard. */
  redirectIfSignedIn(target = './dashboard.html') {
    if (!this.getSession()) return false;
    window.location.replace(target);
    return true;
  },
};
