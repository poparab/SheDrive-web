/**
 * screens.js — SheDrive admin mockup screen index
 * The designer's contact sheet: every screen, the ADO stories it implements,
 * its build status, and direct links to each forced state.
 *
 * The manifest below is complete for all 18 screens from the foundation wave, so
 * no screen track ever has to edit this file. Screens whose track has not landed
 * yet are marked "planned" and their link 404s until it does.
 */

import { injectAdminStyles } from '../components/ad-styles.js';
import { qs } from '../../shared/scripts/utils.js';

injectAdminStyles({ screenStyles: 'styles/screens.css' });

const ADO = (id) =>
  `https://dev.azure.com/AR-corp/SheDrive/_backlogs/backlog/SheDrive%20Team/Epics?workitem=${id}`;

const LIST_STATES = ['empty', 'loading', 'error', 'long'];

export const SCREENS = [
  {
    group: 'Access',
    title: 'Sign in, 2FA & password reset',
    file: 'index.html',
    status: 'built',
    track: 'Foundation',
    stories: [
      [1656, 'Admin portal shell and login screen'],
      [1806, 'Login protected by two-factor authentication'],
      [1822, 'Password reset and first-login mandatory change'],
    ],
    states: [],
    variantsLabel: 'Steps',
    variants: [
      { label: 'credentials', query: '' },
      { label: 'reset request', query: '?step=forgot' },
      { label: 'two-factor', query: '?step=2fa' },
      { label: 'enrolment', query: '?step=enrol' },
      { label: 'new password', query: '?step=change' },
    ],
    notes:
      'Five steps in one screen: credentials, 2FA, first-time enrolment, forced password change, reset request. Each step has a direct link below. The QR code is decorative — labelled as not scannable. Reaching the new-password step by actually signing in requires night.desk@shedrive.app (the one seeded admin who has never logged in); every other account goes straight to the dashboard.',
  },
  {
    group: 'Operations',
    title: 'Operations dashboard',
    file: 'dashboard.html',
    status: 'built',
    track: 'Foundation',
    stories: [
      [1669, 'Live summary dashboard'],
      [1823, 'Live operations map of active trips and online drivers'],
      [1824, 'Operations map clusters markers at low zoom'],
      [1825, 'Operations map marker shows detail and links to trip detail'],
      [1826, 'Operations map layer filter'],
    ],
    states: ['empty', 'error'],
    notes:
      'Metrics refresh every 30 s, map every 5 s; the map keeps your viewport across refreshes. Zoom out to see clustering. ?state=empty shows the idle-day zero state. No charts by design — #1669 excludes them.',
  },
  {
    group: 'Operations',
    title: 'Trip list',
    file: 'trips.html',
    status: 'built',
    track: 'Built',
    stories: [[1670, 'Admin views trip list']],
    states: LIST_STATES,
    notes: 'Status filter maps onto the trip state machine: Searching / Active / Completed / Cancelled / Expired. Cancelled is a fifth option #1670 does not yet carry, needed once an admin can cancel a trip. CSV export respects the active filters.',
  },
  {
    group: 'Operations',
    title: 'Trip detail & completed trip',
    file: 'trip-detail.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1671, 'Trip detail with state history'],
      [1672, 'Completed trip with fare and rating'],
    ],
    states: [],
    notes:
      'Completed trips add the recorded route, fare breakdown and rating. An in-progress trip exposes Cancel (#1808) and Reassign (#1809) — both stories are still unwritten, so those flows are a PROPOSAL and the screen carries a notice saying so. Cancelling produces a distinct Cancelled status; reassigning keeps the trip live and hands it to another online driver. Both need BA sign-off.',
  },
  {
    group: 'Operations',
    title: 'Gender-mismatch report queue',
    file: 'safety-reports.html',
    status: 'built',
    track: 'Built',
    stories: [[1810, 'Super admin reviews the gender-mismatch report queue']],
    states: LIST_STATES,
    notes:
      'Replaces the "SOS queue" in the old wireframe list — SOS is deferred to a later phase; women-only enforcement triage is what is in scope.',
  },
  {
    group: 'Operations',
    title: 'Safety report detail & resolution',
    file: 'safety-report.html',
    status: 'built',
    track: 'Built',
    stories: [[1811, 'Super admin actions a gender-mismatch report']],
    states: [],
    notes: 'Suspend or dismiss. The suspension note is optional — the report itself is the recorded reason.',
  },
  {
    group: 'People',
    title: 'Driver applications queue',
    file: 'driver-applications.html',
    status: 'built',
    track: 'Built',
    stories: [[1657, 'Admin views pending applications queue']],
    states: LIST_STATES,
    notes: 'Lists EVERY application — pending, approved and rejected — with an Application outcome column and an outcome filter, plus CSV export. #1657 specifies a pending-only queue, so this is a scope change; the badge still counts only what is awaiting review. Sorted oldest-first, because the pending ones are a work queue.',
  },
  {
    group: 'People',
    title: 'Driver application detail',
    file: 'driver-application.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1658, 'Admin views full driver application'],
      [1659, 'Admin approves driver application'],
      [1660, 'Admin rejects driver application with reason'],
    ],
    states: [],
    notes:
      'All four documents inline with a lightbox. Document images are obvious placeholders — never real ID scans.',
  },
  {
    group: 'People',
    title: 'Driver list',
    file: 'drivers.html',
    status: 'built',
    track: 'Built',
    stories: [[1665, 'Admin views driver list across all statuses']],
    states: LIST_STATES,
    notes: 'All statuses including Pending suspension. CSV export respects the active filters.',
  },
  {
    group: 'People',
    title: 'Driver profile',
    file: 'driver-profile.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1666, 'Admin views driver profile'],
      [1742, 'Operations admin suspends a driver account'],
      [1743, 'Operations admin reinstates a suspended driver account'],
    ],
    states: [],
    notes:
      'Suspending a driver who is mid-trip produces Pending suspension, not immediate suspension. Reinstating now requires its own recorded reason (a scope change vs #1743) and is written to the audit log. Approve/reject deliberately live on the queue screens, not here.',
  },
  {
    group: 'People',
    title: 'Rider list',
    file: 'riders.html',
    status: 'built',
    track: 'Built',
    stories: [[1661, 'Admin views rider list']],
    states: LIST_STATES,
    notes: 'Status filter is All / Active / Suspended.',
  },
  {
    group: 'People',
    title: 'Rider profile',
    file: 'rider-profile.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1662, 'Admin views rider profile'],
      [1740, 'Operations admin suspends a rider account'],
      [1741, 'Operations admin reinstates a suspended rider account'],
    ],
    states: [],
    notes:
      'Three account states: Active, Pending review (set automatically by a gender-mismatch report), Suspended. Pending review links to the related report.',
  },
  {
    group: 'Money & config',
    title: 'Service zones & rate cards',
    file: 'pricing-zones.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1831, 'Super admin views the service-zone list and map'],
      [1756, 'Super admin creates a service zone'],
      [1830, 'Super admin edits and deletes service zones'],
      [1757, 'Super admin configures zone rate card'],
    ],
    states: LIST_STATES,
    notes:
      'Zone status is derived from the rate card and never toggled by hand. Two zones ship with no rate card so the Inactive / "trips will be blocked" warning is visible.',
  },
  {
    group: 'Money & config',
    title: 'Global pricing policies',
    file: 'pricing-policies.html',
    status: 'built',
    track: 'Built',
    stories: [[1759, 'Super admin configures global pricing policies']],
    states: [],
    notes: 'Cancellation policy plus platform commission (must be >0% and ≤50%).',
  },
  {
    group: 'Money & config',
    title: 'Revenue & commission report',
    file: 'reports.html',
    status: 'built',
    track: 'Built',
    stories: [[1832, 'Super admin views revenue & commission summary report']],
    states: ['empty', 'loading', 'error'],
    notes: 'Totals reconcile: gross fares = commission + net driver earnings. CSV export included.',
  },
  {
    group: 'Money & config',
    title: 'Per-driver earnings & settlement',
    file: 'reconciliation.html',
    status: 'built',
    track: 'Built',
    stories: [[1833, 'Super admin views per-driver earnings & settlement report']],
    states: ['empty', 'loading', 'error'],
    notes:
      'The "Record settlement" action is a visible stub — cash reconciliation (#1813) has no written story yet, so nothing was invented for it.',
  },
  {
    group: 'Administration',
    title: 'Admin activity audit log',
    file: 'audit-log.html',
    status: 'built',
    track: 'Foundation',
    stories: [[1816, 'Super admin views the admin activity audit log']],
    states: LIST_STATES,
    notes:
      'Read-only. Also the reference implementation of the filter-bar + data-table pattern every other grid follows — worth reviewing first.',
  },
  {
    group: 'Administration',
    title: 'Admin user accounts',
    file: 'admin-users.html',
    status: 'built',
    track: 'Built',
    stories: [
      [1820, 'Super admin views the admin user accounts list'],
      [1807, 'Super admin adds an admin user account'],
      [1821, 'Super admin enables and disables admin user accounts'],
    ],
    states: LIST_STATES,
    notes: 'Not in the original 11-screen wireframe list, but three stories require it.',
  },
];

