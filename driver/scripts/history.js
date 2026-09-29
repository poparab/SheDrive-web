/**
 * history.js — Driver trip history screen controller (#1593)
 * Auth guard + i18n + bilingual trip rows + navigation to the trip detail.
 *
 * Demo only: ?state=empty | loading
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const state = new URLSearchParams(location.search).get('state');
if (state) document.body.dataset.state = state;

// ── Mock data — completed trips only, most recent first. Fares are net (#1766). ──
// The ids match the trips scripts/trip-detail.js knows about.
const TRIPS = [
  { id: 'h1', date: { ar: 'الإثنين، 2 يونيو', en: 'Mon, June 2' }, from: { ar: 'المعادي', en: 'Maadi' },            to: { ar: 'مدينة نصر — سيتي ستارز', en: 'Nasr City — City Stars' },   rider: { ar: 'نور أحمد', en: 'Nour Ahmed' },     net: 52 },
  { id: 'h2', date: { ar: 'الأحد، 1 يونيو',   en: 'Sun, June 1' }, from: { ar: 'الزمالك', en: 'Zamalek' },          to: { ar: 'المعادي — مستشفى السلام', en: 'Maadi — Al Salam Hospital' }, rider: { ar: 'سارة مصطفى', en: 'Sara Mostafa' }, net: 30 },
  { id: 'h3', date: { ar: 'الجمعة، 30 مايو',  en: 'Fri, May 30' }, from: { ar: 'الزمالك', en: 'Zamalek' },          to: { ar: 'القاهرة الجديدة', en: 'New Cairo' },                     rider: { ar: 'منى حسن', en: 'Mona Hassan' },     net: 68 },
  { id: 'h4', date: { ar: 'الخميس، 29 مايو',  en: 'Thu, May 29' }, from: { ar: 'الرحاب', en: 'El Rehab' },          to: { ar: 'الجامعة الأمريكية، التجمع', en: 'AUC, New Cairo' },         rider: { ar: 'نسمة علي', en: 'Nesma Ali' },       net: 45 },
  { id: 'h5', date: { ar: 'الأربعاء، 28 مايو', en: 'Wed, May 28' }, from: { ar: 'المقطم', en: 'Mokattam' },         to: { ar: 'الحي 11، مدينة نصر', en: '11th District, Nasr City' },     rider: { ar: 'ماجدة سمير', en: 'Magda Samir' },   net: 38 },
  { id: 'h6', date: { ar: 'الثلاثاء، 27 مايو', en: 'Tue, May 27' }, from: { ar: 'الشيخ زايد', en: 'Sheikh Zayed' }, to: { ar: 'مطار القاهرة الدولي', en: 'Cairo International Airport' }, rider: { ar: 'كريمة يوسف', en: 'Karima Youssef' }, net: 184 },
];

const ICON_CALENDAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_CHEVRON = '<svg class="dhistory-card__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

function esc(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function render() {
  const list = qs('#dhistory-list');
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const egp = translate('driver.currency');

  list.innerHTML = TRIPS.map((t) => `
    <a class="dhistory-card" href="./trip-detail.html?id=${t.id}"
       aria-label="${esc(`${t.date[lang]} — ${t.to[lang]} — ${t.net} ${egp}`)}">
      <div class="dhistory-card__top">
        <span class="dhistory-card__date">${ICON_CALENDAR}<span>${esc(t.date[lang])}</span></span>
        <span class="badge badge--success dhistory-card__status" data-i18n="driver.history.completed">${translate('driver.history.completed')}</span>
      </div>
      <div class="dhistory-card__main">
        <ol class="route dhistory-card__route">
          <li class="route__stop route__stop--pickup">
            <span class="route__place">${esc(t.from[lang])}</span>
            <span class="route__label" data-i18n="home.pickup.label">${translate('home.pickup.label')}</span>
          </li>
          <li class="route__stop route__stop--destination">
            <span class="route__place">${esc(t.to[lang])}</span>
            <span class="route__label" data-i18n="home.destination.label">${translate('home.destination.label')}</span>
          </li>
        </ol>
        <div class="dhistory-card__side">
          <span class="dhistory-card__fare"><bdi>${t.net}</bdi> ${egp}</span>
          <span class="dhistory-card__fare-net-label" data-i18n="earnings.net">${translate('earnings.net')}</span>
          <span class="dhistory-card__rider">
            <span class="avatar dhistory-card__avatar" aria-hidden="true">${esc(t.rider[lang].charAt(0))}</span>
            <span class="dhistory-card__rider-name">${esc(t.rider[lang].split(' ')[0])}</span>
          </span>
        </div>
        ${ICON_CHEVRON}
      </div>
    </a>
  `).join('');
}

render();
document.addEventListener(I18N_EVENT, render);

// ── Back from a trip detail lands at the same scroll position (#1594 S3) ──
// <sd-page> is the scroll container, so the browser won't restore it by itself.
const SCROLL_KEY = 'shedrive.driverHistoryScroll';
const scroller = document.querySelector('sd-page');

qs('#dhistory-list').addEventListener('click', (e) => {
  if (!e.target.closest('.dhistory-card')) return;
  try { sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop)); } catch { /* storage off */ }
});

const nav = performance.getEntriesByType('navigation')[0];
const fromDetail = /\/trip-detail\.html/.test(document.referrer);
if ((nav && nav.type === 'back_forward') || fromDetail) {
  try {
    const top = Number(sessionStorage.getItem(SCROLL_KEY));
    if (top > 0) scroller.scrollTop = top;
  } catch { /* storage off */ }
}
