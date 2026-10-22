/**
 * pricing-dialogs.js — the kit's three dialog shapes for the pricing screens
 * (pricing-zones.html, pricing-policies.html). Kit v22-09 port, 2026-10-14.
 *
 * <ad-form-modal> renders only the centred `popup-*` shape, but the kit draws
 * the rate card and the rename form as a `default-modal` (icon + h3 header,
 * labelled form, Save / Cancel footer). This helper builds that shape and the
 * two popups that follow it, with the same field-validation contract as
 * ad-form-modal so the #1757 / #1830 Field Validation tables still apply.
 *
 *   default-modal  — openDialog({ variant: 'default', icon: 'calculate-dollar.svg', title, fields, … })
 *   popup-warning  — openDialog({ variant: 'warning', title, description, confirm, … })
 *   popup-success  — openDialog({ variant: 'success', title, description, body })
 *
 * Every dialog is built on <body>, shown with Bootstrap's Modal API (the kit's
 * own JS), and removed once hidden. `openDialog` resolves when it has closed:
 * `{ confirmed, result }` — `result` is whatever `onConfirm` returned.
 * `onConfirm(values)` may throw; the dialog stays open and shows the message.
 */

import { loadBootstrap } from './design-init.js';
import { approvalHref } from './approval-review.js';
import { iconUrl } from '../components/ad-styles.js';
import { t } from './admin-i18n.js';

let uid = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(className, iconClass, label) {
  const btn = el('button', `btn ${className}`);
  btn.type = 'button';
  if (iconClass) {
    const i = el('i', iconClass);
    i.setAttribute('aria-hidden', 'true');
    btn.appendChild(i);
  }
  btn.append(document.createTextNode(label));
  return btn;
}

/** Same rules, same order, as ad-form-modal's validate(). */
function fieldError(field, raw, values) {
  const required = field.required || field.requiredWhen?.(values);
  if (required && !raw) return field.emptyError ?? t('validation.required', { label: field.label });
  if (!raw) return null;
  if (field.maxLength && raw.length > field.maxLength) return field.lengthError ?? t('validation.maxLength', { max: field.maxLength });
  if (field.minLength && raw.length < field.minLength) return field.lengthError ?? t('validation.minLength', { min: field.minLength });
  if (field.type === 'number') {
    const numeric = Number(raw);
    if (Number.isNaN(numeric)) return field.invalidError ?? t('validation.invalidNumber');
    if (field.min !== undefined && numeric < Number(field.min)) return field.rangeError ?? t('validation.min', { min: field.min });
    if (field.max !== undefined && numeric > Number(field.max)) return field.rangeError ?? t('validation.max', { max: field.max });
  }
  return field.validate?.(raw, values) ?? null;
}

/**
 * @param {object} config
 *   variant      'default' | 'warning' | 'success' | 'danger'
 *   icon         kit icon file for a default-modal header
 *   title, description
 *   body         optional Node appended under the description
 *   fields       ad-form-modal field specs (text | number)
 *   confirm      { label, icon, className } — omit for a close-only popup
 *   cancel       { label, icon, className } | false
 *   extraActions [{ label, icon, className, onClick }] — footer buttons between confirm and cancel
 *   onConfirm    async (values) => result
 */
