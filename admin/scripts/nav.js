/**
 * nav.js — SheDrive admin portal navigation manifest
 * The single source of truth for the sidebar. Complete from Wave 0 so no screen
 * track ever needs to edit this file. `key` is what a screen passes to
 * <ad-shell active="...">.
 */

export const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: '▤' },
      { key: 'trips', label: 'Trips', href: 'trips.html', icon: '⇄' },
      { key: 'safety', label: 'Safety reports', href: 'safety-reports.html', icon: '⚑' },
    ],
  },
  {
    label: 'People',
    items: [
      {
        key: 'driver-applications',
        label: 'Driver applications',
        href: 'driver-applications.html',
        icon: '⊕',
      },
      { key: 'drivers', label: 'Drivers', href: 'drivers.html', icon: '⛟' },
      { key: 'riders', label: 'Riders', href: 'riders.html', icon: '☺' },
    ],
  },
  {
    label: 'Money & config',
    items: [
      { key: 'pricing-zones', label: 'Pricing & zones', href: 'pricing-zones.html', icon: '◎' },
      { key: 'pricing-policies', label: 'Global policies', href: 'pricing-policies.html', icon: '%' },
      { key: 'reports', label: 'Reports', href: 'reports.html', icon: '∑' },
      { key: 'reconciliation', label: 'Reconciliation', href: 'reconciliation.html', icon: '⇌' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'audit-log', label: 'Audit log', href: 'audit-log.html', icon: '☰' },
      { key: 'admin-users', label: 'Admin users', href: 'admin-users.html', icon: '⚿' },
    ],
  },
];

/** Flat lookup of every nav destination by key. */
export const NAV_INDEX = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items).map((item) => [item.key, item]),
);
