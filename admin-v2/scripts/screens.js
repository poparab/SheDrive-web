/**
 * screens.js — SheDrive admin mockup screen index (v2 design)
 * The designer's contact sheet: every screen, the ADO stories it implements,
 * its build status, and direct links to each forced state.
 *
 * Rendered with the delivered design kit's card idiom
 * (`.standard-card-theme2.white-bg` + `.card-header > .card-title` + status
 * lamps), so the index looks like the portal it indexes.
 *
 * The manifest below is complete for every screen in admin-v2, so no screen
 * track ever has to edit this file. Screens whose track has not landed yet are
 * marked "planned" and are not linked.
 */

import { injectAdminStyles, iconUrl } from '../components/ad-styles.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  t,
  lang,
  LANGUAGES,
  setAdminLanguage,
  initAdminI18n,
  applyAdminTranslations,
} from './admin-i18n.js';

// Direction must be on <html> before the RTL stylesheet choice is made.
initAdminI18n();
injectAdminStyles({ screenStyles: 'styles/screens.css' });

const ADO = (id) =>
  `https://dev.azure.com/AR-corp/SheDrive/_backlogs/backlog/SheDrive%20Team/Epics?workitem=${id}`;

const LIST_STATES = [t('screens.state_empty'), t('screens.state_loading'), t('screens.state_error'), t('screens.state_long')];

