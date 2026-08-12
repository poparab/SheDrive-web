/**
 * admin-auth.js — SheDrive admin portal session handling
 * Mirrors shared/scripts/auth.js but keeps its own storage key so an admin
 * session never collides with a rider or driver session in the same browser.
 *
 * MOCKUP BEHAVIOUR: every internal screen is openable directly. A designer or
 * reviewer following a deep link from the screen index or an ADO story must land
 * on that screen, not get bounced to a sign-in form. So when no session exists
 * `requireAdmin()` quietly provisions a demo one and lets the page render.
 *
 * The real guard from #1656 Scenario 6 (unauthenticated access to a protected
 * URL redirects to sign-in) is still demonstrable — add `?auth=strict` to any
 * screen URL and it behaves as the production portal would. That keeps the
 * acceptance criterion reviewable instead of silently deleted.
 */

import { storage } from '../../shared/scripts/storage.js';

export const ADMIN_SESSION_KEY = 'shedrive.adminSession';
const LOGIN_URL = './index.html';

/**
 * The demo identity used when a screen is opened cold. Matches the seed's
 * CURRENT_ADMIN so audit entries and "you" markers stay consistent.
 * Exported so the sign-in screen's ?step= deep links can stand in an admin
 * for steps that are normally reached only after entering credentials.
 */
export const DEMO_ADMIN_EMAIL = 'ops.lead@shedrive.app';

/** True when the URL asks for production guard behaviour. */
function strictAuth() {
  try {
    return new URLSearchParams(window.location.search).get('auth') === 'strict';
  } catch {
    return false;
  }
}

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

  isStrictAuth: strictAuth,

  /**
   * Allow the page to render. Returns false only in strict mode with no
   * session, in which case the browser has been sent to the login screen.
   * @returns {boolean} true when the page may render
   */
  requireAdmin() {
    if (this.getSession()) return true;

    // #1656 Scenario 6, on demand.
    if (strictAuth()) {
      window.location.replace(LOGIN_URL);
      return false;
    }

    // Open-access mockup: provision a demo session so the screen renders.
    this.login(DEMO_ADMIN_EMAIL);
    return true;
  },

  /**
   * Send an already-authenticated admin on to the dashboard.
   * Only applies in strict mode: because internal screens auto-provision a
   * session, an unconditional redirect here would make the sign-in screen
   * unreachable after visiting any other screen — and it is itself a design
   * screen that has to stay reviewable.
   */
  redirectIfSignedIn(target = './dashboard.html') {
    if (!strictAuth()) return false;
    if (!this.getSession()) return false;
    window.location.replace(target);
    return true;
  },
};
