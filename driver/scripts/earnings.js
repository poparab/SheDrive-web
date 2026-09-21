/**
 * earnings.js — Driver earnings & trip history screen controller
 * Mock data for trips, period filter tabs, expandable breakdown rows.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')));
});

// ── Mock data ─────────────────────────────────────────
// Routes and times are bilingual so the list reads correctly in both languages.
const P = {
  maadi:       { ar: 'المعادي',     en: 'Maadi' },
  nasrCity:    { ar: 'مدينة نصر',   en: 'Nasr City' },
  tagamoa:     { ar: 'التجمع',      en: 'New Cairo' },
  heliopolis:  { ar: 'مصر الجديدة', en: 'Heliopolis' },
  zamalek:     { ar: 'الزمالك',     en: 'Zamalek' },
  mokattam:    { ar: 'المقطم',      en: 'Mokattam' },
  helwan:      { ar: 'حلوان',       en: 'Helwan' },
  downtown:    { ar: 'وسط البلد',   en: 'Downtown' },
  dokki:       { ar: 'الدقي',       en: 'Dokki' },
  katameya:    { ar: 'القطامية',    en: 'Katameya' },
  shorouk:     { ar: 'الشروق',      en: 'Shorouk' },
  abbassia:    { ar: 'العباسية',    en: 'Abbassia' },
  mohandessin: { ar: 'المهندسين',   en: 'Mohandessin' },
  haram:       { ar: 'الهرم',       en: 'Haram' },
  rehab:       { ar: 'الرحاب',      en: 'Rehab' },
};

const MOCK_TRIPS = {
  today: [
    { id: 1, time: { ar: '09:15', en: '09:15' }, from: P.maadi,    to: P.nasrCity,    minutes: 22, fare: 65,  base: 40, distance: 15, timeComp: 10 },
    { id: 2, time: { ar: '10:45', en: '10:45' }, from: P.tagamoa,  to: P.heliopolis,  minutes: 30, fare: 88,  base: 50, distance: 25, timeComp: 13 },
    { id: 3, time: { ar: '12:30', en: '12:30' }, from: P.zamalek,  to: P.mokattam,    minutes: 18, fare: 52,  base: 35, distance: 12, timeComp: 5  },
    { id: 4, time: { ar: '14:00', en: '14:00' }, from: P.helwan,   to: P.downtown,    minutes: 35, fare: 95,  base: 55, distance: 28, timeComp: 12 },
    { id: 5, time: { ar: '16:20', en: '16:20' }, from: P.dokki,    to: P.katameya,    minutes: 45, fare: 120, base: 70, distance: 35, timeComp: 15 },
    { id: 6, time: { ar: '18:55', en: '18:55' }, from: P.shorouk,  to: P.maadi,       minutes: 28, fare: 80,  base: 48, distance: 22, timeComp: 10 },
  ],
  week: [
    { id: 7, time: { ar: 'السبت 11:00', en: 'Sat 11:00' }, from: P.abbassia, to: P.mohandessin, minutes: 25, fare: 72,  base: 45, distance: 18, timeComp: 9  },
    { id: 8, time: { ar: 'الأحد 09:30', en: 'Sun 09:30' }, from: P.nasrCity, to: P.haram,       minutes: 40, fare: 110, base: 65, distance: 32, timeComp: 13 },
  ],
  month: [
    { id: 9,  time: { ar: '1 مايو', en: '1 May' }, from: P.rehab,   to: P.maadi,   minutes: 50, fare: 140, base: 85, distance: 42, timeComp: 15 },
    { id: 10, time: { ar: '5 مايو', en: '5 May' }, from: P.tagamoa, to: P.zamalek, minutes: 38, fare: 105, base: 60, distance: 30, timeComp: 15 },
  ],
};

const PERIOD_SUMMARY = {
  today: { amount: 500, trips: 6, hours: 4.5 },
  week:  { amount: 3200, trips: 38, hours: 28 },
  month: { amount: 12500, trips: 147, hours: 110 },
};

// ── Render ────────────────────────────────────────────
let activePeriod = 'today';

function renderSummary(period) {
  const s = PERIOD_SUMMARY[period];
  qs('#summary-amount').textContent = s.amount;
  qs('#summary-trips').textContent  = s.trips;
  qs('#summary-hours').textContent  = s.hours;
}

function renderTrips(period) {
  const list = qs('#trips-list');
  const empty = qs('#earnings-empty');
  const trips = MOCK_TRIPS[period] || [];

  if (trips.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.setAttribute('aria-hidden', 'false');
    return;
  }

  empty.hidden = true;
  empty.setAttribute('aria-hidden', 'true');

  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const arrow = lang === 'ar' ? '←' : '→';
  const egp = translate('driver.currency');
  const min = translate('trip.minutes');

  list.innerHTML = trips.map((t) => `
    <article class="trip-item" data-trip-id="${t.id}">
      <div class="trip-item__summary" role="button" tabindex="0" aria-expanded="false" aria-label="${t.from[lang]} ${arrow} ${t.to[lang]}">
        <div class="trip-item__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div class="trip-item__info">
          <div class="trip-item__route">${t.from[lang]} ${arrow} ${t.to[lang]}</div>
          <div class="trip-item__meta">
            <span>${t.time[lang]}</span>
            <span>·</span>
            <span class="badge badge--neutral">${t.minutes} ${min}</span>
          </div>
        </div>
        <div class="trip-item__right">
          <span class="trip-item__fare badge badge--success">+${t.fare} ${egp}</span>
          <svg class="trip-item__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      <div class="trip-item__detail" aria-hidden="true">
        <ul class="trip-item__breakdown">
          <li><span data-i18n="earnings.baseFare">${translate('earnings.baseFare')}</span><strong>${t.base} ${egp}</strong></li>
          <li><span data-i18n="earnings.distanceFare">${translate('earnings.distanceFare')}</span><strong>${t.distance} ${egp}</strong></li>
          <li><span data-i18n="earnings.timeFare">${translate('earnings.timeFare')}</span><strong>${t.timeComp} ${egp}</strong></li>
        </ul>
      </div>
    </article>
  `).join('');

  // Expand/collapse
  list.querySelectorAll('.trip-item__summary').forEach((summary) => {
    summary.addEventListener('click', () => {
      const item = summary.closest('.trip-item');
      const detail = item.querySelector('.trip-item__detail');
      const expanded = item.classList.toggle('is-expanded');
      summary.setAttribute('aria-expanded', String(expanded));
      detail.setAttribute('aria-hidden', String(!expanded));
    });

    summary.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        summary.click();
      }
    });
  });
}

// ── Tab switching ─────────────────────────────────────
document.querySelectorAll('.earnings-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.earnings-tab').forEach((t) => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    activePeriod = tab.dataset.period;
    renderSummary(activePeriod);
    renderTrips(activePeriod);
  });
});

// ── Initial render ────────────────────────────────────
renderSummary(activePeriod);
renderTrips(activePeriod);

// Re-render the rows on a language switch — routes, units and currency all change.
document.addEventListener(I18N_EVENT, () => renderTrips(activePeriod));

// ── Toast helper ─────────────────────────────────────
const toastContainer = qs('#toast-container');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
