/**
 * notification-inbox.js — controllers for the notification inbox and the
 * notification settings screen, shared by the rider and driver apps.
 *
 * The two apps render the same screens; only the feed, the categories and a few
 * strings differ, and those come from notifications.js by role. Each app's page
 * script just calls mountInbox(role) or mountNotificationSettings(role).
 *
 * Design-review switches (query string), inbox:
 *   ?state=empty    nothing yet
 *   ?state=unread   every item unread
 *   ?state=long     24 items across the three day groups
 *   ?state=loading  skeleton rows
 *   ?state=error    the request fails
 *   ?state=push-off OS permission denied — banner above the list
 *   ?state=prime    first-run permission explainer sheet
 * Settings:
 *   ?state=push-off OS permission denied — every row still shown, status row warns
 */

import { translate, applyTranslations, getLanguage, I18N_EVENT } from './i18n.js';
import { qs, qsa } from './utils.js';
import {
  CATEGORIES,
  getFeed,
  markRead,
  markAllRead,
  getPrefs,
  setPref,
  getPushPermission,
  setPushPermission,
  dayGroup,
} from './notifications.js';

const params = new URLSearchParams(window.location.search);
const demoState = params.get('state');

/* Permission is held here so a design-review state never leaks into storage and
   greets the next plain visit with a "notifications are off" banner. */
const DEMO_PERMISSION = { 'push-off': 'denied', prime: 'default' };
let permission = DEMO_PERMISSION[demoState] || getPushPermission();

function setPermission(value) {
  permission = value;
  if (!DEMO_PERMISSION[demoState]) setPushPermission(value);
}

/* ── Icons, one per category ────────────────────────────────────────────── */

const ICONS = {
  trip: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  safety: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  payment: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>',
  earnings: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>',
  account: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  offers: '<path d="M3 11l18-8v18L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
};