export const SCREENS = [
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleSignIn'),
    file: 'index.html',
    icon: 'lock2.svg',
    status: 'built',
    track: t('screens.trackFoundation'),
    stories: [
      [1656, 'Admin portal shell and login screen'],
      [1806, 'Login protected by two-factor authentication'],
      [1822, 'Password reset and first-login mandatory change'],
    ],
    states: [],
    variantsLabel: t('screens.stepsLabel'),
    variants: [
      { label: t('screens.step_credentials'), query: '' },
      { label: t('screens.step_forgot'), query: '?step=forgot' },
      { label: t('screens.step_2fa'), query: '?step=2fa' },
      { label: t('screens.step_enrol'), query: '?step=enrol' },
      { label: t('screens.step_change'), query: '?step=change' },
    ],
    notes:
      t('screens.notesSignIn'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleTwoFactor'),
    file: '2fa.html',
    icon: 'shield.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1806, 'Login protected by two-factor authentication']],
    states: [],
    notes:
      t('screens.notesTwoFactor'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleEnrolment'),
    file: '2fa-setup.html',
    icon: 'lock.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1806, 'Login protected by two-factor authentication']],
    states: [],
    notes:
      t('screens.notesEnrolment'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleOtp'),
    file: 'otp.html',
    icon: 'mail.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1822, 'Password reset and first-login mandatory change']],
    states: [],
    notes:
      t('screens.notesOtp'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleRecovery'),
    file: 'recovery-code.html',
    icon: 'user-locked.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1806, 'Login protected by two-factor authentication']],
    states: [],
    notes:
      t('screens.notesRecovery'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleForgot'),
    file: 'password-forgot.html',
    icon: 'question-mark.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1822, 'Password reset and first-login mandatory change']],
    states: [],
    notes:
      t('screens.notesForgot'),
  },
  {
    group: t('screens.groupAccess'),
    title: t('screens.titleNewPassword'),
    file: 'password-new.html',
    icon: 'edit.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [[1822, 'Password reset and first-login mandatory change']],
    states: [],
    notes:
      t('screens.notesNewPassword'),
  },
  {
    group: t('nav.operations'),
    title: t('dashboard.title'),
    file: 'dashboard.html',
    icon: 'dashboard.svg',
    status: 'built',
    track: t('screens.trackFoundation'),
    stories: [
      [1669, 'Live summary dashboard'],
      [1823, 'Live operations map of active trips and online drivers'],
      [1824, 'Operations map clusters markers at low zoom'],
      [1825, 'Operations map marker shows detail and links to trip detail'],
      [1826, 'Operations map layer filter'],
    ],
    states: [t('screens.state_empty'), t('screens.state_error')],
    notes:
      t('screens.notesDashboard'),
  },
  {
    group: t('nav.operations'),
    title: t('screens.titleTrips'),
    file: 'trips.html',
    icon: 'trips.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1670, 'Admin views trip list']],
    states: LIST_STATES,
    notes:
      t('screens.notesTrips'),
  },
  {
    group: t('nav.operations'),
    title: t('screens.titleTripDetail'),
    file: 'trip-detail.html',
    icon: 'route.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1671, 'Trip detail with state history'],
      [1672, 'Completed trip with fare and rating'],
    ],
    states: [],
    notes:
      t('screens.notesTripDetail'),
  },
  {
    group: t('nav.operations'),
    title: t('screens.titleSafetyQueue'),
    file: 'safety-reports.html',
    icon: 'shield.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1810, 'Super admin reviews the gender-mismatch report queue']],
    states: LIST_STATES,
    notes:
      t('screens.notesSafetyQueue'),
  },
  {
    group: t('nav.operations'),
    title: t('screens.titleSafetyDetail'),
    file: 'safety-report.html',
    icon: 'safety.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1811, 'Super admin actions a gender-mismatch report']],
    states: [],
    notes:
      t('screens.notesSafetyDetail'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleApplications'),
    file: 'driver-applications.html',
    icon: 'applications.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1657, 'Admin views pending applications queue']],
    states: LIST_STATES,
    notes:
      t('screens.notesApplications'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleApplication'),
    file: 'driver-application.html',
    icon: 'review-list.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1658, 'Admin views full driver application'],
      [1659, 'Admin approves driver application'],
      [1660, 'Admin rejects driver application with reason'],
    ],
    states: [],
    notes:
      t('screens.notesApplication'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleDrivers'),
    file: 'drivers.html',
    icon: 'steering-wheel.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1665, 'Admin views driver list across all statuses']],
    states: LIST_STATES,
    notes: t('screens.notesDrivers'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleDriverProfile'),
    file: 'driver-profile.html',
    icon: 'profile-info.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1666, 'Admin views driver profile'],
      [1742, 'Operations admin suspends a driver account'],
      [1743, 'Operations admin reinstates a suspended driver account'],
    ],
    states: [],
    notes:
      t('screens.notesDriverProfile'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleRiders'),
    file: 'riders.html',
    icon: 'user-star.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1661, 'Admin views rider list']],
    states: LIST_STATES,
    notes: t('screens.notesRiders'),
  },
  {
    group: t('nav.people'),
    title: t('screens.titleRiderProfile'),
    file: 'rider-profile.html',
    icon: 'user-2.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1662, 'Admin views rider profile'],
      [1740, 'Operations admin suspends a rider account'],
      [1741, 'Operations admin reinstates a suspended rider account'],
    ],
    states: [],
    notes:
      t('screens.notesRiderProfile'),
  },
  {
    group: t('nav.money'),
    title: t('zones.title'),
    file: 'pricing-zones.html',
    icon: 'prices.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1831, 'Super admin views the service-zone list and map'],
      [1756, 'Super admin creates a service zone'],
      [1830, 'Super admin edits and deletes service zones'],
      [1757, 'Super admin configures zone rate card'],
    ],
    states: LIST_STATES,
    notes:
      t('screens.notesZones'),
  },
  {
    group: t('nav.money'),
    title: t('policies.title'),
    file: 'pricing-policies.html',
    icon: 'policies.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1759, 'Super admin configures global pricing policies']],
    states: [],
    notes: t('screens.notesPolicies'),
  },
  {
    group: t('nav.money'),
    title: t('screens.titleReports'),
    file: 'reports.html',
    icon: 'reports.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1832, 'Super admin views revenue & commission summary report']],
    states: [t('screens.state_empty'), t('screens.state_loading'), t('screens.state_error')],
    notes: t('screens.notesReports'),
  },
  {
    group: t('nav.money'),
    title: t('reconciliation.title'),
    file: 'reconciliation.html',
    icon: 'handshake.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [[1833, 'Super admin views per-driver earnings & settlement report']],
    states: [t('screens.state_empty'), t('screens.state_loading'), t('screens.state_error')],
    notes:
      t('screens.notesReconciliation'),
  },
  {
    group: t('nav.administration'),
    title: t('screens.titleAuditLog'),
    file: 'audit-log.html',
    icon: 'file-checked.svg',
    status: 'built',
    track: t('screens.trackFoundation'),
    stories: [[1816, 'Super admin views the admin activity audit log']],
    states: LIST_STATES,
    notes:
      t('screens.notesAuditLog'),
  },
  {
    group: t('nav.administration'),
    title: t('screens.titleAdminUsers'),
    file: 'admin-users.html',
    icon: 'users.svg',
    status: 'built',
    track: t('screens.statusBuilt'),
    stories: [
      [1820, 'Super admin views the admin user accounts list'],
      [1807, 'Super admin adds an admin user account'],
      [1821, 'Super admin enables and disables admin user accounts'],
    ],
    states: LIST_STATES,
    notes: t('screens.notesAdminUsers'),
  },
  {
    group: t('nav.administration'),
    title: t('profile.title'),
    file: 'admin-profile.html',
    icon: 'user.svg',
    status: 'built',
    track: t('screens.trackDesignKit'),
    stories: [
      [1806, 'Login protected by two-factor authentication'],
      [1822, 'Password reset and first-login mandatory change'],
    ],
    states: [],
    notes:
      t('screens.notesProfile'),
  },
];

// ── Rendering ─────────────────────────────────────────

function statusLamp(status) {
  const lamp = document.createElement('div');
  lamp.className = status === 'built' ? 'status-active-lamp' : 'status-warning-lamp';
  const dot = document.createElement('div');
  dot.className = 'lamp';
  lamp.append(dot, document.createTextNode(status === 'built' ? t('screens.statusBuilt') : t('screens.statusPlanned')));
  return lamp;
}

function chipRow(label, links, { linked = true } = {}) {
  const row = document.createElement('div');
  row.className = 'screen-card__states';

  const caption = document.createElement('span');
  caption.className = 'screen-card__states-label';
  caption.textContent = label;
  row.appendChild(caption);

  links.forEach(({ text, href }) => {
    if (linked) {
      const link = document.createElement('a');
      link.className = 'chip';
      link.href = href;
      link.textContent = text;
      row.appendChild(link);
    } else {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = text;
      row.appendChild(chip);
    }
  });

  return row;
}

function renderCard(screen) {
  const card = document.createElement('article');
  card.className = 'standard-card-theme2 white-bg screen-card';
  if (screen.status === 'planned') card.classList.add('screen-card--planned');

  // ── Kit card header: title + subtitle on the left, round icon on the right.
  const header = document.createElement('div');
  header.className = 'card-header screen-card__head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'card-title';

  const heading = document.createElement('h5');
  heading.className = 'screen-card__title';
  if (screen.status === 'built') {
    const link = document.createElement('a');
    link.href = screen.file;
    link.textContent = screen.title;
    heading.appendChild(link);
  } else {
    heading.textContent = screen.title;
  }

  const file = document.createElement('span');
  file.className = 'screen-card__file';
  file.textContent = `${screen.file} · ${screen.track}`;

  titleWrap.append(heading, file);

  const iconWrap = document.createElement('div');
  iconWrap.className = 'icon';
  const icon = document.createElement('img');
  icon.src = iconUrl(screen.icon);
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  iconWrap.appendChild(icon);

  header.append(titleWrap, iconWrap);

  // ── Kit card body.
  const body = document.createElement('div');
  body.className = 'card-body screen-card__body';

  body.appendChild(statusLamp(screen.status));

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
  body.appendChild(stories);

  const notes = document.createElement('p');
  notes.className = 'screen-card__notes';
  notes.textContent = screen.notes;
  body.appendChild(notes);

  if (screen.states.length) {
    body.appendChild(
      chipRow(
        t('screens.statesLabel'),
        screen.states.map((state) => ({ text: state, href: `${screen.file}?state=${state}` })),
        { linked: screen.status === 'built' },
      ),
    );
  }

  // Screens whose sub-views are reached by a query param other than ?state=
  // (currently only the sign-in screen's steps) list them the same way.
  if (screen.variants?.length) {
    body.appendChild(
      chipRow(
        `${screen.variantsLabel ?? t('screens.viewsLabel')}:`,
        screen.variants.map((variant) => ({
          text: variant.label,
          href: `${screen.file}${variant.query}`,
        })),
        { linked: screen.status === 'built' },
      ),
    );
  }

  card.append(header, body);
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
qs('#screen-progress').textContent = t('screens.progress', {
  built,
  total: SCREENS.length,
  planned: SCREENS.length - built,
});

// The index has no shell, so it renders its own language switch.
const langHost = qs('#screens-lang');
if (langHost) {
  LANGUAGES.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      option.code === lang() ? 'btn btn-primary btn--sm' : 'btn btn-primary-outline btn--sm';
    button.textContent = option.label;
    if (option.code === lang()) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => setAdminLanguage(option.code));
    langHost.appendChild(button);
  });
}

applyAdminTranslations();
document.title = `${t('shell.brand')} — ${t('screens.indexTitle')}`;
