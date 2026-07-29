/**
 * ad-shell.js — SheDrive admin portal application shell
 * Sidebar navigation (from nav.js), sticky topbar with breadcrumb and the
 * signed-in admin, and the content region. Also injects the admin CSS stack and
 * mounts the toast host, so a screen's <head> stays to a single module import.
 *
 * Usage:
 *   <ad-shell active="drivers" page-title="Drivers"
 *             breadcrumb="Drivers"
 *             screen-styles="styles/drivers.css">
 *     ...screen content...
 *   </ad-shell>
 *
 * Attributes:
 *   active         — nav key from nav.js (highlights the sidebar item)
 *   page-title     — the topbar heading
 *   breadcrumb     — "Label|href > Label|href > Current" (last item is current)
 *   screen-styles  — comma-separated screen stylesheet hrefs
 *   mapbox         — also load the Mapbox stylesheet
 *   content-class  — extra classes on the content region
 *   no-auth        — skip the session guard (login screen only)
 *
 * The children of <ad-shell> are moved into the content region unchanged, so
 * screen markup, ids, and ARIA attributes all survive.
 */

import { NAV_SECTIONS } from '../scripts/nav.js';
import { adminAuth } from '../scripts/admin-auth.js';
import { injectAdminStyles, ensureToastHost } from './ad-styles.js';
import '../../shared/components/sd-toast-host.js';
import './ad-status-pill.js';
import './ad-stat-card.js';
import './ad-data-table.js';
import './ad-filter-bar.js';
import './ad-detail-section.js';
import './ad-empty-state.js';
import './ad-timeline.js';
import './ad-doc-viewer.js';
import './ad-tabs.js';
import './ad-form-modal.js';
import './ad-map-panel.js';

const LOGO = '../shared/assets/logos/shedrive-wordmark.svg';

class AdShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.adMounted === 'true') return;
    this.dataset.adMounted = 'true';

    injectAdminStyles({
      mapbox: this.hasAttribute('mapbox'),
      screenStyles: this.getAttribute('screen-styles') ?? '',
    });

    document.body.classList.add('admin-shell');

    // Guard before painting anything the admin should not see (#1656 Scenario 6).
    if (!this.hasAttribute('no-auth') && !adminAuth.requireAdmin()) return;

    const content = Array.from(this.childNodes);
    this.textContent = '';
    this.classList.add('ad-shell');

    this.appendChild(this.buildNav());

    const main = document.createElement('div');
    main.className = 'ad-main';
    main.appendChild(this.buildTopbar());

    const contentRegion = document.createElement('main');
    contentRegion.className = 'ad-content';
    contentRegion.id = 'admin-content';
    (this.getAttribute('content-class') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((cls) => contentRegion.classList.add(cls));
    content.forEach((node) => contentRegion.appendChild(node));

    main.appendChild(contentRegion);
    this.appendChild(main);

    this.showToast = ensureToastHost();
    document.title = `SheDrive Admin — ${this.getAttribute('page-title') ?? 'Portal'}`;
  }

  buildNav() {
    const nav = document.createElement('nav');
    nav.className = 'ad-nav';
    nav.setAttribute('aria-label', 'Admin sections');

    const brand = document.createElement('a');
    brand.className = 'ad-nav__brand';
    brand.href = 'dashboard.html';
    const logo = document.createElement('img');
    logo.src = LOGO;
    logo.alt = 'SheDrive';
    const badge = document.createElement('span');
    badge.className = 'ad-nav__brand-label';
    badge.textContent = 'Admin';
    brand.append(logo, badge);
    nav.appendChild(brand);

    const active = this.getAttribute('active');
    const list = document.createElement('ul');
    list.className = 'ad-nav__list';

    NAV_SECTIONS.forEach((section) => {
      const heading = document.createElement('li');
      heading.className = 'ad-nav__section';
      heading.textContent = section.label;
      list.appendChild(heading);

      section.items.forEach((item) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'ad-nav__link';
        link.href = item.href;
        if (item.key === active) link.setAttribute('aria-current', 'page');

        const icon = document.createElement('span');
        icon.className = 'ad-nav__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.icon;

        link.append(icon, document.createTextNode(item.label));
        li.appendChild(link);
        list.appendChild(li);
      });
    });

    nav.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'ad-nav__footer';
    const screensLink = document.createElement('a');
    screensLink.href = 'screens.html';
    screensLink.textContent = 'Mockup screen index';
    footer.append(screensLink);
    nav.appendChild(footer);

    return nav;
  }

  buildTopbar() {
    const bar = document.createElement('header');
    bar.className = 'ad-topbar';

    const heading = document.createElement('div');
    heading.className = 'ad-topbar__heading';

    const crumbSpec = this.getAttribute('breadcrumb');
    if (crumbSpec) {
      heading.appendChild(this.buildBreadcrumb(crumbSpec));
    }

    const title = document.createElement('h1');
    title.className = 'ad-topbar__title';
    title.textContent = this.getAttribute('page-title') ?? '';
    heading.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'ad-topbar__actions';

    const session = adminAuth.getSession();
    if (session) {
      const user = document.createElement('span');
      user.className = 'ad-user';
      const email = document.createElement('span');
      email.className = 'ad-user__email';
      email.textContent = session.email;
      const role = document.createElement('span');
      role.className = 'badge badge--brand';
      role.textContent = 'Super admin';
      user.append(email, role);
      actions.appendChild(user);
    }

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn btn--ghost btn--sm';
    logout.id = 'admin-logout';
    logout.textContent = 'Sign out';
    logout.addEventListener('click', () => {
      adminAuth.logout();
      window.location.href = './index.html';
    });
    actions.appendChild(logout);

    bar.append(heading, actions);
    return bar;
  }

  /** "Drivers|drivers.html > Nour Hassan" → an ordered breadcrumb list. */
  buildBreadcrumb(spec) {
    const list = document.createElement('ol');
    list.className = 'ad-breadcrumb';

    const segments = spec.split('>').map((part) => part.trim()).filter(Boolean);
    segments.forEach((segment, index) => {
      const [label, href] = segment.split('|').map((part) => part.trim());
      const li = document.createElement('li');
      const isLast = index === segments.length - 1;

      if (href && !isLast) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        li.appendChild(link);
      } else {
        li.textContent = label;
        if (isLast) li.setAttribute('aria-current', 'page');
      }

      list.appendChild(li);

      if (!isLast) {
        const sep = document.createElement('li');
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '/';
        list.appendChild(sep);
      }
    });

    return list;
  }
}

if (!customElements.get('ad-shell')) {
  customElements.define('ad-shell', AdShell);
}
