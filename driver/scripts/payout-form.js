/**
 * payout-form.js — the payout-method form, shared by onboarding step 7 and
 * driver/payout-method.html (payouts spec §2).
 *
 * `mountPayoutForm(host)` renders the form into `host` (light DOM, every string
 * through data-i18n so a language switch re-labels it) and returns a small
 * controller. Data and validation rules live in payout-store.js; this module
 * only draws the fields and shows the errors. Styles: driver/styles/driver.css
 * ("Payout method form").
 */

import { translate, applyTranslations } from '../../shared/scripts/i18n.js';
import { PAYOUT_TYPES, WALLET_PROVIDERS, BANKS, validatePayout } from './payout-store.js';

const ICONS = {
  wallet: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
  bank: '<path d="M3 10 12 4l9 6"/><line x1="5" y1="10" x2="5" y2="18"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="14" y1="10" x2="14" y2="18"/><line x1="19" y1="10" x2="19" y2="18"/><line x1="3" y1="20" x2="21" y2="20"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>',
};

export function payoutIcon(type, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[type] || ICONS.wallet}</svg>`;
}

/** `<span data-i18n>` with the current translation as its text. */
const tx = (key) => `data-i18n="${key}">${translate(key)}`;

function optionsHtml(list, placeholderKey) {
  return [
    `<option value="" disabled selected ${tx(placeholderKey)}</option>`,
    ...list.map((p) => `<option value="${p.id}" ${tx(p.key)}</option>`),
  ].join('');
}

function errorSpan(id) {
  return `<span id="${id}" class="field__error" role="alert" hidden></span>`;
}

export function mountPayoutForm(host, { idPrefix = 'po' } = {}) {
  const id = (name) => `${idPrefix}-${name}`;

  const typeHint = { wallet: 'driver.payout.type.walletHint', bank: 'driver.payout.type.bankHint', card: 'driver.payout.type.cardHint' };
  const typesHtml = Object.entries(PAYOUT_TYPES).map(([type, meta]) => `
    <label class="payout-type">
      <input type="radio" name="${id('type')}" value="${type}" aria-describedby="${id('type-error')}" />
      <span class="icon-tile icon-tile--round payout-type__icon" aria-hidden="true">${payoutIcon(type)}</span>
      <span class="payout-type__text">
        <span class="payout-type__title" ${tx(meta.key)}</span>
        <span class="payout-type__hint" ${tx(typeHint[type])}</span>
      </span>
    </label>`).join('');

  host.innerHTML = `
    <div class="payout-form">
      <fieldset class="payout-types">
        <legend class="field__label payout-types__legend" ${tx('driver.payout.form.typeLabel')}</legend>
        ${typesHtml}
        ${errorSpan(id('type-error'))}
      </fieldset>

      <div class="payout-fields" data-payout-fields="wallet" hidden>
        <div class="field">
          <label class="field__label" for="${id('wallet-provider')}" ${tx('driver.payout.form.provider')}</label>
          <select id="${id('wallet-provider')}" class="input" data-field="provider" aria-required="true" aria-describedby="${id('wallet-provider-error')}">
            ${optionsHtml(WALLET_PROVIDERS, 'driver.payout.form.providerSelect')}
          </select>
          ${errorSpan(id('wallet-provider-error'))}
        </div>
        <div class="field">
          <label class="field__label" for="${id('wallet-number')}" ${tx('driver.payout.form.walletNumber')}</label>
          <input type="tel" id="${id('wallet-number')}" class="input payout-form__number" data-field="number" dir="ltr" inputmode="numeric" maxlength="11" autocomplete="off" data-i18n-placeholder="driver.payout.form.walletPlaceholder" placeholder="${translate('driver.payout.form.walletPlaceholder')}" aria-required="true" aria-describedby="${id('wallet-number-error')}" />
          ${errorSpan(id('wallet-number-error'))}
        </div>
      </div>

      <div class="payout-fields" data-payout-fields="bank" hidden>
        <div class="field">
          <label class="field__label" for="${id('bank-provider')}" ${tx('driver.payout.form.bank')}</label>
          <select id="${id('bank-provider')}" class="input" data-field="provider" aria-required="true" aria-describedby="${id('bank-provider-error')}">
            ${optionsHtml(BANKS, 'driver.payout.form.bankSelect')}
          </select>
          ${errorSpan(id('bank-provider-error'))}
        </div>
        <div class="field">
          <label class="field__label" for="${id('bank-holder')}" ${tx('driver.payout.form.holder')}</label>
          <input type="text" id="${id('bank-holder')}" class="input" data-field="holder" maxlength="100" autocomplete="name" data-i18n-placeholder="driver.payout.form.holderPlaceholder" placeholder="${translate('driver.payout.form.holderPlaceholder')}" aria-required="true" aria-describedby="${id('bank-holder-error')}" />
          ${errorSpan(id('bank-holder-error'))}
        </div>
        <div class="field">
          <label class="field__label" for="${id('bank-number')}" ${tx('driver.payout.form.account')}</label>
          <input type="text" id="${id('bank-number')}" class="input payout-form__number" data-field="number" dir="ltr" maxlength="34" autocomplete="off" autocapitalize="characters" spellcheck="false" data-i18n-placeholder="driver.payout.form.accountPlaceholder" placeholder="${translate('driver.payout.form.accountPlaceholder')}" aria-required="true" aria-describedby="${id('bank-number-hint')} ${id('bank-number-error')}" />
          <span id="${id('bank-number-hint')}" class="field__hint" ${tx('driver.payout.form.accountHint')}</span>
          ${errorSpan(id('bank-number-error'))}
        </div>
      </div>

      <div class="payout-fields" data-payout-fields="card" hidden>
        <div class="field">
          <label class="field__label" for="${id('card-holder')}" ${tx('driver.payout.form.cardName')}</label>
          <input type="text" id="${id('card-holder')}" class="input" data-field="holder" maxlength="100" autocomplete="cc-name" data-i18n-placeholder="driver.payout.form.cardNamePlaceholder" placeholder="${translate('driver.payout.form.cardNamePlaceholder')}" aria-required="true" aria-describedby="${id('card-holder-error')}" />
          ${errorSpan(id('card-holder-error'))}
        </div>
        <div class="field">
          <label class="field__label" for="${id('card-number')}" ${tx('driver.payout.form.cardNumber')}</label>
          <input type="text" id="${id('card-number')}" class="input payout-form__number" data-field="number" dir="ltr" inputmode="numeric" maxlength="19" autocomplete="off" data-i18n-placeholder="driver.payout.form.cardPlaceholder" placeholder="${translate('driver.payout.form.cardPlaceholder')}" aria-required="true" aria-describedby="${id('card-number-error')}" />
          ${errorSpan(id('card-number-error'))}
        </div>
      </div>

      <p class="callout payout-form__explain">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span ${tx('driver.payout.explain')}</span>
      </p>
    </div>`;

  const radios = [...host.querySelectorAll(`input[name="${id('type')}"]`)];
  const groups = [...host.querySelectorAll('[data-payout-fields]')];
  const group = (type) => groups.find((g) => g.dataset.payoutFields === type);
  const errorEl = (type, field) => host.querySelector(`#${id(`${type}-${field}-error`)}`);

  const selectedType = () => radios.find((r) => r.checked)?.value || '';

  function showType(type) {
    groups.forEach((g) => { g.hidden = g.dataset.payoutFields !== type; });
  }

  function setError(el, key) {
    if (!el) return;
    if (key) {
      el.setAttribute('data-i18n', key);
      el.textContent = translate(key);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  radios.forEach((r) => r.addEventListener('change', () => {
    showType(r.value);
    setError(host.querySelector(`#${id('type-error')}`), null);
  }));

  // A field clears its own error as soon as she edits it.
  host.querySelectorAll('[data-field]').forEach((el) => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const g = el.closest('[data-payout-fields]');
      setError(errorEl(g.dataset.payoutFields, el.dataset.field), null);
    });
  });

  function values() {
    const type = selectedType();
    const g = group(type);
    const read = (field) => g?.querySelector(`[data-field="${field}"]`)?.value || '';
    return { type, provider: read('provider'), holder: read('holder'), number: read('number') };
  }

  applyTranslations();

  return {
    /** Validate and show every error. Returns the values when valid, else null. */
    validate() {
      const v = values();
      const { ok, errors } = validatePayout(v.type, v);
      setError(host.querySelector(`#${id('type-error')}`), errors.type || null);
      if (v.type) {
        ['provider', 'holder', 'number'].forEach((f) => setError(errorEl(v.type, f), errors[f] || null));
      }
      if (!ok) {
        const firstField = errors.type ? radios[0] : group(v.type)?.querySelector(
          ['provider', 'holder', 'number'].filter((f) => errors[f]).map((f) => `[data-field="${f}"]`).join(', '),
        );
        firstField?.focus();
        return null;
      }
      return v;
    },

    /** Preselect a type (and provider) — e.g. her current method when she changes it. */
    preset(method) {
      if (!method) return;
      const r = radios.find((x) => x.value === method.type);
      if (!r) return;
      r.checked = true;
      showType(method.type);
      const sel = group(method.type)?.querySelector('[data-field="provider"]');
      if (sel && method.provider) sel.value = method.provider;
      const holder = group(method.type)?.querySelector('[data-field="holder"]');
      if (holder && method.holder) holder.value = method.holder;
    },

    /** Clear every field and error. */
    reset() {
      radios.forEach((r) => { r.checked = false; });
      host.querySelectorAll('[data-field]').forEach((el) => { el.value = ''; });
      host.querySelectorAll('.field__error').forEach((el) => { el.hidden = true; });
      showType('');
    },
  };
}