export async function openDialog(config) {
  uid += 1;
  const variant = config.variant ?? 'default';
  const isDefault = variant === 'default';
  const titleId = `pricing-dialog-title-${uid}`;
  const formId = `pricing-dialog-form-${uid}`;

  const root = el('div', `modal fade ${isDefault ? 'default-modal' : `popup-${variant}`}`);
  root.tabIndex = -1;
  root.setAttribute('aria-labelledby', titleId);
  root.setAttribute('aria-hidden', 'true');
  if (config.fields?.length || config.confirm) root.setAttribute('data-bs-backdrop', 'static');

  const dialog = el('div', 'modal-dialog modal-dialog-centered');
  const content = el('div', 'modal-content');

  // ── Header ──
  const header = el('div', 'modal-header');
  const title = el(isDefault ? 'h3' : 'h4', '', config.title ?? '');
  title.id = titleId;
  if (isDefault) {
    if (config.icon) {
      const img = el('img', 'icon');
      img.src = iconUrl(config.icon);
      img.alt = '';
      header.appendChild(img);
    }
    header.appendChild(title);
  }
  const close = el('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('aria-label', t('aria.closeDialog'));
  header.appendChild(close);

  // ── Body ──
  const body = el('div', 'modal-body');
  if (!isDefault) {
    const sign = el('div', `status-sign ${variant}`);
    const glyph = el(
      'i',
      { success: 'fa-solid fa-check', danger: 'fa-solid fa-xmark' }[variant] ?? 'fa-solid fa-warning',
    );
    sign.appendChild(glyph);
    body.append(sign, title);
  }
  if (config.description) body.appendChild(el('p', isDefault ? 'pricing-dialog__desc' : '', config.description));
  if (config.body) body.appendChild(config.body);

  const summary = el('div', 'ad-form-error');
  summary.setAttribute('role', 'alert');

  const controls = new Map();
  const errors = new Map();
  let form = null;
  if (config.fields?.length) {
    form = el('form', 'row gy-2 pricing-dialog__form');
    form.id = formId;
    form.noValidate = true;
    config.fields.forEach((field) => {
      const col = el('div', 'col-12');
      const id = `pricing-dialog-${uid}-${field.key}`;
      const label = el('label', '', field.label);
      label.htmlFor = id;
      if (field.required) {
        const star = el('span', 'text-danger', ' *');
        star.setAttribute('aria-hidden', 'true');
        label.appendChild(star);
      }
      const input = el('input', 'form-control');
      input.id = id;
      input.name = field.key;
      input.type = field.type === 'number' ? 'number' : 'text';
      if (field.step !== undefined) input.step = field.step;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.maxLength) input.maxLength = field.maxLength;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.type === 'number') input.classList.add('ad-ltr');
      input.value = field.value ?? '';
      col.append(label, input);
      if (field.hint) col.appendChild(el('span', 'field__hint', field.hint));
      const error = el('span', 'field__error');
      error.id = `${id}-error`;
      error.hidden = true;
      col.appendChild(error);
      input.addEventListener('input', () => {
        error.hidden = true;
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
      });
      controls.set(field.key, input);
      errors.set(field.key, error);
      form.appendChild(col);
    });
    form.prepend(summary);
    body.appendChild(form);
  } else {
    body.appendChild(summary);
  }

  // ── Footer: confirm first, then the way back (kit order) ──
  const footer = el('div', 'modal-footer');
  let confirmBtn = null;
  if (config.confirm) {
    confirmBtn = button(config.confirm.className ?? 'btn-success', config.confirm.icon ?? 'fa-solid fa-floppy-disk', config.confirm.label);
    if (form) {
      confirmBtn.type = 'submit';
      confirmBtn.setAttribute('form', formId);
    }
    footer.appendChild(confirmBtn);
  }
  (config.extraActions ?? []).forEach((action) => {
    const btn = button(action.className, action.icon, action.label);
    btn.addEventListener('click', () => {
      pendingAction = action.onClick;
      hide();
    });
    footer.appendChild(btn);
  });
  if (config.cancel !== false) {
    const cancel = config.cancel ?? (config.confirm
      ? (isDefault
        ? { label: t('common.cancel'), icon: 'fa-solid fa-xmark', className: 'btn-primary-outline' }
        : { label: t('kitPricing.backToReview'), icon: 'fa-solid fa-arrow-left', className: 'btn-warning-outline' })
      : { label: t('common.close'), icon: 'fa-solid fa-xmark', className: variant === 'success' ? 'btn-success' : 'btn-primary-outline' });
    const cancelBtn = button(cancel.className, cancel.icon, cancel.label);
    cancelBtn.addEventListener('click', () => hide());
    footer.appendChild(cancelBtn);
  }

  content.append(header, body, footer);
  dialog.appendChild(content);
  root.appendChild(dialog);
  document.body.appendChild(root);

  let confirmed = false;
  let result;
  let pendingAction = null;
  let instance = null;
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  function values() {
    const out = {};
    controls.forEach((input, key) => {
      out[key] = String(input.value ?? '').trim();
    });
    return out;
  }

  function validate() {
    const current = values();
    let first = null;
    (config.fields ?? []).forEach((field) => {
      const message = fieldError(field, current[field.key] ?? '', current);
      const input = controls.get(field.key);
      const error = errors.get(field.key);
      if (message) {
        error.textContent = message;
        error.hidden = false;
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', error.id);
        first = first ?? input;
      } else {
        error.hidden = true;
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
      }
    });
    first?.focus();
    return !first;
  }

  async function submit() {
    summary.classList.remove('is-visible');
    if (!validate()) return;
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      result = await config.onConfirm?.(values());
      confirmed = true;
      hide();
    } catch (error) {
      summary.textContent = error?.message ?? t('modal.saveFailed');
      summary.classList.add('is-visible');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  if (confirmBtn && !form) confirmBtn.addEventListener('click', () => submit());

  function finish() {
    root.remove();
    document.querySelectorAll('.pricing-dialog-backdrop').forEach((b) => b.remove());
    resolveClosed({ confirmed, result });
    pendingAction?.();
  }

  function hide() {
    if (instance) {
      instance.hide();
    } else {
      document.body.classList.remove('modal-open');
      finish();
    }
  }

  close.addEventListener('click', () => hide());

  try {
    await loadBootstrap();
  } catch {
    /* manual fallback below */
  }

  if (window.bootstrap?.Modal) {
    instance = window.bootstrap.Modal.getOrCreateInstance(root);
    root.addEventListener('shown.bs.modal', () => (controls.values().next().value ?? confirmBtn ?? close).focus(), { once: true });
    root.addEventListener('hidden.bs.modal', () => {
      instance.dispose();
      finish();
    }, { once: true });
    instance.show();
  } else {
    root.classList.add('show');
    root.style.display = 'block';
    root.removeAttribute('aria-hidden');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('role', 'dialog');
    const backdrop = el('div', 'modal-backdrop fade show pricing-dialog-backdrop');
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
  }

  return closed;
}

/**
 * The result of a pricing change. It used to be the kit's popup-success, which
 * the admin had to close; it needs no decision, so it is a toast. A change that
 * went to maker-checker keeps its "View the request" link as the toast action.
 */
export function openSuccess({ title, description, requestId }) {
  document.querySelector('ad-toast-host')?.showToast?.(description || title, 'success', {
    title: description ? title : undefined,
    action: requestId
      ? { label: t('pricingApproval.viewRequest'), href: approvalHref(requestId) }
      : null,
  });
  return Promise.resolve({ confirmed: true });
}
