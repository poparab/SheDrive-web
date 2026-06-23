/**
 * sd-confirm-dialog — bilingual confirm/cancel dialog.
 *
 * Attributes:
 *   title-key      — i18n key for dialog title
 *   body-key       — i18n key for dialog body
 *   confirm-key    — i18n key for confirm button (default: "common.confirm")
 *   cancel-key     — i18n key for cancel button  (default: "common.cancel")
 *   danger         — if present, confirm button uses danger variant
 *
 * Methods:
 *   open()
 *   close()
 *
 * Events:
 *   sd-confirm  — user clicked confirm
 *   sd-cancel   — user clicked cancel or backdrop
 */

import { translate, I18N_EVENT } from '../scripts/i18n.js';

class SdConfirmDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;
    this.dataset.sdMounted = 'true';

    this._render();
    this._bindEvents();

    document.addEventListener(I18N_EVENT, () => this._updateText());
  }

  _render() {
    this.setAttribute('role', 'dialog');
    this.setAttribute('aria-modal', 'true');
    this.hidden = true;

    this.innerHTML = `
      <div class="confirm-dialog__backdrop" data-action="cancel"></div>
      <div class="confirm-dialog__panel">
        <h2 class="confirm-dialog__title" id="confirm-dialog-title-${this._uid}"></h2>
        <p class="confirm-dialog__body"></p>
        <div class="confirm-dialog__actions">
          <button type="button" class="btn btn--ghost btn--full confirm-dialog__cancel-btn"></button>
          <button type="button" class="btn btn--full confirm-dialog__confirm-btn"></button>
        </div>
      </div>
    `;

    this._updateText();
  }

  get _uid() {
    if (!this.__uid) this.__uid = Math.random().toString(36).slice(2);
    return this.__uid;
  }

  _updateText() {
    const t = (key, fallback) => {
      try { return translate(key) || fallback; } catch { return fallback; }
    };

    const titleKey = this.getAttribute('title-key') || '';
    const bodyKey = this.getAttribute('body-key') || '';
    const confirmKey = this.getAttribute('confirm-key') || 'common.confirm';
    const cancelKey = this.getAttribute('cancel-key') || 'common.cancel';

    const titleEl = this.querySelector('.confirm-dialog__title');
    const bodyEl = this.querySelector('.confirm-dialog__body');
    const confirmBtn = this.querySelector('.confirm-dialog__confirm-btn');
    const cancelBtn = this.querySelector('.confirm-dialog__cancel-btn');

    if (titleEl) titleEl.textContent = t(titleKey, this.getAttribute('title-fallback') || '');
    if (bodyEl) bodyEl.textContent = t(bodyKey, this.getAttribute('body-fallback') || '');
    if (confirmBtn) {
      confirmBtn.textContent = t(confirmKey, 'تأكيد');
      confirmBtn.className = `btn btn--full confirm-dialog__confirm-btn${this.hasAttribute('danger') ? ' btn--danger' : ' btn--primary'}`;
    }
    if (cancelBtn) cancelBtn.textContent = t(cancelKey, 'إلغاء');
  }

  _bindEvents() {
    this.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') this._emit('sd-cancel');
      if (action === 'confirm') this._emit('sd-confirm');
    });

    this.querySelector('.confirm-dialog__confirm-btn')?.addEventListener('click', () => {
      this._emit('sd-confirm');
    });

    this.querySelector('.confirm-dialog__cancel-btn')?.addEventListener('click', () => {
      this._emit('sd-cancel');
    });

    document.addEventListener('keydown', (e) => {
      if (!this.hidden && e.key === 'Escape') this._emit('sd-cancel');
    });
  }

  _emit(eventName) {
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    this.close();
  }

  open() {
    this._updateText();
    this.hidden = false;
    document.body.style.overflow = 'hidden';
    this.querySelector('.confirm-dialog__confirm-btn')?.focus();
  }

  close() {
    this.hidden = true;
    document.body.style.overflow = '';
  }
}

if (!customElements.get('sd-confirm-dialog')) {
  customElements.define('sd-confirm-dialog', SdConfirmDialog);
}
