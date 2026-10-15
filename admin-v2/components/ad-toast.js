/**
 * ad-toast.js — SheDrive admin toast host (v2 design kit)
 *
 * A toast is the short, non-blocking "it happened" message that follows an
 * action. It never asks for anything; the confirmation already did that.
 *
 *   success  — the action worked              auto-dismiss, role="status"
 *   info     — neutral news                   auto-dismiss, role="status"
 *   warning  — it worked, with a caveat       stays a little longer
 *   danger   — the error toast: it failed     stays until dismissed, role="alert",
 *              (`error` is an alias)          optional Retry action
 *
 * Where an action fails *inside* a form modal, the error stays inline in that
 * modal instead (ad-form-modal) — the admin's input is still there to fix. An
 * error toast is for a failure with no form to show it in: a one-click action,
 * a lookup that runs before a dialog opens, a copy or a map that cannot load.
 *
 * Markup (light DOM):
 *
 *   <ad-toast-host>
 *     <div class="toast-container" id="toast-container" aria-live="polite">
 *       <div class="ad-toast ad-toast--success" role="status">
 *         <i class="ad-toast__icon fa-solid fa-circle-check" aria-hidden="true"></i>
 *         <div class="ad-toast__body">
 *           <p class="ad-toast__title">optional title</p>
 *           <p class="ad-toast__message">message</p>
 *         </div>
 *         <button class="ad-toast__action">Retry</button>          (optional)
 *         <button class="ad-toast__close" aria-label="Dismiss">×</button>
 *         <span class="ad-toast__timer"></span>                     (auto-dismiss only)
 *       </div>
 *     </div>
 *   </ad-toast-host>
 *
 * API — the same call every screen already makes, with an optional third argument:
 *   host.showToast(message, type = 'info', options)
 *     options: a number (duration in ms, kept for older callers) or
 *              { title, duration, action: { label, onClick } | { label, href } }
 *     duration 0 keeps the toast until it is dismissed. Left out, it follows
 *     the tone and grows with the text, so a two-sentence result stays up
 *     long enough to read.
 *
 *   queueToast(message, type, options) — for an action that navigates away
 *     (approve → back to the list, sign out → sign-in). The toast is held in
 *     sessionStorage and shown by the next page's host, so it is not lost to
 *     the redirect.
 *
 * Timers pause while the pointer is over a toast or focus is inside it.
 */

import { t } from '../scripts/admin-i18n.js';

const QUEUE_KEY = 'shedrive.adminToast';
const MAX_VISIBLE = 4;

const DURATIONS = { success: 4000, info: 4000, warning: 6000, danger: 0 };

const ICONS = {
  success: 'fa-solid fa-circle-check',
  info: 'fa-solid fa-circle-info',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-circle-exclamation',
};

function normaliseTone(type) {
  if (type === 'error') return 'danger';
  return Object.hasOwn(ICONS, type) ? type : 'info';
}

function normaliseOptions(options) {
  if (typeof options === 'number') return { duration: options };
  return options ?? {};
}

/** Hold a toast for the next page — see the module header. */
export function queueToast(message, type = 'success', options = {}) {
  const { title, duration } = normaliseOptions(options);
  try {
    window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify({ message, type, title, duration }));
  } catch {
    /* storage blocked: the redirect simply happens without the toast */
  }
}

function takeQueuedToast() {
  try {
    const raw = window.sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(QUEUE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

class AdToastHost extends HTMLElement {
  connectedCallback() {
    if (this.dataset.adMounted === 'true') return;
    this.dataset.adMounted = 'true';

    const container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    this.appendChild(container);
    this.container = container;

    const queued = takeQueuedToast();
    if (queued?.message) {
      this.showToast(queued.message, queued.type, { title: queued.title, duration: queued.duration });
    }
  }

  showToast(message, type = 'info', options) {
    if (!this.container) return null;

    const tone = normaliseTone(type);
    const { title, action } = normaliseOptions(options);
    const requested = normaliseOptions(options).duration;
    const words = `${title ?? ''} ${message ?? ''}`.trim().length;
    const duration =
      requested ?? (tone === 'danger' ? 0 : Math.min(10000, Math.max(DURATIONS[tone], 1500 + 45 * words)));

    const toast = document.createElement('div');
    toast.className = `ad-toast ad-toast--${tone}`;
    toast.setAttribute('role', tone === 'danger' ? 'alert' : 'status');

    const icon = document.createElement('i');
    icon.className = `ad-toast__icon ${ICONS[tone]}`;
    icon.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'ad-toast__body';
    if (title) {
      const heading = document.createElement('p');
      heading.className = 'ad-toast__title';
      heading.textContent = title;
      body.appendChild(heading);
    }
    const text = document.createElement('p');
    text.className = 'ad-toast__message';
    text.textContent = message;
    body.appendChild(text);

    toast.append(icon, body);

    const dismiss = () => {
      window.clearTimeout(toast._timer);
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 180);
    };

    if (action?.label) {
      const control = document.createElement(action.href ? 'a' : 'button');
      control.className = 'ad-toast__action';
      control.textContent = action.label;
      if (action.href) {
        control.href = action.href;
      } else {
        control.type = 'button';
        control.addEventListener('click', () => {
          dismiss();
          action.onClick?.();
        });
      }
      toast.appendChild(control);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ad-toast__close';
    close.setAttribute('aria-label', t('toast.dismiss'));
    close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    close.addEventListener('click', dismiss);
    toast.appendChild(close);

    if (duration > 0) {
      const timer = document.createElement('span');
      timer.className = 'ad-toast__timer';
      timer.style.animationDuration = `${duration}ms`;
      toast.appendChild(timer);

      // The countdown is the bar's animation, so pausing one pauses both.
      // Hover and focus can overlap, so pausing counts holders, not events.
      let remaining = duration;
      let startedAt = 0;
      let holds = 0;
      const run = () => {
        startedAt = Date.now();
        toast._timer = window.setTimeout(dismiss, remaining);
        toast.classList.remove('is-paused');
      };
      const start = () => {
        holds = Math.max(0, holds - 1);
        if (holds === 0) run();
      };
      const pause = () => {
        holds += 1;
        if (holds > 1) return;
        window.clearTimeout(toast._timer);
        remaining -= Date.now() - startedAt;
        toast.classList.add('is-paused');
      };
      toast.addEventListener('mouseenter', pause);
      toast.addEventListener('mouseleave', start);
      toast.addEventListener('focusin', pause);
      toast.addEventListener('focusout', start);
      run();
    }

    // Newest at the bottom; drop the oldest so the stack never covers the page.
    this.container.appendChild(toast);
    const toasts = this.container.querySelectorAll('.ad-toast:not(.is-leaving)');
    if (toasts.length > MAX_VISIBLE) toasts[0].remove();

    return toast;
  }
}

if (!customElements.get('ad-toast-host')) {
  customElements.define('ad-toast-host', AdToastHost);
}
