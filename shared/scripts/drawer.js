/**
 * drawer.js — reusable side-drawer for rider pages
 * Usage:  import { Drawer } from '../../shared/scripts/drawer.js';
 *         Drawer.mount();
 * Then wire: document.getElementById('menu-btn').addEventListener('click', Drawer.open);
 */
import { auth } from './auth.js';
import { applyTranslations, isI18nReady, translate } from './i18n.js';

export const Drawer = {
  _el: null,
  _backdrop: null,

  mount() {
    if (document.getElementById('app-drawer')) return; // already mounted

    // Inject backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    // Inject drawer HTML (translated via translate() after i18n is loaded)
    const session = auth.getSession();
    const phone = session?.phone || '';

    const drawer = document.createElement('nav');
    drawer.id = 'app-drawer';
    drawer.className = 'app-drawer';
    drawer.setAttribute('aria-label', 'القائمة');
    drawer.setAttribute('data-i18n-aria-label', 'aria.menu');
    drawer.setAttribute('role', 'navigation');

    drawer.innerHTML = `
      <div class="drawer-header">
        <button type="button" class="btn btn--icon btn--ghost drawer-close" id="drawer-close" aria-label="إغلاق" data-i18n-aria-label="aria.close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="drawer-user">
          <div class="drawer-user__avatar" aria-hidden="true">ش</div>
          <div class="drawer-user__info">
            <div class="drawer-user__phone">${phone || '—'}</div>
            <span class="drawer-user__badge" data-i18n="menu.verifiedBadge">موثق</span>
          </div>
        </div>
      </div>
      <ul class="drawer-nav" role="list">
        ${[
          ['menu.profile', 'person', 'ملفي الشخصي'],
          ['menu.rides', 'list', 'رحلاتي'],
          ['menu.payments', 'credit-card', 'المدفوعات'],
          ['menu.safety', 'shield', 'الأمان'],
          ['menu.settings', 'settings', 'الإعدادات'],
          ['menu.help', 'help-circle', 'المساعدة'],
          ['menu.schedule', 'calendar', 'جدولة رحلة'],
        ].map(([key, icon, fallback]) => `
          <li class="drawer-nav__item" role="listitem">
            <button type="button" class="drawer-nav__btn" data-menu-key="${key}">
              <span class="drawer-nav__icon">${iconSvg(icon)}</span>
              <span class="drawer-nav__label" data-i18n="${key}">${fallback}</span>
              <svg class="drawer-nav__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </li>
        `).join('')}
      </ul>
      <div class="drawer-divider" aria-hidden="true"></div>
      <ul class="drawer-nav drawer-nav--bottom" role="list">
        <li class="drawer-nav__item" role="listitem">
          <button type="button" class="drawer-nav__btn drawer-nav__btn--danger" id="drawer-logout">
            <span class="drawer-nav__icon">${iconSvg('log-out')}</span>
            <span class="drawer-nav__label" data-i18n="menu.logout">تسجيل الخروج</span>
          </button>
        </li>
      </ul>
    `;

    // Mount inside .app-shell so position:fixed children are contained within
    // the 430 px phone frame on desktop (the shell has transform: translateZ(0)).
    const container = document.querySelector('.app-shell') || document.body;
    container.appendChild(backdrop);
    container.appendChild(drawer);
    this._el = drawer;
    this._backdrop = backdrop;

    // Menu item navigation
    const NAV_MAP = {
      'menu.profile':  './profile.html',
      'menu.rides':    './history.html',
      'menu.payments': './payment-method.html',
      'menu.safety':   './sos.html',
      'menu.schedule': './schedule.html',
    };

    drawer.querySelectorAll('[data-menu-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-menu-key');
        Drawer.close();
        const dest = NAV_MAP[key];
        if (dest) {
          setTimeout(() => window.location.assign(dest), 200);
        } else {
          setTimeout(() => showToast(translate('menu.comingSoon'), 'info'), 200);
        }
      });
    });

    // Logout
    drawer.querySelector('#drawer-logout').addEventListener('click', () => {
      auth.logout();
      window.location.replace('./index.html');
    });

    // Close on backdrop click
    backdrop.addEventListener('click', () => Drawer.close());

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._el?.classList.contains('is-open')) Drawer.close();
    });

    drawer.querySelector('#drawer-close').addEventListener('click', () => Drawer.close());

    if (isI18nReady()) {
      applyTranslations();
    }
  },

  open() {
    Drawer._el?.classList.add('is-open');
    Drawer._backdrop?.classList.add('is-open');
    // Lock scroll on the shell (drawer is mounted inside it)
    const shell = document.querySelector('.app-shell');
    if (shell) shell.style.overflow = 'hidden';
    else document.body.style.overflow = 'hidden';
    Drawer._el?.querySelector('#drawer-close')?.focus();
  },

  close() {
    Drawer._el?.classList.remove('is-open');
    Drawer._backdrop?.classList.remove('is-open');
    const shell = document.querySelector('.app-shell');
    if (shell) shell.style.overflow = '';
    else document.body.style.overflow = '';
    document.getElementById('menu-btn')?.focus();
  },
};

// Helper: minimal inline SVG icons
function iconSvg(name) {
  const icons = {
    'person': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'list': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'credit-card': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    'shield': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    'settings': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'help-circle': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'log-out': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    'calendar': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  };
  return icons[name] || '';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
