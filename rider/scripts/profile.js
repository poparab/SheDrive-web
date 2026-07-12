import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
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

// Populate fields
const displayPhone = session?.phone ? `+20 ${session.phone}` : '';
if (phoneInput) phoneInput.value = displayPhone;
const saved = storage.get('shedrive.profile') || {};
if (nameInput)  nameInput.value  = saved.name  || '';
if (emailInput) emailInput.value = saved.email || '';

function updateHero() {
  if (heroName) heroName.textContent = nameInput?.value?.trim() || translate('profile.title');
  if (heroPhone) heroPhone.textContent = displayPhone;
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
const currentLang = localStorage.getItem('shedrive.lang') || 'ar';
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
qs('#profile-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (nameInput?.value || '').trim();
  if (!name) {
    if (nameError) { nameError.textContent = translate('profile.name.error.empty'); nameError.hidden = false; }
    return;
  }
  if (!/^[\p{L}\s'-]+$/u.test(name)) {
    if (nameError) { nameError.textContent = translate('profile.name.error.format'); nameError.hidden = false; }
    return;
  }
  if (name.length < 2 || name.length > 50) {
    if (nameError) { nameError.textContent = translate('profile.name.error.length'); nameError.hidden = false; }
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
