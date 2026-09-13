/**
 * auth.js — SheDrive mock authentication layer
 * Backed by localStorage. Replace with real API calls when backend is ready.
 * Session shape: { role: 'rider'|'driver', phone: string, loginAt: number }
 *
 * MOCKUP BEHAVIOUR: every screen is openable directly. A designer or reviewer
 * following a deep link from an ADO design story must land on that screen, not
 * be bounced to a login form — so when no session exists `requireAuth()` quietly
 * provisions a demo one and lets the page render. This mirrors what
 * `admin-v2/scripts/admin-auth.js` already does for the admin portal.
 *
 * The real guard is still demonstrable — add `?auth=strict` to any screen URL
 * and it behaves as production would, redirecting to login. That keeps the
 * acceptance criterion reviewable instead of silently deleted.
 */

import { storage } from './storage.js';
import { STORAGE_KEYS } from './config.js';

/** Demo identities used when a screen is opened cold, one per app. */
const DEMO_SESSIONS = {
  rider: { role: 'rider', phone: '01012345678' },
  driver: { role: 'driver', phone: '01098765432' },
};

/** True when the URL asks for production guard behaviour. */
function strictAuth() {
  try {
    return new URLSearchParams(window.location.search).get('auth') === 'strict';
  } catch {
    return false;
  }
}

/**
 * Which app the current page belongs to, taken from its path. A driver screen
 * must not be provisioned a rider session — the two apps read `role` to decide
 * what to render and where to send the user on logout.
 */
function appRole() {
  try {
    return window.location.pathname.includes('/driver/') ? 'driver' : 'rider';
  } catch {
    return 'rider';
  }
}

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
   * Guard for authenticated screens. Call at the top of a page script before
   * any other logic.
   *
   * With no session it provisions a demo one so the screen renders — see the
   * mockup note at the top of this file. Pass `?auth=strict` in the URL to get
   * the production behaviour and be redirected to login instead.
   *
   * @returns {boolean} true when the page may render.
   */
  requireAuth() {
    if (this.isLoggedIn()) return true;

    if (strictAuth()) {
      window.location.replace('./index.html');
      return false;
    }

    const demo = DEMO_SESSIONS[appRole()];
    this.login(demo.role, demo.phone);
    return true;
  },
};
