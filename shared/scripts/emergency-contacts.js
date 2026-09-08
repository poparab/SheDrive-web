/**
 * emergency-contacts.js — shared Emergency Contacts manager (Phase 1 SOS)
 *
 * Phase 1 SOS is limited to: saving personal emergency contacts and, when SOS is
 * triggered during a trip, alerting those contacts and sharing the user's live
 * location with them. There is no control room and no operations team.
 *
 * Usage:
 *   import { mountEmergencyContacts } from '../../shared/scripts/emergency-contacts.js';
 *   mountEmergencyContacts(document.getElementById('sos-contacts-root'));
 */

import { storage } from './storage.js';
import { translate, I18N_EVENT } from './i18n.js';

export const EMERGENCY_CONTACTS_KEY = 'shedrive.emergencyContacts';

/** Each contact is one paid SMS per alert, so the list is capped. (#1787 / #1951) */
export const MAX_EMERGENCY_CONTACTS = 5;

/**
 * Relationship is a fixed list plus `other`, so what gets stored is a stable key
 * rather than whatever she typed. That is what lets the label follow a language
 * switch; `other` carries her own words alongside it, in `relationshipOther`.
 */
export const RELATIONSHIP_OPTIONS = [
  'mother', 'father', 'sister', 'brother', 'husband',
  'daughter', 'son', 'friend', 'relative', 'colleague', 'other',
];

/**
 * The label to show for a saved contact. Contacts saved before the dropdown
 * existed hold free text, which is not a known key — show that back as she typed it.
 */
export function relationshipLabel(contact) {
  const rel = (contact?.relationship || '').trim();
  if (!rel) return '';
  if (rel === 'other') return (contact.relationshipOther || '').trim() || translate('sos.rel.other');
  if (RELATIONSHIP_OPTIONS.includes(rel)) return translate('sos.rel.' + rel);
  return rel; // legacy free text
}

export function getEmergencyContacts() {
  const list = storage.get(EMERGENCY_CONTACTS_KEY);
  return Array.isArray(list) ? list : [];
}

function saveContacts(list) {
  storage.set(EMERGENCY_CONTACTS_KEY, list);
}

function newId() {
  return (self.crypto?.randomUUID && self.crypto.randomUUID()) || `c${Date.now()}`;
}

function isValidPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10;
}

function icon(name) {
  const icons = {
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    users: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };
  return icons[name] || '';
}

/**
 * Mount the emergency-contacts manager into a container element.
 * Re-renders on language change. Returns a small controller.
 */
