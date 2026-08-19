/**
 * nav.js — SheDrive admin portal navigation manifest (v2 design)
 * The single source of truth for the sidebar. `key` is what a screen passes to
 * <ad-shell active="...">; `icon` is a file name inside vendor/icons/, taken
 * from the delivered design kit's sidebar; `labelKey` is an i18n key from
 * i18n/core.js, so the sidebar reads in whichever language is active.
 */

export const NAV_SECTIONS = [
  {
    labelKey: 'nav.operations',
    items: [
      { key: 'dashboard', labelKey: 'nav.dashboard', href: 'dashboard.html', icon: 'Dashboard-2.svg' },
      { key: 'trips', labelKey: 'nav.trips', href: 'trips.html', icon: 'trips.svg' },
      { key: 'safety', labelKey: 'nav.safety', href: 'safety-reports.html', icon: 'shield.svg' },
    ],
  },
  {
    labelKey: 'nav.people',
    items: [
      {
        key: 'driver-applications',
        labelKey: 'nav.driverApplications',
        href: 'driver-applications.html',
        icon: 'applications.svg',
      },
      { key: 'drivers', labelKey: 'nav.drivers', href: 'drivers.html', icon: 'steering-wheel.svg' },
      { key: 'riders', labelKey: 'nav.riders', href: 'riders.html', icon: 'user-star.svg' },
    ],
  },
  {
    labelKey: 'nav.money',
    items: [
      {
        key: 'pricing-zones',
        labelKey: 'nav.pricingZones',
        href: 'pricing-zones.html',
        icon: 'prices.svg',
      },
      {
        key: 'pricing-policies',
        labelKey: 'nav.pricingPolicies',
        href: 'pricing-policies.html',
        icon: 'policies.svg',
      },
      { key: 'reports', labelKey: 'nav.reports', href: 'reports.html', icon: 'reports.svg' },
      {
        key: 'reconciliation',
        labelKey: 'nav.reconciliation',
        href: 'reconciliation.html',
        icon: 'handshake.svg',
      },
    ],
  },
  {
    labelKey: 'nav.administration',
    items: [
      { key: 'audit-log', labelKey: 'nav.auditLog', href: 'audit-log.html', icon: 'file-checked.svg' },
      { key: 'admin-users', labelKey: 'nav.adminUsers', href: 'admin-users.html', icon: 'users.svg' },
    ],
  },
];

/** Flat lookup of every nav destination by key. */
export const NAV_INDEX = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items).map((item) => [item.key, item]),
);
