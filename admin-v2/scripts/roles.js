/**
 * roles.js — the five admin roles and the access matrix (#6210, #6211, #6212)
 *
 * Every admin account holds exactly one role. The role decides which screens
 * the sidebar shows, which screens open, which action buttons are rendered,
 * and which personal data a screen shows. The mock API checks the same matrix
 * (`can()`) before it changes anything, so an action sent around the screen is
 * refused (#6210 Scenario 4).
 *
 * The matrix lives in docs/backlog/admin-stories.md under #6210; keep the two
 * in step. "View" screens get no action buttons at all — not disabled ones.
 *
 * DEMO: `?as=<role>` (or `?as=<email>`) on any screen signs the browser in as
 * that role's demo person; the top bar has the same switch. With no chosen
 * role the session is automatic: each screen opens as the role that shows it
 * best (`demoRoleFor`), so every story link renders.
 */

import { adminAuth } from './admin-auth.js';

export const ROLES = ['admin_it', 'ops_officer', 'ops_lead', 'fin_officer', 'fin_lead'];

const OPS = ['ops_officer', 'ops_lead'];
const FIN = ['fin_officer', 'fin_lead'];
const ALL = ROLES;

/** The person each role demos as (seed.js). Hala and Nour are both Financial leads. */
export const DEMO_PEOPLE = {
  admin_it: 'it.admin@shedrive.app',
  ops_officer: 'sara.ali@shedrive.app',
  ops_lead: 'ops.lead@shedrive.app',
  fin_officer: 'mona.adel@shedrive.app',
  fin_lead: 'hala.mahmoud@shedrive.app',
};

/** Screen (ad-shell `active` key) → roles that can open it. */
export const SCREEN_ROLES = {
  'admin-users': ['admin_it'],
  'audit-log': ['admin_it', 'ops_lead', 'fin_lead'],
  dashboard: [...OPS, ...FIN],
  trips: [...OPS, ...FIN],
  sos: OPS,
  safety: OPS,
  'driver-applications': OPS,
  drivers: [...OPS, ...FIN],
  riders: [...OPS, ...FIN],
  approvals: FIN,
  balances: ['ops_lead', ...FIN],
  payouts: FIN,
  'settlement-imports': FIN,
  'rider-balances': ['ops_lead', ...FIN],
  'pricing-zones': [...OPS, ...FIN],
  'pricing-policies': [...OPS, ...FIN],
  reports: ['ops_lead', ...FIN],
  reconciliation: ['ops_lead', ...FIN],
  'admin-profile': ALL,
};

/** Action / data capability → roles that have it. */
export const CAPABILITIES = {
  // Account & security
  'admins.manage': ['admin_it'],
  // Operations
  'map.live': OPS,
  'applications.decide': OPS,
  'drivers.suspend': ['ops_lead'],
  'riders.suspend': ['ops_lead'],
  // Trip list and detail are View for every role; the Operations lead also
  // cancels or reassigns a trip still in progress (#6210 matrix, 2026-10-29).
  'trips.intervene': ['ops_lead'],
  'safety.handle': OPS,
  'safety.actAgainst': ['ops_lead'],
  'sos.act': OPS,
  // Pricing & settings
  'zones.edit': ['ops_lead'],
  'dispatch.edit': ['ops_lead'],
  'hours.edit': ['ops_lead'],
  // Rate card, commission, cancellation policy, balance limit — a lead requests them (#6212).
  'pricing.request': ['fin_lead'],
  // Finance
  'finance.request': FIN,
  'finance.approve': ['fin_lead'],
  // Personal data (#6210)
  'driver.nationalId': OPS,
  'driver.payoutMethod': FIN,
};

/** Audit log scope (#6210): which entries each role may read. */
export const AUDIT_SCOPE = {
  admin_it: 'all',
  ops_lead: 'operations',
  fin_lead: 'finance',
};

/** Where each role lands after sign-in and from the no-access page. */
export function startPage(role = currentRole()) {
  return role === 'admin_it' ? 'admin-users.html' : 'dashboard.html';
}

export function isRole(value) {
  return ROLES.includes(value);
}

/** The signed-in admin's role, or null (an account with no role yet, #6211). */
export function currentRole() {
  const role = adminAuth.getSession()?.role;
  return isRole(role) ? role : null;
}

export function canOpen(screen, role = currentRole()) {
  if (!screen) return true;
  const allowed = SCREEN_ROLES[screen];
  if (!allowed) return true;
  return Boolean(role) && allowed.includes(role);
}

export function can(capability, role = currentRole()) {
  const allowed = CAPABILITIES[capability];
  return Boolean(role && allowed && allowed.includes(role));
}

export const isFinanceRole = (role = currentRole()) => FIN.includes(role);
export const isOperationsRole = (role = currentRole()) => OPS.includes(role);

/** The role a cold demo visit gets on a screen — the one that shows it best. */
const DEMO_PREFERENCE = {
  'admin-users': 'admin_it',
  'audit-log': 'admin_it',
  approvals: 'fin_lead',
  balances: 'fin_lead',
  payouts: 'fin_lead',
  'settlement-imports': 'fin_lead',
  'rider-balances': 'fin_lead',
  'pricing-zones': 'fin_lead',
  'pricing-policies': 'fin_lead',
  reports: 'fin_lead',
  reconciliation: 'fin_lead',
};

export function demoRoleFor(screen) {
  const preferred = DEMO_PREFERENCE[screen];
  if (preferred) return preferred;
  return canOpen(screen, 'ops_lead') ? 'ops_lead' : (SCREEN_ROLES[screen]?.[0] ?? 'ops_lead');
}

export const roleLabelKey = (role) => (isRole(role) ? `roles.${role}` : 'roles.none');