export function mountEmergencyContacts(root) {
  if (!root) return null;

  let contacts = getEmergencyContacts();
  let editingId = null; // null = not editing; 'new' or a contact id

  function toast(msg, type = 'info') {
    const host = document.querySelector('sd-toast-host') || document.getElementById('toast-container');
    if (host?.showToast) { host.showToast(msg, type); return; }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.setAttribute('role', 'status');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function contactCard(c) {
    const meta = [relationshipLabel(c), c.phone].filter(Boolean).join(' · ');
    return `
      <li class="sos-contact-card" data-id="${c.id}">
        <span class="sos-contact-card__avatar" aria-hidden="true">${(c.name || '?').trim().charAt(0)}</span>
        <span class="sos-contact-card__info">
          <span class="sos-contact-card__name"></span>
          <span class="sos-contact-card__meta"></span>
        </span>
        <span class="sos-contact-card__actions">
          <button type="button" class="btn btn--icon btn--ghost" data-action="edit" aria-label="${translate('sos.edit')}">${icon('edit')}</button>
          <button type="button" class="btn btn--icon btn--ghost sos-contact-card__remove" data-action="remove" aria-label="${translate('sos.remove')}">${icon('trash')}</button>
        </span>
      </li>`;
  }

  function render() {
    contacts = getEmergencyContacts();
    const hasContacts = contacts.length > 0;
    const atCapacity = contacts.length >= MAX_EMERGENCY_CONTACTS;

    root.innerHTML = `
      <p class="sos-contacts__intro">${translate('sos.intro')}</p>
      <p class="sos-contacts__note" role="note">${translate('sos.liveLocationNote')}</p>

      <h2 class="sos-contacts__section-title">${translate('sos.contactsTitle')}</h2>

      <ul class="sos-contacts__list" role="list">
        ${hasContacts ? contacts.map(contactCard).join('') : ''}
      </ul>

      <div class="sos-contacts__empty" ${hasContacts ? 'hidden' : ''}>
        <span class="sos-contacts__empty-icon" aria-hidden="true">${icon('users')}</span>
        <p class="sos-contacts__empty-title">${translate('sos.empty')}</p>
        <p class="sos-contacts__empty-hint">${translate('sos.emptyHint')}</p>
      </div>

      <button type="button" class="btn btn--primary btn--full sos-contacts__add" id="sos-add-btn"
        ${atCapacity ? 'disabled' : ''}>
        <span aria-hidden="true">${icon('plus')}</span>
        <span>${translate('sos.addContact')}</span>
      </button>
      <p class="sos-contacts__cap-hint" role="note">
        ${atCapacity ? translate('sos.atCapacity') : translate('sos.capHint')}
      </p>

      <form class="sos-contacts__form" id="sos-contact-form" hidden novalidate>
        <div class="field">
          <label class="field__label" for="sos-name">${translate('sos.name')}</label>
          <input type="text" id="sos-name" class="input" placeholder="${translate('sos.namePlaceholder')}" autocomplete="name" />
          <span class="field__error" id="sos-name-error" role="alert" hidden></span>
        </div>
        <div class="field">
          <label class="field__label" for="sos-phone">${translate('sos.phone')}</label>
          <input type="tel" id="sos-phone" class="input" inputmode="tel" placeholder="${translate('sos.phonePlaceholder')}" autocomplete="tel" />
          <span class="field__error" id="sos-phone-error" role="alert" hidden></span>
        </div>
        <div class="field">
          <label class="field__label" for="sos-relationship">${translate('sos.relationship')}</label>
          <select id="sos-relationship" class="input">
            <option value="">${translate('sos.relationshipNone')}</option>
            ${RELATIONSHIP_OPTIONS.map(
              (key) => `<option value="${key}">${translate('sos.rel.' + key)}</option>`,
            ).join('')}
          </select>
        </div>
        <div class="field" id="sos-relationship-other-field" hidden>
          <label class="field__label" for="sos-relationship-other">${translate('sos.relationshipOther')}</label>
          <input type="text" id="sos-relationship-other" class="input" placeholder="${translate('sos.relationshipOtherPlaceholder')}" />
          <span class="field__error" id="sos-relationship-other-error" role="alert" hidden></span>
        </div>
        <div class="sos-contacts__form-actions">
          <button type="button" class="btn btn--ghost btn--full" id="sos-form-cancel">${translate('sos.cancel')}</button>
          <button type="submit" class="btn btn--primary btn--full" id="sos-form-save">${translate('sos.save')}</button>
        </div>
      </form>

      <div class="sos-contacts__public">
        <p class="sos-contacts__public-label">${translate('sos.publicLabel')}</p>
        <div class="sos-contacts__public-row">
          <a href="tel:122" class="sos-contacts__public-item">
            <span class="sos-contacts__public-name">${translate('sos.police')}</span>
            <span class="sos-contacts__public-num">122</span>
          </a>
          <a href="tel:123" class="sos-contacts__public-item">
            <span class="sos-contacts__public-name">${translate('sos.ambulance')}</span>
            <span class="sos-contacts__public-num">123</span>
          </a>
        </div>
        <p class="sos-contacts__public-note">${translate('sos.publicNote')}</p>
      </div>
    `;

    // Fill contact name/meta safely as text (avoid HTML injection from stored names)
    root.querySelectorAll('.sos-contact-card').forEach((el) => {
      const c = contacts.find((x) => x.id === el.dataset.id);
      if (!c) return;
      el.querySelector('.sos-contact-card__name').textContent = c.name || '';
      el.querySelector('.sos-contact-card__meta').textContent =
        [relationshipLabel(c), c.phone].filter(Boolean).join(' · ');
    });

    wire();

    // Re-open the form if we were mid add/edit
    if (editingId) openForm(editingId);
  }

  function openForm(id) {
    editingId = id;
    const form = root.querySelector('#sos-contact-form');
    const addBtn = root.querySelector('#sos-add-btn');
    if (!form) return;
    form.hidden = false;
    if (addBtn) addBtn.hidden = true;

    const nameEl = form.querySelector('#sos-name');
    const phoneEl = form.querySelector('#sos-phone');
    const relEl = form.querySelector('#sos-relationship');
    const relOtherEl = form.querySelector('#sos-relationship-other');

    if (id !== 'new') {
      const c = contacts.find((x) => x.id === id);
      if (c) {
        nameEl.value = c.name || '';
        phoneEl.value = c.phone || '';
        const rel = (c.relationship || '').trim();
        const known = !rel || RELATIONSHIP_OPTIONS.includes(rel);
        // A legacy free-text relationship reopens as `other`, with her words intact.
        relEl.value = known ? rel : 'other';
        relOtherEl.value = rel === 'other' ? (c.relationshipOther || '') : (known ? '' : rel);
      }
    } else {
      nameEl.value = '';
      phoneEl.value = '';
      relEl.value = '';
      relOtherEl.value = '';
    }
    syncRelationshipOther();
    nameEl.focus();
  }

  /** The free-text box exists only while `Other` is the selected relationship. */
  function syncRelationshipOther() {
    const relEl = root.querySelector('#sos-relationship');
    const field = root.querySelector('#sos-relationship-other-field');
    if (!relEl || !field) return;
    const isOther = relEl.value === 'other';
    field.hidden = !isOther;
    if (!isOther) clearError('#sos-relationship-other-error', '#sos-relationship-other');
  }

  function closeForm() {
    editingId = null;
    const form = root.querySelector('#sos-contact-form');
    const addBtn = root.querySelector('#sos-add-btn');
    if (form) form.hidden = true;
    if (addBtn) addBtn.hidden = false;
    clearError('#sos-name-error', '#sos-name');
    clearError('#sos-phone-error', '#sos-phone');
    clearError('#sos-relationship-other-error', '#sos-relationship-other');
  }

  function showError(errorSel, inputSel, msg) {
    const err = root.querySelector(errorSel);
    const input = root.querySelector(inputSel);
    if (err) { err.textContent = msg; err.hidden = false; }
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function clearError(errorSel, inputSel) {
    const err = root.querySelector(errorSel);
    const input = root.querySelector(inputSel);
    if (err) { err.textContent = ''; err.hidden = true; }
    if (input) input.removeAttribute('aria-invalid');
  }

  function submitForm() {
    const nameEl = root.querySelector('#sos-name');
    const phoneEl = root.querySelector('#sos-phone');
    const relEl = root.querySelector('#sos-relationship');
    const relOtherEl = root.querySelector('#sos-relationship-other');
    const name = (nameEl?.value || '').trim();
    const phone = (phoneEl?.value || '').trim();
    const relationship = (relEl?.value || '').trim();
    const relationshipOther = (relOtherEl?.value || '').trim();

    let ok = true;
    clearError('#sos-name-error', '#sos-name');
    clearError('#sos-phone-error', '#sos-phone');
    clearError('#sos-relationship-other-error', '#sos-relationship-other');
    if (!name) { showError('#sos-name-error', '#sos-name', translate('sos.errorName')); ok = false; }
    if (!isValidPhone(phone)) { showError('#sos-phone-error', '#sos-phone', translate('sos.errorPhone')); ok = false; }
    // Relationship stays optional, but "Other" on its own says nothing, so if she
    // picks it she has to say what it is.
    if (relationship === 'other' && !relationshipOther) {
      showError('#sos-relationship-other-error', '#sos-relationship-other', translate('sos.errorRelationshipOther'));
      ok = false;
    }
    if (!ok) return;

    const list = getEmergencyContacts();

    // Adding (not editing) a contact when already at capacity is rejected. (#1787 S1)
    const isAdding = !editingId || editingId === 'new';
    if (isAdding && list.length >= MAX_EMERGENCY_CONTACTS) {
      toast(translate('sos.atCapacity'), 'danger');
      return;
    }

    if (editingId && editingId !== 'new') {
      const idx = list.findIndex((c) => c.id === editingId);
      if (idx >= 0) list[idx] = { ...list[idx], name, phone, relationship, relationshipOther };
    } else {
      list.push({ id: newId(), name, phone, relationship, relationshipOther });
    }
    saveContacts(list);
    contacts = list;
    editingId = null;
    render();
    toast(translate('sos.savedToast'), 'success');
  }

  function removeContact(id) {
    const list = getEmergencyContacts().filter((c) => c.id !== id);
    saveContacts(list);
    contacts = list;
    render();
    toast(translate('sos.removedToast'), 'success');
  }

  function wire() {
    root.querySelector('#sos-add-btn')?.addEventListener('click', () => openForm('new'));
    root.querySelector('#sos-form-cancel')?.addEventListener('click', closeForm);
    root.querySelector('#sos-relationship')?.addEventListener('change', syncRelationshipOther);
    root.querySelector('#sos-contact-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm();
    });
    root.querySelectorAll('.sos-contact-card').forEach((el) => {
      const id = el.dataset.id;
      el.querySelector('[data-action="edit"]')?.addEventListener('click', () => openForm(id));
      el.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        if (window.confirm(translate('sos.removeConfirm'))) removeContact(id);
      });
    });
  }

  render();
  document.addEventListener(I18N_EVENT, render);

  return { render, getContacts: getEmergencyContacts };
}
