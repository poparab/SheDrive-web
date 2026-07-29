/**
 * ad-form-modal.js — SheDrive admin validated form modal
 * Every [Admin] story carries a Field Validation table with distinct empty,
 * invalid, and range/length messages. This component takes that table almost
 * verbatim as a field spec and renders the errors inline.
 *
 * Usage:
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
 * Field spec keys: type (text|email|password|number|textarea|select|date|readonly),
 * required, requiredWhen(values), emptyError, pattern, invalidError, min, max,
 * step, rangeError, maxLength, lengthError, hint, placeholder, options,
 * value, validate(value, values) → string | null.
 */

class AdFormModal extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
  }

  build() {
    this.classList.add('ad-modal-backdrop');
    this.hidden = true;

    this._dialog = document.createElement('div');
    this._dialog.className = 'ad-modal';
    this._dialog.setAttribute('role', 'dialog');
    this._dialog.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'ad-modal__header';
    this._title = document.createElement('h2');
    this._title.className = 'ad-modal__title';
    this._description = document.createElement('p');
    this._description.className = 'ad-section__hint';
    header.append(this._title, this._description);

    this._form = document.createElement('form');
    this._form.className = 'ad-modal__body';
    this._form.noValidate = true;

    this._summary = document.createElement('div');
    this._summary.className = 'ad-form-error';
    this._summary.setAttribute('role', 'alert');

    this._fieldHost = document.createElement('div');
    this._fieldHost.className = 'ad-stack';
    this._form.append(this._summary, this._fieldHost);

    const footer = document.createElement('div');
    footer.className = 'ad-modal__footer';
    this._cancel = document.createElement('button');
    this._cancel.type = 'button';
    this._cancel.className = 'btn btn--ghost';
    this._cancel.textContent = 'Cancel';
    this._cancel.addEventListener('click', () => this.close());
    this._confirm = document.createElement('button');
    this._confirm.type = 'submit';
    this._confirm.className = 'btn btn--primary';
    footer.append(this._cancel, this._confirm);
    this._form.appendChild(footer);

    this._dialog.append(header, this._form);
    this.textContent = '';
    this.appendChild(this._dialog);

    this._form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });

    this.addEventListener('click', (event) => {
      if (event.target === this) this.close();
    });

    this._onKeydown = (event) => {
      if (event.key === 'Escape' && this.classList.contains('is-open')) this.close();
    };

    this._built = true;
  }

  /** @param {object} config see the file header for the field spec */
  open(config) {
    if (!this._built) this.build();
    this._config = config ?? {};
    this._title.textContent = this._config.title ?? '';
    this._title.id = 'ad-modal-title';
    this._dialog.setAttribute('aria-labelledby', 'ad-modal-title');

    const description = this._config.description ?? '';
    this._description.textContent = description;
    this._description.hidden = !description;

    this._confirm.textContent = this._config.confirmLabel ?? 'Save';
    this._confirm.className = `btn btn--${this._config.danger ? 'danger' : 'primary'}`;
    this._cancel.textContent = this._config.cancelLabel ?? 'Cancel';

    this._summary.textContent = '';
    this._summary.classList.remove('is-visible');

    this.renderFields();

    this._lastFocused = document.activeElement;
    this.hidden = false;
    this.classList.add('is-open');
    document.addEventListener('keydown', this._onKeydown);
    this._fieldHost.querySelector('input, select, textarea')?.focus();
  }

  close() {
    this.classList.remove('is-open');
    this.hidden = true;
    document.removeEventListener('keydown', this._onKeydown);
    this._lastFocused?.focus?.();
    this._config?.onClose?.();
  }

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
        control.className = 'input';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = field.placeholder ?? 'Select…';
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
        control.className = 'input';
        control.rows = field.rows ?? 4;
        if (field.maxLength) control.maxLength = field.maxLength;
        control.value = field.value ?? '';
      } else if (field.type === 'readonly') {
        control = document.createElement('input');
        control.className = 'input';
        control.readOnly = true;
        control.value = field.value ?? '';
      } else {
        control = document.createElement('input');
        control.className = 'input';
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
  }

  get values() {
    const values = {};
    (this._config.fields ?? []).forEach((field) => {
      const control = this._controls.get(field.key);
      if (!control) return;
      values[field.key] =
        field.type === 'number' ? control.value.trim() : String(control.value ?? '').trim();
    });
    return values;
  }

  clearFieldError(key) {
    const error = this._errorNodes.get(key);
    const control = this._controls.get(key);
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
    control?.classList.remove('input--error');
    control?.removeAttribute('aria-invalid');
  }

  showFieldError(key, message) {
    const error = this._errorNodes.get(key);
    const control = this._controls.get(key);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (control) {
      control.classList.add('input--error');
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', `${control.id}-error`);
    }
  }

  /** Run the field spec's validation rules. Returns true when the form is valid. */
  validate() {
    const values = this.values;
    let firstInvalid = null;

    (this._config.fields ?? []).forEach((field) => {
      this.clearFieldError(field.key);
      if (field.type === 'readonly') return;

      const raw = values[field.key] ?? '';
      const required = field.required || field.requiredWhen?.(values);

      if (required && !raw) {
        this.showFieldError(field.key, field.emptyError ?? `${field.label} is required`);
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (!raw) return;

      if (field.pattern && !new RegExp(field.pattern).test(raw)) {
        this.showFieldError(field.key, field.invalidError ?? `Enter a valid ${field.label.toLowerCase()}`);
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.maxLength && raw.length > field.maxLength) {
        this.showFieldError(
          field.key,
          field.lengthError ?? `Must be ${field.maxLength} characters or fewer`,
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.minLength && raw.length < field.minLength) {
        this.showFieldError(
          field.key,
          field.lengthError ?? `Must be at least ${field.minLength} characters`,
        );
        firstInvalid = firstInvalid ?? field.key;
        return;
      }

      if (field.type === 'number') {
        const numeric = Number(raw);
        if (Number.isNaN(numeric)) {
          this.showFieldError(field.key, field.invalidError ?? 'Enter a valid number');
          firstInvalid = firstInvalid ?? field.key;
          return;
        }
        if (field.min !== undefined && numeric < Number(field.min)) {
          this.showFieldError(field.key, field.rangeError ?? `Must be at least ${field.min}`);
          firstInvalid = firstInvalid ?? field.key;
          return;
        }
        if (field.max !== undefined && numeric > Number(field.max)) {
          this.showFieldError(field.key, field.rangeError ?? `Must be at most ${field.max}`);
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
    const originalLabel = this._confirm.textContent;
    this._confirm.textContent = 'Working…';

    try {
      await this._config.onConfirm?.(values);
      this.close();
    } catch (error) {
      this._summary.textContent = error?.message ?? 'Could not save. Try again.';
      this._summary.classList.add('is-visible');
    } finally {
      this._confirm.disabled = false;
      this._cancel.disabled = false;
      this._confirm.textContent = originalLabel;
    }
  }
}

if (!customElements.get('ad-form-modal')) {
  customElements.define('ad-form-modal', AdFormModal);
}
