/**
 * ad-shell.js — SheDrive admin portal application shell (v2 design)
 * Renders the delivered design kit's chrome: the fixed `#sidebar` with its
 * grouped icon menu, the `#content` column with the sticky `header` (collapse
 * button, breadcrumb, admin dropdown), and the page's `.section-title` band.
 *
 * Usage:
 *   <ad-shell active="drivers" page-title="Drivers"
 *             breadcrumb="People > Drivers"
 *             back="drivers.html"
 *             screen-styles="styles/list.css">
 *     ...screen content...
 *   </ad-shell>
 *
 * Attributes:
 *   active         — nav key from nav.js (highlights the sidebar item)
 *   page-title     — the underlined section heading (literal text)
 *   page-title-key — the same heading as a translation key (preferred)
 *   breadcrumb     — "Label|href > Label|href > Current" (last item is current)
 *   breadcrumb-keys— the same spec, but each label is a translation key
 *   back           — href for the round back button beside the heading
 *   screen-styles  — comma-separated screen stylesheet hrefs
 *   mapbox         — also load the Mapbox stylesheet
 *   content-class  — extra classes on the content region
 *   no-auth        — skip the session guard (auth screens only)
 *
 * The children of <ad-shell> are moved into the content region unchanged, so
 * screen markup, ids, and ARIA attributes all survive.
 */

import { NAV_SECTIONS } from '../scripts/nav.js';
import { adminAuth } from '../scripts/admin-auth.js';
import { clearMutations } from '../scripts/mutations.js';
import { injectAdminStyles, ensureToastHost, assetUrl, iconUrl } from './ad-styles.js';
import { initDesignChrome } from '../scripts/design-init.js';
import {
  t,
  lang,
  LANGUAGES,
  setAdminLanguage,
  initAdminI18n,
  applyAdminTranslations,
} from '../scripts/admin-i18n.js';
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

class AdShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.adMounted === 'true') return;
    this.dataset.adMounted = 'true';

    // Direction has to be on <html> before the style stack is chosen.
    initAdminI18n();

    injectAdminStyles({
      mapbox: this.hasAttribute('mapbox'),
      screenStyles: this.getAttribute('screen-styles') ?? '',
    });

    document.body.classList.add('admin-shell');

    // Guard before painting anything the admin should not see (#1656 Scenario 6).
    if (!this.hasAttribute('no-auth') && !adminAuth.requireAdmin()) return;

    const content = Array.from(this.childNodes);
    this.textContent = '';
    this.classList.add('wrapper', 'ad-shell');

    this.appendChild(this.buildNav());

    const main = document.createElement('div');
    main.id = 'content';
    main.className = 'ad-main';
    main.appendChild(this.buildTopbar());

    const contentRegion = document.createElement('main');
    contentRegion.className = 'ad-content container-fluid';
    contentRegion.id = 'admin-content';
    (this.getAttribute('content-class') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((cls) => contentRegion.classList.add(cls));

    const heading = this.buildSectionTitle();
    if (heading) contentRegion.appendChild(heading);

    content.forEach((node) => contentRegion.appendChild(node));

    main.appendChild(contentRegion);
    this.appendChild(main);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    this.appendChild(overlay);

    this.showToast = ensureToastHost();
    applyAdminTranslations(this);
    document.title = `${t('shell.brand')} — ${this.pageTitle() || t('shell.sections')}`;
    initDesignChrome();
  }

  /**
   * The page heading. `page-title-key` is a translation key; `page-title` is a
   * literal, kept for any screen that has not been translated yet.
   */
  pageTitle() {
    const key = this.getAttribute('page-title-key');
    if (key) return t(key);
    return this.getAttribute('page-title') ?? '';
  }

  buildNav() {
    const nav = document.createElement('nav');
    nav.id = 'sidebar';
    nav.setAttribute('aria-label', t('shell.sections'));

    const triangle = document.createElement('span');
    triangle.className = 'top-triangle';
    nav.appendChild(triangle);

    const dismiss = document.createElement('div');
    dismiss.id = 'dismiss';
    dismiss.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    dismiss.setAttribute('role', 'button');
    dismiss.setAttribute('aria-label', t('shell.hideNav'));
    nav.appendChild(dismiss);

    const header = document.createElement('div');
    header.className = 'sidebar-header';
    const logoWrap = document.createElement('a');
    logoWrap.className = 'logo';
    logoWrap.href = 'dashboard.html';
    const logo = document.createElement('img');
    logo.src = assetUrl('vendor/img/logo.png');
    logo.alt = t('aria.logo');
    logoWrap.appendChild(logo);
    header.appendChild(logoWrap);
    nav.appendChild(header);

    const active = this.getAttribute('active');
    const list = document.createElement('ul');
    list.id = 'main-menu';

    NAV_SECTIONS.forEach((section) => {
      const sectionLabel = document.createElement('span');
      sectionLabel.className = 'category';
      sectionLabel.textContent = t(section.labelKey);
      list.appendChild(sectionLabel);

      section.items.forEach((item) => {
        const li = document.createElement('li');
        if (item.key === active) li.classList.add('active');

        const link = document.createElement('a');
        link.href = item.href;
        if (item.key === active) link.setAttribute('aria-current', 'page');

        const icon = document.createElement('img');
        icon.src = iconUrl(item.icon);
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');

        link.append(icon, document.createTextNode(t(item.labelKey)));
        li.appendChild(link);
        list.appendChild(li);
      });
    });

    nav.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';

    const screensLink = document.createElement('a');
    screensLink.href = 'screens.html';
    screensLink.innerHTML = '<i class="fa-regular fa-rectangle-list"></i>';
    screensLink.appendChild(document.createTextNode(t('shell.screenIndex')));
    footer.appendChild(screensLink);

    // Actions persist for the browser session, so the designer needs a way back
    // to a clean dataset without hunting through devtools.
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn btn-light-outline btn-x-sm';
    reset.id = 'admin-reset-demo';
    reset.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
    reset.appendChild(document.createTextNode(t('shell.resetDemo')));
    reset.addEventListener('click', () => {
      clearMutations();
      window.location.reload();
    });
    footer.appendChild(reset);

    nav.appendChild(footer);

    return nav;
  }

  buildTopbar() {
    const bar = document.createElement('header');

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.id = 'sidebarCollapse';
    collapse.className = 'btn';
    collapse.setAttribute('aria-label', t('shell.toggleNav'));
    collapse.innerHTML = '<i class="fa-solid fa-bars"></i>';
    bar.appendChild(collapse);

    const crumbKeys = this.getAttribute('breadcrumb-keys');
    const crumbSpec = crumbKeys ?? this.getAttribute('breadcrumb');
    const crumbHost = document.createElement('div');
    crumbHost.className = 'topbar-breadcrumb me-auto d-none d-md-flex';
    if (crumbSpec) crumbHost.appendChild(this.buildBreadcrumb(crumbSpec, Boolean(crumbKeys)));
    bar.appendChild(crumbHost);

    const end = document.createElement('div');
    end.className = 'end-side';

    const menu = document.createElement('ul');
    menu.className = 'navbar navbar-expand topbar-menu';
    menu.appendChild(this.buildLanguageMenu());

    const session = adminAuth.getSession();

    const item = document.createElement('li');
    item.className = 'nav-item dropdown';

    const toggle = document.createElement('a');
    toggle.className = 'nav-link dropdown-toggle';
    toggle.href = 'javascript:;';
    toggle.id = 'userProfileDropdown';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('data-bs-toggle', 'dropdown');
    toggle.setAttribute('aria-expanded', 'false');

    const avatar = document.createElement('img');
    avatar.className = 'user-profile';
    avatar.src = assetUrl('vendor/img/profile-photo.png');
    avatar.alt = '';

    const info = document.createElement('span');
    info.className = 'user-info';
    const name = document.createElement('span');
    name.className = 'user-name';
    name.textContent = session?.email ?? t('shell.signedOut');
    name.classList.add('ad-ltr');
    const title = document.createElement('span');
    title.className = 'user-title';
    title.textContent = t('shell.superAdmin');
    info.append(name, title);

    toggle.append(avatar, info);

    const dropdown = document.createElement('ul');
    dropdown.className = 'dropdown-menu dropdown-menu-end slideIn';
    dropdown.setAttribute('aria-labelledby', 'userProfileDropdown');

    const profileItem = document.createElement('li');
    const profileLink = document.createElement('a');
    profileLink.className = 'dropdown-item';
    profileLink.href = 'admin-profile.html';
    profileLink.innerHTML = '<i class="fa-regular fa-user"></i>';
    profileLink.appendChild(document.createTextNode(t('shell.profile')));
    profileItem.appendChild(profileLink);

    const logoutItem = document.createElement('li');
    const logout = document.createElement('a');
    logout.className = 'dropdown-item';
    logout.href = 'javascript:;';
    logout.id = 'admin-logout';
    logout.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i>';
    logout.appendChild(document.createTextNode(t('shell.signOut')));
    logout.addEventListener('click', () => {
      adminAuth.logout();
      window.location.href = './index.html';
    });
    logoutItem.appendChild(logout);

    dropdown.append(profileItem, logoutItem);
    item.append(toggle, dropdown);
    menu.appendChild(item);
    end.appendChild(menu);
    bar.appendChild(end);

    return bar;
  }

  /** The kit's topbar language dropdown. Switching reloads into the new locale. */
  buildLanguageMenu() {
    const item = document.createElement('li');
    item.className = 'nav-item dropdown';

    const toggle = document.createElement('a');
    toggle.className = 'nav-link dropdown-toggle';
    toggle.href = 'javascript:;';
    toggle.id = 'languageDropdown';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('data-bs-toggle', 'dropdown');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', t('aria.languageMenu'));

    const icon = document.createElement('img');
    icon.className = 'icon';
    icon.src = iconUrl('language.svg');
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    toggle.appendChild(icon);

    const menu = document.createElement('ul');
    menu.className = 'dropdown-menu dropdown-menu-end slideIn';
    menu.setAttribute('aria-labelledby', 'languageDropdown');

    LANGUAGES.forEach((option) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'dropdown-item';
      link.href = 'javascript:;';
      if (option.code === lang()) link.setAttribute('aria-current', 'true');

      const flag = document.createElement('img');
      flag.className = 'flag';
      flag.src = iconUrl(`language/${option.flag}`);
      flag.alt = '';
      flag.setAttribute('aria-hidden', 'true');

      link.append(flag, document.createTextNode(option.label));
      link.addEventListener('click', () => setAdminLanguage(option.code));
      li.appendChild(link);
      menu.appendChild(li);
    });

    item.append(toggle, menu);
    return item;
  }

  /** The design kit's underlined page heading plus optional round back button. */
  buildSectionTitle() {
    const label = this.pageTitle();
    const back = this.getAttribute('back');
    if (!label && !back) return null;

    const row = document.createElement('div');
    row.className = 'section-title row gy-3';

    const titleCol = document.createElement('div');
    titleCol.className = 'title col-auto';
    const heading = document.createElement('h3');
    heading.className = 'underline-title';
    heading.id = 'ad-page-title';
    heading.textContent = label;
    titleCol.appendChild(heading);
    row.appendChild(titleCol);

    const endCol = document.createElement('div');
    endCol.className = 'end-side col-auto ms-auto';
    endCol.id = 'ad-page-actions';
    if (back) {
      const link = document.createElement('a');
      link.className = 'btn btn-back btn-back-outline';
      link.href = back;
      link.setAttribute('aria-label', t('shell.back'));
      link.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
      endCol.appendChild(link);
    }
    row.appendChild(endCol);

    return row;
  }

  /** "Drivers|drivers.html > Nour Hassan" → a Bootstrap breadcrumb. */
  buildBreadcrumb(spec, translated = false) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', t('shell.breadcrumb'));
    const list = document.createElement('ol');
    list.className = 'breadcrumb ad-breadcrumb';

    const segments = spec.split('>').map((part) => part.trim()).filter(Boolean);
    segments.forEach((segment, index) => {
      const [rawLabel, href] = segment.split('|').map((part) => part.trim());
      const label = translated ? t(rawLabel) : rawLabel;
      const li = document.createElement('li');
      li.className = 'breadcrumb-item';
      const isLast = index === segments.length - 1;

      if (href && !isLast) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        li.appendChild(link);
      } else {
        li.textContent = label;
        if (isLast) {
          li.classList.add('active');
          li.setAttribute('aria-current', 'page');
        }
      }

      list.appendChild(li);
    });

    nav.appendChild(list);
    return nav;
  }
}

if (!customElements.get('ad-shell')) {
  customElements.define('ad-shell', AdShell);
}
