/**
 * saved-places.js — rider saved places (#1724 / API #4475)
 *
 * Saved places are shortcuts, not addresses of record: at most one `home` and one
 * `work`, plus custom labels, to a total of ten. Anything saved here can be picked
 * as a pickup or a destination when she books.
 *
 * Demo switches (query string):
 *   ?state=empty   nothing saved yet
 *   ?state=full    ten places, so the add action is capped
 *   ?state=error   the list request fails
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, applyTranslations } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { storage } from '../../shared/scripts/storage.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const STORAGE_KEY = 'shedrive.savedPlaces';
const MAX_PLACES = 10;
const params = new URLSearchParams(window.location.search);
const demoState = params.get('state');

/* ── Store ──────────────────────────────────────────────────────────────── */

const SEED = [
  { id: 'p1', label: 'home', name: '', address: 'شارع الشيخ زايد، الشيخ زايد، الجيزة' },
  { id: 'p2', label: 'work', name: '', address: 'الرحاب، القاهرة الجديدة، القاهرة' },
  { id: 'p3', label: 'custom', name: 'النادي', address: 'نادي الجزيرة، الزمالك، القاهرة' },
];

function seedFull() {
  return Array.from({ length: MAX_PLACES }, (_, i) => ({
    id: `p${i + 1}`,
    label: i === 0 ? 'home' : i === 1 ? 'work' : 'custom',
    name: i > 1 ? `${translate('savedPlaces.custom')} ${i - 1}` : '',
    address: 'القاهرة، مصر',
  }));
}

function load() {
  if (demoState === 'empty') return [];
  if (demoState === 'full') return seedFull();
  const stored = storage.get(STORAGE_KEY);
  if (Array.isArray(stored)) return stored;
  storage.set(STORAGE_KEY, SEED);
  return SEED.slice();
}

function save(list) {
  places = list;
  if (!demoState) storage.set(STORAGE_KEY, list);
  render();
}

let places = load();

/* ── Elements ───────────────────────────────────────────────────────────── */

const listEl = qs('#places-list');
const emptyEl = qs('#places-empty');
const limitEl = qs('#places-limit');
const errorEl = qs('#places-error');
const bodyEl = qs('#places-body');
const addBtn = qs('#add-place-btn');

const sheet = qs('#place-sheet');
const form = qs('#place-form');
const formTitle = qs('#place-form-title');
const labelInput = qs('#place-label');
const labelField = qs('#custom-label-field');
const labelError = qs('#place-label-error');
const addressInput = qs('#place-address');
const addressError = qs('#place-address-error');

const confirmSheet = qs('#confirm-sheet');
const confirmTitle = qs('#confirm-title');
const confirmMsg = qs('#confirm-msg');
const confirmOk = qs('#confirm-ok');

let editingId = null;
let chosenLabel = 'home';
let onConfirm = null;

/* ── Rendering ──────────────────────────────────────────────────────────── */

const ICONS = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  custom: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
};

/** Home and Work always read first — they are the two she taps most. */
const ORDER = { home: 0, work: 1, custom: 2 };

function displayName(place) {
  if (place.label === 'home') return translate('savedPlaces.home');
  if (place.label === 'work') return translate('savedPlaces.work');
  return place.name || translate('savedPlaces.custom');
}

function render() {
  if (demoState === 'error') {
    if (errorEl) { errorEl.hidden = false; errorEl.setAttribute('aria-hidden', 'false'); }
    if (bodyEl) bodyEl.hidden = true;
    return;
  }

  const sorted = places.slice().sort((a, b) => ORDER[a.label] - ORDER[b.label]);
  const isEmpty = sorted.length === 0;
  const isFull = sorted.length >= MAX_PLACES;

  if (emptyEl) {
    emptyEl.hidden = !isEmpty;
    emptyEl.setAttribute('aria-hidden', String(!isEmpty));
  }
  if (limitEl) {
    limitEl.hidden = !isFull;
    limitEl.setAttribute('aria-hidden', String(!isFull));
  }
  if (addBtn) addBtn.toggleAttribute('disabled', isFull);

  if (!listEl) return;
  listEl.innerHTML = sorted
    .map(
      (p) => `
      <li class="place-card" role="listitem" data-id="${p.id}">
        <span class="place-card__icon place-card__icon--${p.label}" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.label]}</svg>
        </span>
        <span class="place-card__text">
          <span class="place-card__label">${displayName(p)}</span>
          <span class="place-card__address">${p.address}</span>
        </span>
        <span class="place-card__actions">
          <button type="button" class="btn btn--icon place-card__action" data-edit="${p.id}" data-i18n-aria-label="savedPlaces.edit" aria-label="تعديل">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button type="button" class="btn btn--icon place-card__action place-card__action--danger" data-delete="${p.id}" data-i18n-aria-label="savedPlaces.delete" aria-label="حذف">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </span>
      </li>`
    )
    .join('');

  applyTranslations();
}

