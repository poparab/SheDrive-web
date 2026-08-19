/**
 * ad-form-modal.js — SheDrive admin validated form modal (v2 design kit)
 *
 * Every [Admin] story carries a Field Validation table with distinct empty,
 * invalid, and range/length messages. This component takes that table almost
 * verbatim as a field spec and renders the errors inline.
 *
 * RENDER (v2): the delivered kit's Bootstrap 5 popup, built with
 * `document.createElement` and appended to `<body>` so no positioned ancestor
 * can trap it:
 *
 *   <div class="modal fade popup-warning" data-bs-backdrop="static" tabindex="-1">
 *     <div class="modal-dialog modal-dialog-centered">
 *       <div class="modal-content">
 *         <div class="modal-header">
 *           <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
 *         </div>
 *         <div class="modal-body">
 *           <div class="status-sign warning"><i class="fa-solid fa-warning"></i></div>
 *           <h4 id="…">title</h4>
 *           <p>description</p>
 *           <form>  .ad-form-error  +  .field > label.field__label
 *                                       + .form-control|.form-select
 *                                       + .field__hint + .field__error </form>
 *         </div>
 *         <div class="modal-footer">
 *           <button class="btn btn-success|btn-danger" form="…" type="submit">…</button>
 *           <button class="btn btn-warning-outline" data-bs-dismiss="modal">…</button>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 *
 * `popup-warning` is the tone for destructive and confirming flows (the
 * default); `popup-success` is for success acknowledgements. `popup-danger`,
 * `popup-info` and `popup-primary` are also accepted.
 *
 * Behaviour comes from Bootstrap's JS API — `bootstrap.Modal.getOrCreateInstance`
 * — which supplies the backdrop, the focus trap and Escape-to-close. If the
 * bundle cannot be loaded the component falls back to showing the same markup
 * itself, so a screen is never blocked on a script.
 *
 * Usage (unchanged from v1):
 *   modal.open({
 *     title: 'Reject application',
 *     description: 'The driver is notified with the reason you select.',
 *     confirmLabel: 'Reject application',
 *     danger: true,
 *     fields: [
 *       { key: 'reason', type: 'select', label: 'Rejection reason', required: true,
 *         options: REASONS.map((r) => ({ value: r, label: r })),
 *         emptyError: 'Select a rejection reason' },
 *       { key: 'note', type: 'textarea', label: 'Note', maxLength: 500,
 *         requiredWhen: (values) => values.reason === 'Other',
 *         emptyError: 'Add an explanatory note',
 *         lengthError: 'Too long — must be ≤ 500 characters' },
 *     ],
 *     onConfirm: async (values) => { await mockApi.rejectApplication(id, values.reason); },
 *   });
 *
 * onConfirm may throw: the modal stays open and shows the thrown message.
 * onClose fires on every close, including after a successful confirm.
 *
 * Every string the component itself supplies — the close button's label, the
 * default confirm/cancel labels, the select placeholder, the busy label, the
 * generic save-failure summary, and the built-in validation fallbacks — comes
 * from `t()`. The per-field `emptyError` / `invalidError` / `lengthError` /
 * `rangeError` messages are still supplied by the screen, because they are
 * quoted verbatim from each story's Field Validation table.
 *
 * Config keys: title, description, confirmLabel, cancelLabel, danger, tone,
 * icon, confirmVariant, cancelVariant, hideCancel, fields, onConfirm, onClose.
 * Field spec keys: type (text|email|password|number|textarea|select|date|readonly),
 * required, requiredWhen(values), emptyError, pattern, invalidError, min, max,
 * step, rangeError, maxLength, minLength, lengthError, hint, placeholder,
 * options, value, rows, autocomplete, ltr (the value is Latin data — an id,
 * phone number, email, plate number or money — so it keeps LTR inside the
 * Arabic form), validate(value, values) → string | null.
 *
 * Events (additive, both bubble): `ad-modal-confirm` with detail { values }
 * after onConfirm resolves, and `ad-modal-cancel` when the admin dismisses it.
 *
 * NOTE: this component has no slide-over (`.ad-panel*`) mode — no screen or
 * script in admin-v2 ever emitted those class names, so nothing was removed.
 */

import { loadBootstrap } from '../scripts/design-init.js';
import { t } from '../scripts/admin-i18n.js';

const TONES = new Set(['warning', 'success', 'danger', 'info', 'primary']);

const TONE_ICONS = {
  warning: 'fa-solid fa-warning',
  success: 'fa-solid fa-check',
  danger: 'fa-solid fa-xmark',
  info: 'fa-solid fa-info',
  primary: 'fa-solid fa-circle-question',
};

let instanceCount = 0;