// ── Rendering ─────────────────────────────────────────

function renderCard(screen) {
  const card = document.createElement('article');
  card.className = 'screen-card';
  if (screen.status === 'planned') card.classList.add('screen-card--planned');

  const head = document.createElement('div');
  head.className = 'screen-card__head';

  const heading = document.createElement('h3');
  heading.className = 'screen-card__title';
  if (screen.status === 'built') {
    const link = document.createElement('a');
    link.href = screen.file;
    link.textContent = screen.title;
    heading.appendChild(link);
  } else {
    heading.textContent = screen.title;
  }

  const status = document.createElement('span');
  status.className = `badge badge--${screen.status === 'built' ? 'success' : 'warning'}`;
  status.textContent = screen.status === 'built' ? 'Built' : 'Planned';

  head.append(heading, status);

  const file = document.createElement('p');
  file.className = 'screen-card__file';
  file.textContent = `${screen.file} · ${screen.track}`;

  const stories = document.createElement('ul');
  stories.className = 'screen-card__stories';
  screen.stories.forEach(([id, title]) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = ADO(id);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `#${id}`;
    li.append(link, document.createTextNode(` ${title}`));
    stories.appendChild(li);
  });

  const notes = document.createElement('p');
  notes.className = 'screen-card__notes';
  notes.textContent = screen.notes;

  card.append(head, file, stories, notes);

  if (screen.states.length) {
    const states = document.createElement('div');
    states.className = 'screen-card__states';

    const label = document.createElement('span');
    label.className = 'screen-card__states-label';
    label.textContent = 'States:';
    states.appendChild(label);

    screen.states.forEach((state) => {
      if (screen.status === 'built') {
        const link = document.createElement('a');
        link.className = 'chip';
        link.href = `${screen.file}?state=${state}`;
        link.textContent = state;
        states.appendChild(link);
      } else {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = state;
        states.appendChild(chip);
      }
    });

    card.appendChild(states);
  }

  // Screens whose sub-views are reached by a query param other than ?state=
  // (currently only the sign-in screen's steps) list them the same way.
  if (screen.variants?.length) {
    const variants = document.createElement('div');
    variants.className = 'screen-card__states';

    const label = document.createElement('span');
    label.className = 'screen-card__states-label';
    label.textContent = `${screen.variantsLabel ?? 'Views'}:`;
    variants.appendChild(label);

    screen.variants.forEach((variant) => {
      const link = document.createElement('a');
      link.className = 'chip';
      link.href = `${screen.file}${variant.query}`;
      link.textContent = variant.label;
      variants.appendChild(link);
    });

    card.appendChild(variants);
  }

  return card;
}

const host = qs('#screen-groups');
const groups = [...new Set(SCREENS.map((s) => s.group))];

groups.forEach((group) => {
  const section = document.createElement('section');
  section.className = 'screen-group';

  const heading = document.createElement('h2');
  heading.className = 'screen-group__title';
  heading.textContent = group;

  const grid = document.createElement('div');
  grid.className = 'screen-grid';
  SCREENS.filter((s) => s.group === group).forEach((screen) => {
    grid.appendChild(renderCard(screen));
  });

  section.append(heading, grid);
  host.appendChild(section);
});

const built = SCREENS.filter((s) => s.status === 'built').length;
qs('#screen-progress').textContent =
  `${built} of ${SCREENS.length} screens built · ${SCREENS.length - built} planned`;