/* ── Add / edit sheet ───────────────────────────────────────────────────── */

function pickLabel(label) {
  chosenLabel = label;
  qsa('[data-label]').forEach((chip) => {
    const on = chip.getAttribute('data-label') === label;
    chip.setAttribute('aria-pressed', String(on));
    chip.classList.toggle('is-active', on);
  });
  if (labelField) labelField.hidden = label !== 'custom';
}

function openSheet(place) {
  editingId = place?.id ?? null;
  if (formTitle) {
    formTitle.setAttribute('data-i18n', place ? 'savedPlaces.editTitle' : 'savedPlaces.addTitle');
    formTitle.textContent = translate(place ? 'savedPlaces.editTitle' : 'savedPlaces.addTitle');
  }
  pickLabel(place?.label || 'home');
  if (labelInput) labelInput.value = place?.name || '';
  if (addressInput) addressInput.value = place?.address || '';
  if (labelError) labelError.hidden = true;
  if (addressError) addressError.hidden = true;
  sheet?.open();
}

qsa('[data-label]').forEach((chip) =>
  chip.addEventListener('click', () => pickLabel(chip.getAttribute('data-label')))
);

addBtn?.addEventListener('click', () => {
  if (places.length >= MAX_PLACES) {
    showToast(translate('savedPlaces.limitReached'), 'danger');
    return;
  }
  openSheet(null);
});

qs('#place-cancel')?.addEventListener('click', () => sheet?.close());

listEl?.addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
  if (editId) { openSheet(places.find((p) => p.id === editId)); return; }

  const delId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (!delId) return;
  const place = places.find((p) => p.id === delId);
  askConfirm(
    translate('savedPlaces.deleteTitle'),
    translate('savedPlaces.deleteMsg', { place: displayName(place) }),
    () => {
      save(places.filter((p) => p.id !== delId));
      showToast(translate('savedPlaces.deleted'), 'success');
    }
  );
});

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (labelInput?.value || '').trim();
  const address = (addressInput?.value || '').trim();

  if (chosenLabel === 'custom' && !name) {
    if (labelError) { labelError.textContent = translate('savedPlaces.error.label'); labelError.hidden = false; }
    return;
  }
  if (labelError) labelError.hidden = true;

  if (!address) {
    if (addressError) { addressError.textContent = translate('savedPlaces.error.address'); addressError.hidden = false; }
    return;
  }
  if (addressError) addressError.hidden = true;

  // One home and one work, ever. Saving a second replaces the first — after she says so.
  const clash = places.find(
    (p) => p.label === chosenLabel && p.id !== editingId && chosenLabel !== 'custom'
  );
  const commit = () => {
    const kept = places.filter((p) => p.id !== editingId && p.id !== clash?.id);
    const entry = {
      id: editingId || `p${Date.now()}`,
      label: chosenLabel,
      name: chosenLabel === 'custom' ? name : '',
      address,
    };
    save([...kept, entry]);
    sheet?.close();
    showToast(translate('savedPlaces.saved'), 'success');
  };

  if (clash) {
    askConfirm(
      translate('savedPlaces.replaceTitle'),
      translate('savedPlaces.replaceMsg', { place: displayName(clash) }),
      commit
    );
    return;
  }
  commit();
});

/* ── Confirm sheet ──────────────────────────────────────────────────────── */

function askConfirm(title, msg, action) {
  if (confirmTitle) confirmTitle.textContent = title;
  if (confirmMsg) confirmMsg.textContent = msg;
  onConfirm = action;
  confirmSheet?.open();
}

confirmOk?.addEventListener('click', () => {
  confirmSheet?.close();
  onConfirm?.();
  onConfirm = null;
});

qs('#confirm-cancel')?.addEventListener('click', () => {
  confirmSheet?.close();
  onConfirm = null;
});

qs('#places-retry')?.addEventListener('click', () => {
  window.location.search = '';
});

/* ── Toast ──────────────────────────────────────────────────────────────── */

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

document.addEventListener('shedrive:i18n:updated', render);

// sd-bottom-sheet mounts open — both sheets here are modal, so close them on load.
customElements.whenDefined('sd-bottom-sheet').then(() => {
  sheet?.close();
  confirmSheet?.close();
});

render();