class AdFormModal extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
  }

  disconnectedCallback() {
    // The dialog lives on <body>, so it has to be taken down with the host.
    // <ad-shell> re-parents its children on mount, which disconnects and
    // immediately reconnects this element — so only tear down if the host is
    // still detached on the next turn, and allow a later rebuild.
    window.setTimeout(() => {
      if (this.isConnected) return;
      this._instance?.dispose?.();
      this._instance = null;
      this._root?.remove();
      this._backdrop?.remove();
      this._root = null;
      this._backdrop = null;
      this._built = false;
    }, 0);
  }

  build() {
    instanceCount += 1;
    const uid = instanceCount;
    this._titleId = `ad-modal-title-${uid}`;
    this._formId = `ad-modal-form-${uid}`;

    // The host itself renders nothing; it is only the screen's handle.
    this.textContent = '';
    this.hidden = true;

    this._root = document.createElement('div');
    this._root.className = 'modal fade popup-warning';
    this._root.id = `ad-modal-${uid}`;
    this._root.tabIndex = -1;
    this._root.setAttribute('data-bs-backdrop', 'static');
    this._root.setAttribute('aria-labelledby', this._titleId);
    this._root.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog modal-dialog-centered';

    const content = document.createElement('div');
    content.className = 'modal-content';

    // ── Header: the kit's bare close button ──
    const header = document.createElement('div');
    header.className = 'modal-header';
    this._close = document.createElement('button');
    this._close.type = 'button';
    this._close.className = 'btn-close';
    this._close.setAttribute('data-bs-dismiss', 'modal');
    this._close.setAttribute('aria-label', t('aria.closeDialog'));
    this._close.addEventListener('click', () => this.close());
    header.appendChild(this._close);

    // ── Body: status sign, title, description, form ──
    const body = document.createElement('div');
    body.className = 'modal-body';

    this._sign = document.createElement('div');
    this._sign.className = 'status-sign warning';
    this._signIcon = document.createElement('i');
    this._signIcon.className = TONE_ICONS.warning;
    this._sign.appendChild(this._signIcon);

    this._title = document.createElement('h4');
    this._title.id = this._titleId;

    this._description = document.createElement('p');

    this._form = document.createElement('form');
    this._form.id = this._formId;
    this._form.className = 'ad-modal__form';
    this._form.noValidate = true;
    // The kit centres .modal-body content; form rows must still read as a form.
    this._form.style.width = '100%';
    this._form.style.textAlign = 'start';

    this._summary = document.createElement('div');
    this._summary.className = 'ad-form-error';
    this._summary.setAttribute('role', 'alert');

    this._fieldHost = document.createElement('div');
    this._fieldHost.className = 'ad-stack';
    this._form.append(this._summary, this._fieldHost);

    body.append(this._sign, this._title, this._description, this._form);

    // ── Footer: confirm first, then the way back (kit order) ──
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    this._confirm = document.createElement('button');
    this._confirm.type = 'submit';
    this._confirm.className = 'btn btn-success';
    this._confirm.setAttribute('form', this._formId);

    this._cancel = document.createElement('button');
    this._cancel.type = 'button';
    this._cancel.className = 'btn btn-warning-outline';
    this._cancel.textContent = t('common.cancel');
    this._cancel.addEventListener('click', () => this.close());

    footer.append(this._confirm, this._cancel);

    content.append(header, body, footer);
    dialog.appendChild(content);
    this._root.appendChild(dialog);
    document.body.appendChild(this._root);

    this._form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });

    // Bootstrap owns show/hide; onClose has to fire whichever route was taken.
    this._root.addEventListener('hidden.bs.modal', () => this.handleHidden());

    // Escape and backdrop handling for the no-Bootstrap fallback only.
    this._onKeydown = (event) => {
      if (event.key === 'Escape' && this._isOpen && !this._instance) this.close();
    };

    this._built = true;
  }

  // ── Open / close ────────────────────────────────────

  /**
   * @param {object} config see the file header for the full spec
   * @returns {Promise<void>} resolves once the dialog is on screen
   */
  async open(config) {
    if (!this._built) this.build();
    this._config = config ?? {};

    const tone = this.resolveTone(this._config);
    this._root.className = `modal fade popup-${tone}`;
    this._sign.className = `status-sign ${tone}`;
    this._signIcon.className = this._config.icon ?? TONE_ICONS[tone];

    this._title.textContent = this._config.title ?? '';

    const description = this._config.description ?? '';
    this._description.textContent = description;
    this._description.hidden = !description;

    this._confirm.textContent = this._config.confirmLabel ?? t('common.save');
    this._confirm.className = `btn ${
      this._config.confirmVariant ?? (this._config.danger ? 'btn-danger' : 'btn-success')
    }`;
    this._cancel.textContent = this._config.cancelLabel ?? t('common.cancel');
    this._cancel.className = `btn ${this._config.cancelVariant ?? 'btn-warning-outline'}`;
    this._cancel.hidden = Boolean(this._config.hideCancel);

    this._summary.textContent = '';
    this._summary.classList.remove('is-visible');

    this.renderFields();

    this._lastFocused = document.activeElement;
    this._isOpen = true;
    this._confirmed = false;

    try {
      await loadBootstrap();
    } catch {
      /* fall through to the manual fallback below */
    }

    if (window.bootstrap?.Modal) {
      this._instance = window.bootstrap.Modal.getOrCreateInstance(this._root);
      this._root.addEventListener(
        'shown.bs.modal',
        () => this.focusFirstControl(),
        { once: true },
      );
      this._instance.show();
    } else {
      this.showFallback();
    }
  }

  resolveTone(config) {
    if (config.tone && TONES.has(config.tone)) return config.tone;
    return 'warning';
  }

  focusFirstControl() {
    const first = this._fieldHost.querySelector(
      'input:not([readonly]), select, textarea',
    );
    (first ?? this._confirm)?.focus();
  }

  /** Bootstrap-free display, used only when the vendor bundle fails to load. */
  showFallback() {
    this._root.classList.add('show');
    this._root.style.display = 'block';
    this._root.removeAttribute('aria-hidden');
    this._root.setAttribute('aria-modal', 'true');
    this._root.setAttribute('role', 'dialog');

    if (!this._backdrop) {
      this._backdrop = document.createElement('div');
      this._backdrop.className = 'modal-backdrop fade show';
    }
    document.body.appendChild(this._backdrop);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', this._onKeydown);
    this.focusFirstControl();
  }

  hideFallback() {
    this._root.classList.remove('show');
    this._root.style.display = 'none';
    this._root.setAttribute('aria-hidden', 'true');
    this._root.removeAttribute('aria-modal');
    this._backdrop?.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', this._onKeydown);
    this.handleHidden();
  }

  close() {
    if (!this._isOpen) return;
    if (this._instance) {
      this._instance.hide();
      return;
    }
    this.hideFallback();
  }

  /** Single exit point — runs for cancel, Escape, close button and confirm. */
  handleHidden() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._lastFocused?.focus?.();
    if (!this._confirmed) {
      this.dispatchEvent(new CustomEvent('ad-modal-cancel', { bubbles: true }));
    }
    this._config?.onClose?.();
  }

  // ── Fields ──────────────────────────────────────────

  renderFields() {
    this._fieldHost.textContent = '';
    this._controls = new Map();
    this._errorNodes = new Map();

    (this._config.fields ?? []).forEach((field) => {
      const wrap = document.createElement('div');
      wrap.className = 'field';

      const id = `ad-field-${field.key}`;
      const label = document.createElement('label');
      label.className = 'field__label';
      label.htmlFor = id;
      label.textContent = field.required ? `${field.label} *` : field.label;
      wrap.appendChild(label);

      let control;
      if (field.type === 'select') {
        control = document.createElement('select');
        control.className = 'form-select';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = field.placeholder ?? t('modal.selectPlaceholder');
        control.appendChild(placeholder);
        (field.options ?? []).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          control.appendChild(opt);
        });
        control.value = field.value ?? '';
      } else if (field.type === 'textarea') {
        control = document.createElement('textarea');
        control.className = 'form-control';
        control.rows = field.rows ?? 4;
        if (field.maxLength) control.maxLength = field.maxLength;
        control.value = field.value ?? '';
      } else if (field.type === 'readonly') {
        control = document.createElement('input');
        control.className = 'form-control';
        control.readOnly = true;
        control.value = field.value ?? '';
      } else {
        control = document.createElement('input');
        control.className = 'form-control';
        control.type = field.type ?? 'text';
        if (field.placeholder) control.placeholder = field.placeholder;
        if (field.maxLength) control.maxLength = field.maxLength;
        if (field.min !== undefined) control.min = field.min;
        if (field.max !== undefined) control.max = field.max;
        if (field.step !== undefined) control.step = field.step;
        control.value = field.value ?? '';
      }

      control.id = id;
      control.name = field.key;
      // Latin data (ids, phone numbers, emails, plate numbers, money) keeps its
      // own direction inside the Arabic form — styles/admin-rtl.css isolates it.
      if (field.ltr) control.classList.add('ad-ltr');
      if (field.autocomplete) control.autocomplete = field.autocomplete;
      wrap.appendChild(control);

      if (field.hint) {
        const hint = document.createElement('span');
        hint.className = 'field__hint';
        hint.textContent = field.hint;
        wrap.appendChild(hint);
      }

      const error = document.createElement('span');
      error.className = 'field__error';
      error.id = `${id}-error`;
      error.hidden = true;
      wrap.appendChild(error);

      // Clear a field's error as soon as the admin edits it.
      control.addEventListener('input', () => this.clearFieldError(field.key));
      control.addEventListener('change', () => this.clearFieldError(field.key));

      this._controls.set(field.key, control);
      this._errorNodes.set(field.key, error);
      this._fieldHost.appendChild(wrap);
    });

    this._form.hidden = (this._config.fields ?? []).length === 0 && !this._summary.textContent;
  }

  get values() {
    const values = {};
    (this._config?.fields ?? []).forEach((field) => {
      const control = this._controls?.get(field.key);
      if (!control) return;
      values[field.key] =
        field.type === 'number' ? control.value.trim() : String(control.value ?? '').trim();
    });
    return values;
  }

  clearFieldError(key) {
    const error = this._errorNodes?.get(key);
    const control = this._controls?.get(key);
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
    control?.classList.remove('is-invalid', 'input--error');
    control?.removeAttribute('aria-invalid');
  }

  showFieldError(key, message) {
    const error = this._errorNodes?.get(key);
    const control = this._controls?.get(key);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (control) {
      control.classList.add('is-invalid', 'input--error');
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', `${control.id}-error`);
    }
  }

  /** Run the field spec's validation rules. Returns true when the form is valid. */
  validate() {
    const values = this.values;
    let firstInvalid = null;

    (this._config?.fields ?? []).forEach((field) => {
      this.clearFieldError(field.key);
      if (field.type === 'readonly') return;

      const raw = values[field.key] ?? '';
      const required = field.required || field.requiredWhen?.(values);

      if (required && !raw) {
        this.showFieldError(
          field.key,
          field.emptyError ?? t('validation.required', { label: field.label }),
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (!raw) return;

      if (field.pattern && !new RegExp(field.pattern).test(raw)) {
        this.showFieldError(
          field.key,
          field.invalidError ??
            t('validation.invalid', { label: String(field.label ?? '').toLowerCase() }),
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.maxLength && raw.length > field.maxLength) {
        this.showFieldError(
          field.key,
          field.lengthError ?? t('validation.maxLength', { max: field.maxLength }),
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.minLength && raw.length < field.minLength) {
        this.showFieldError(
          field.key,
          field.lengthError ?? t('validation.minLength', { min: field.minLength }),
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.type === 'number') {
        const numeric = Number(raw);
        if (Number.isNaN(numeric)) {
          this.showFieldError(
            field.key,
            field.invalidError ?? t('validation.invalidNumber'),
          );
          firstInvalid = firstInvalid ?? field.key;
          return;
        }
        if (field.min !== undefined && numeric < Number(field.min)) {
          this.showFieldError(
            field.key,
            field.rangeError ?? t('validation.min', { min: field.min }),
          );
          firstInvalid = firstInvalid ?? field.key;
          return;
        }
        if (field.max !== undefined && numeric > Number(field.max)) {
          this.showFieldError(
            field.key,
            field.rangeError ?? t('validation.max', { max: field.max }),
          );
          firstInvalid = firstInvalid ?? field.key;
          return;
        }
      }

      const custom = field.validate?.(raw, values);
      if (custom) {
        this.showFieldError(field.key, custom);
        firstInvalid = firstInvalid ?? field.key;
      }
    });

    if (firstInvalid) {
      this._controls.get(firstInvalid)?.focus();
      return false;
    }
    return true;
  }

  async submit() {
    this._summary.classList.remove('is-visible');
    if (!this.validate()) return;

    const values = this.values;
    this._confirm.disabled = true;
    this._cancel.disabled = true;
    this._close.disabled = true;
    const originalLabel = this._confirm.textContent;
    this._confirm.textContent = t('modal.working');

    try {
      await this._config.onConfirm?.(values);
      this._confirmed = true;
      this.dispatchEvent(
        new CustomEvent('ad-modal-confirm', { bubbles: true, detail: { values } }),
      );
      this.close();
    } catch (error) {
      this._summary.textContent = error?.message ?? t('modal.saveFailed');
      this._summary.classList.add('is-visible');
      this._form.hidden = false;
    } finally {
      this._confirm.disabled = false;
      this._cancel.disabled = false;
      this._close.disabled = false;
      this._confirm.textContent = originalLabel;
    }
  }
}

if (!customElements.get('ad-form-modal')) {
  customElements.define('ad-form-modal', AdFormModal);
}
