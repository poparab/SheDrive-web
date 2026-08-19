/**
 * admin-profile.js — SheDrive admin portal "My profile"
 *
 * The signed-in admin's own account page. The delivered design kit's topbar
 * user menu links to admin-profile.html but the kit never ships that page, so
 * this screen fills the gap.
 *
 * No story covers self-service profile editing and the mock API exposes no
 * mutation for the current admin, so the screen is deliberately read-only:
 * it reports what the session and the seeded admin record actually say, and
 * hands the two real actions off to the enrolment and new-password screens.
 *
 * Data sources (all read-only):
 *   • adminAuth.getSession()   — email, role, session start
 *   • ADMINS / CURRENT_ADMIN   — status, createdAt, lastLoginAt, twoFactorEnrolled
 *   • mockAuth.recoveryCodes() — how many one-time codes enrolment issues
 */

import { adminAuth } from './admin-auth.js';
import { mockAuth } from './mock-api.js';
import { ADMINS, CURRENT_ADMIN } from './seed.js';
import { formatDateTime, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');

const session = adminAuth.getSession();

/**
 * The seeded record for whoever is signed in. Falls back to the mockup's
 * CURRENT_ADMIN when the session email is not one of the seeded accounts —
 * which only happens if a session was hand-edited in devtools.
 */
const record =
  ADMINS.find(
    (admin) => admin.email.toLowerCase() === String(session?.email ?? '').toLowerCase(),
  ) ?? CURRENT_ADMIN;

// ── Small presentational helpers ──────────────────────

/** The kit's status lamp, as used across the portal's grids. */
function lamp(tone, label) {
  return `<div class="status-${tone}-lamp"><div class="lamp"></div>${label}</div>`;
}

function setText(id, value) {
  const node = qs(`#${id}`);
  if (node) node.textContent = value;
}

function setHtml(id, value) {
  const node = qs(`#${id}`);
  if (node) node.innerHTML = value;
}

// ── Account ───────────────────────────────────────────

setText('account-email', record.email);
setText('account-role', humanize(session?.role ?? 'super_admin'));

setHtml(
  'account-status',
  record.status === 'active' ? lamp('active', t('status.active')) : lamp('disabled', t('status.disabled')),
);

setText('account-created', formatDateTime(record.createdAt));
setText(
  'account-last-login',
  record.lastLoginAt ? formatDateTime(record.lastLoginAt) : t('profile.neverSignedIn'),
);

setText(
  'account-hint',
  record === CURRENT_ADMIN && record.email !== session?.email
    ? t('profile.hintDefaultAccount')
    : t('profile.hintManagedElsewhere'),
);

// ── Security ──────────────────────────────────────────

setHtml(
  'security-2fa',
  record.twoFactorEnrolled ? lamp('active', t('profile.enabled')) : lamp('warning', t('profile.notEnrolled')),
);

setText(
  'security-authenticator',
  record.twoFactorEnrolled ? t('profile.authenticatorRegistered') : t('profile.noAuthenticator'),
);

// The mock issues a fixed set of one-time codes at enrolment and does not track
// which have been spent, so the screen reports only what it can honestly know.
const recoveryCodes = mockAuth.recoveryCodes();
setText(
  'security-recovery',
  record.twoFactorEnrolled
    ? `${recoveryCodes.length} issued at enrolment`
    : t('profile.codesAfterEnrol'),
);

// ── Session ───────────────────────────────────────────

setText('session-email', session?.email ?? t('shell.signedOut'));
setText(
  'session-started',
  session?.loginAt ? formatDateTime(session.loginAt) : t('profile.noActiveSession'),
);

qs('#session-signout')?.addEventListener('click', () => {
  shell?.showToast?.(t('profile.signingOut'), 'info');
  adminAuth.logout();
  window.location.href = './index.html';
});
