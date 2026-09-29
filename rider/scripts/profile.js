import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, getLanguage } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { storage } from '../../shared/scripts/storage.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const session     = auth.getSession();
const phoneInput  = qs('#profile-phone');
const nameInput   = qs('#profile-name');
const emailInput  = qs('#profile-email');
const nameError   = qs('#profile-name-error');
const saveBtn     = qs('#save-btn');
const phoneNote   = qs('#profile-phone-note');
const heroName    = qs('#profile-hero-name');
const heroPhone   = qs('#profile-hero-phone');
const avatar      = qs('#profile-avatar');

// Populate fields. The session holds the national number (01X…); show it the way
// Figma does: +20 without the trunk 0, grouped 3-3-4.
function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^0/, '');
  if (!d) return '';
  return d.length === 10 ? `+20 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : `+20 ${d}`;
}
const displayPhone = formatPhone(session?.phone);
if (phoneInput) phoneInput.value = displayPhone;
const saved = storage.get('shedrive.profile') || {};
if (nameInput)  nameInput.value  = saved.name  || '';
if (emailInput) emailInput.value = saved.email || '';

function updateHero() {
  const name = nameInput?.value?.trim() || '';
  if (heroName) heroName.textContent = name || translate('profile.title');
  if (heroPhone) heroPhone.textContent = displayPhone;
  // Initials avatar: first letter of the saved name (the markup keeps a fallback).
  if (avatar && name) avatar.textContent = Array.from(name)[0].toUpperCase();
}
updateHero();

// Tapping the read-only phone field does not enter edit mode — it shows an explanatory note (#1724).
phoneInput?.addEventListener('click', () => { if (phoneNote) phoneNote.hidden = false; });
phoneInput?.addEventListener('focus', () => { if (phoneNote) phoneNote.hidden = false; });

// Logout — #1853
qs('#profile-logout-btn')?.addEventListener('click', () => {
  auth.logout();
  window.location.replace('./index.html');
});

// Language selector
// storage keeps the language JSON-encoded, so ask i18n rather than reading the raw key.
const currentLang = getLanguage() || 'ar';
qsa('[data-lang]').forEach((btn) => {
  btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === currentLang ? 'true' : 'false');
  btn.classList.toggle('is-active', btn.getAttribute('data-lang') === currentLang);
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    setLanguage(lang);
    qsa('[data-lang]').forEach((b) => {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
      b.classList.toggle('is-active', b.getAttribute('data-lang') === lang);
    });
  });
});

// Save
function showNameError(key) {
  if (!nameError) return;
  nameError.setAttribute('data-i18n', key); // re-renders on a language switch
  nameError.textContent = translate(key);
  nameError.hidden = false;
}

qs('#profile-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (nameInput?.value || '').trim();
  if (!name) {
    showNameError('profile.name.error.empty');
    return;
  }
  if (!/^[\p{L}\s'-]+$/u.test(name)) {
    showNameError('profile.name.error.format');
    return;
  }
  if (name.length < 2 || name.length > 50) {
    showNameError('profile.name.error.length');
    return;
  }
  if (nameError) nameError.hidden = true;
  storage.set('shedrive.profile', { name, email: emailInput?.value?.trim() || '' });
  updateHero();
  showToast(translate('profile.success'), 'success');
});

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