function icon(category) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[category] || ICONS.account}</svg>`;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function show(el, on) {
  if (!el) return;
  el.hidden = !on;
  el.setAttribute('aria-hidden', String(!on));
}

/** Resolve {ar, en} name pairs to the current language before interpolation. */
function localParams(p) {
  const lang = getLanguage();
  return Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, v && typeof v === 'object' ? v[lang] ?? v.ar : v])
  );
}

function relativeTime(ago) {
  if (ago < 1) return translate('notifications.time.now');
  if (ago < 60) return translate('notifications.time.minutes', { n: ago });
  if (ago < 24 * 60) return translate('notifications.time.hours', { n: Math.floor(ago / 60) });
  return translate('notifications.time.days', { n: Math.floor(ago / (24 * 60)) });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function showToast(msg, type = 'info') {
  const host = document.querySelector('sd-toast-host');
  if (host?.showToast) { host.showToast(msg, type); return; }
  const c = qs('#toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/** The mock's stand-in for sending her to the OS notification settings. */
function openPhoneSettings(after) {
  showToast(translate('notifications.settings.pushEnabled'), 'success');
  setPermission('granted');
  after?.();
}

/* ── Inbox ──────────────────────────────────────────────────────────────── */

export function mountInbox(role) {
  const listEl = qs('#notif-list');
  const emptyEl = qs('#notif-empty');
  const emptyTitle = qs('#notif-empty-title');
  const emptyHint = qs('#notif-empty-hint');
  const errorEl = qs('#notif-error');
  const loadingEl = qs('#notif-loading');
  const bodyEl = qs('#notif-body');
  const bannerEl = qs('#notif-push-banner');
  const markAllBtn = qs('#notif-mark-all');
  const primeSheet = qs('#notif-prime-sheet');
  const primeScrim = qs('#notif-prime-scrim');

  let filter = 'all';

  function render() {
    if (demoState === 'error') {
      show(errorEl, true);
      show(bodyEl, false);
      show(loadingEl, false);
      return;
    }
    if (demoState === 'loading') {
      show(loadingEl, true);
      show(bodyEl, false);
      return;
    }
    show(loadingEl, false);

    show(bannerEl, permission === 'denied');

    const feed = getFeed(role, demoState);
    const unread = feed.filter((n) => !n.read);
    const visible = filter === 'unread' ? unread : feed;

    if (markAllBtn) markAllBtn.toggleAttribute('disabled', unread.length === 0);
    qsa('[data-notif-filter]').forEach((chip) => {
      const on = chip.getAttribute('data-notif-filter') === filter;
      chip.setAttribute('aria-pressed', String(on));
      chip.classList.toggle('is-active', on);
    });
    const countEl = qs('#notif-unread-count');
    if (countEl) {
      countEl.textContent = unread.length;
      countEl.hidden = unread.length === 0;
    }

    const isEmpty = visible.length === 0;
    show(emptyEl, isEmpty);
    if (isEmpty) {
      const k = filter === 'unread' && feed.length ? 'emptyUnread' : 'empty';
      emptyTitle?.setAttribute('data-i18n', `notifications.${k}.title`);
      emptyHint?.setAttribute('data-i18n', `notifications.${k}.hint.${role}`);
    }

    // Group by day, keeping the feed's newest-first order inside each group.
    const groups = [];
    visible.forEach((n) => {
      const g = dayGroup(n.ago);
      if (!groups.length || groups[groups.length - 1].key !== g) groups.push({ key: g, items: [] });
      groups[groups.length - 1].items.push(n);
    });

    if (listEl) {
      listEl.innerHTML = groups
        .map(
          (g) => `
        <section class="notif-group" aria-labelledby="notif-group-${g.key}">
          <h2 class="notif-group__title" id="notif-group-${g.key}" data-i18n="notifications.group.${g.key}">${translate(`notifications.group.${g.key}`)}</h2>
          <ul class="notif-group__list" role="list">
            ${g.items.map(itemHtml).join('')}
          </ul>
        </section>`
        )
        .join('');
    }

    applyTranslations();
  }

  function itemHtml(n) {
    const p = localParams(n.params);
    const title = escapeHtml(translate(`notifications.item.${n.key}.title`, p));
    const body = escapeHtml(translate(`notifications.item.${n.key}.body`, p));
    return `
      <li class="notif-item${n.read ? '' : ' notif-item--unread'}" role="listitem">
        <a class="notif-item__link" href="${n.href}" data-notif-id="${n.id}">
          <span class="notif-item__icon notif-item__icon--${n.category}">${icon(n.category)}</span>
          <span class="notif-item__text">
            <span class="notif-item__title">${title}</span>
            <span class="notif-item__body">${body}</span>
            <span class="notif-item__time">${escapeHtml(relativeTime(n.ago))}</span>
          </span>
          ${n.read ? '' : `<span class="notif-item__dot"><span class="u-visually-hidden" data-i18n="notifications.unread">${translate('notifications.unread')}</span></span>`}
        </a>
      </li>`;
  }

  // Opening an item marks it read, then follows its deep link.
  listEl?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-notif-id]');
    if (!link) return;
    markRead(role, link.getAttribute('data-notif-id'));
  });

  qsa('[data-notif-filter]').forEach((chip) =>
    chip.addEventListener('click', () => {
      filter = chip.getAttribute('data-notif-filter');
      render();
    })
  );

  markAllBtn?.addEventListener('click', () => {
    markAllRead(role);
    render();
    showToast(translate('notifications.allRead'), 'success');
  });

  qs('#notif-push-enable')?.addEventListener('click', () => openPhoneSettings(render));
  qs('#notif-retry')?.addEventListener('click', () => { window.location.search = ''; });

  /* First-run explainer: shown before the OS prompt, so a "no" here costs nothing
     and she can still be asked again later. */
  function closePrime() {
    primeSheet?.close();
    show(primeScrim, false);
  }
  qs('#notif-prime-allow')?.addEventListener('click', () => {
    setPermission('granted');
    closePrime();
    render();
    showToast(translate('notifications.settings.pushEnabled'), 'success');
  });
  qs('#notif-prime-later')?.addEventListener('click', () => {
    setPermission('denied');
    closePrime();
    render();
  });

  customElements.whenDefined('sd-bottom-sheet').then(() => {
    if (permission === 'default') {
      primeSheet?.open();
      show(primeScrim, true);
    } else {
      primeSheet?.close();
    }
  });

  document.addEventListener(I18N_EVENT, render);
  render();
}

/* ── Settings ───────────────────────────────────────────────────────────── */

export function mountNotificationSettings(role) {
  const statusEl = qs('#notif-push-status');
  const openBtn = qs('#notif-push-open');

  function renderStatus() {
    const off = permission !== 'granted';
    if (statusEl) {
      const k = off ? 'notifications.settings.push.off' : 'notifications.settings.push.on';
      statusEl.setAttribute('data-i18n', k);
      statusEl.textContent = translate(k);
      statusEl.classList.toggle('badge--success', !off);
      statusEl.classList.toggle('badge--danger', off);
    }
    show(openBtn, off);
    qs('.notif-settings')?.classList.toggle('is-push-off', off);
  }

  const prefs = getPrefs(role);
  CATEGORIES[role].forEach((cat) => {
    const input = qs(`[data-pref="${cat.key}"]`);
    if (!input) return;
    input.checked = prefs[cat.key];
    input.disabled = cat.locked;
    input.addEventListener('change', () => {
      setPref(role, cat.key, input.checked);
      showToast(translate('notifications.settings.saved'), 'success');
    });
  });

  openBtn?.addEventListener('click', () => openPhoneSettings(renderStatus));

  document.addEventListener(I18N_EVENT, renderStatus);
  renderStatus();
}
