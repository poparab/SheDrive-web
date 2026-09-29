/**
 * history.js — Rider trip history screen controller
 * Auth guard + i18n + paginated trip list + card navigation.
 * Real trip history is served from the API in a future sprint — MOCK_TRIPS
 * stands in for that response so pagination (#1567) can be demoed end-to-end.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, applyTranslations } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// Most-recent-first — id is handed off to trip-detail.html via sessionStorage on tap.
const MOCK_TRIPS = [
  { id: 't1', date: 'الإثنين، ٢ يونيو', pickup: 'موقعي الحالي', destination: 'مدينة نصر — سيتي ستارز', driverName: 'نورا أحمد', avatar: 'ن', vehicle: 'تويوتا كورولا 2023 — أبيض', plate: 'ق أ ب 123', fare: 55, baseFare: 15, distanceFare: 25, timeFare: 15, distanceKm: 8.2, durationMin: 18, rating: { stars: 5, tags: ['complete.tagSafe', 'complete.tagClean'] } },
  { id: 't2', date: 'الأحد، ١ يونيو', pickup: 'موقعي الحالي', destination: 'المعادي — مستشفى السلام', driverName: 'سارة مصطفى', avatar: 'س', vehicle: 'هيونداي إلنترا 2022 — فضي', plate: 'ط ب س 456', fare: 38, baseFare: 15, distanceFare: 15, timeFare: 8, distanceKm: 5.4, durationMin: 12, rating: null },
  { id: 't3', date: 'الجمعة، ٣٠ مايو', pickup: 'الزمالك', destination: 'الجامعة الأمريكية — التحرير', driverName: 'منى حسن', avatar: 'م', vehicle: 'كيا سيراتو 2023 — أسود', plate: 'ن ي ر 789', fare: 62, baseFare: 15, distanceFare: 32, timeFare: 15, distanceKm: 9.8, durationMin: 22, rating: { stars: 4, tags: ['complete.tagFriendly'] } },
  { id: 't4', date: 'الأربعاء، ٢٨ مايو', pickup: 'موقعي الحالي', destination: 'وسط البلد — دار الأوبرا', driverName: 'هبة كمال', avatar: 'ه', vehicle: 'تويوتا كورولا 2023 — أبيض', plate: 'ق أ ب 123', fare: 45, baseFare: 15, distanceFare: 20, timeFare: 10, distanceKm: 6.6, durationMin: 15, rating: { stars: 5, tags: ['complete.tagSafe'] } },
  { id: 't5', date: 'الاثنين، ٢٦ مايو', pickup: 'موقعي الحالي', destination: 'مصر الجديدة — سيتي سنتر ألماظة', driverName: 'رنا سعيد', avatar: 'ر', vehicle: 'نيسان صني 2021 — رمادي', plate: 'س ل م 234', fare: 50, baseFare: 15, distanceFare: 24, timeFare: 11, distanceKm: 7.5, durationMin: 17, rating: null },
  { id: 't6', date: 'السبت، ٢٤ مايو', pickup: 'موقعي الحالي', destination: 'الدقي — ميدان الجيزة', driverName: 'ياسمين علي', avatar: 'ي', vehicle: 'هيونداي إلنترا 2022 — فضي', plate: 'ط ب س 456', fare: 35, baseFare: 15, distanceFare: 14, timeFare: 6, distanceKm: 4.5, durationMin: 10, rating: { stars: 5, tags: ['complete.tagClean', 'complete.tagFriendly'] } },
  { id: 't7', date: 'الخميس، ٢٢ مايو', pickup: 'موقعي الحالي', destination: 'المهندسين — نادي الصيد', driverName: 'دينا محمود', avatar: 'د', vehicle: 'كيا سيراتو 2023 — أسود', plate: 'ن ي ر 789', fare: 40, baseFare: 15, distanceFare: 17, timeFare: 8, distanceKm: 5.9, durationMin: 13, rating: null },
  { id: 't8', date: 'الثلاثاء، ٢٠ مايو', pickup: 'موقعي الحالي', destination: 'حلوان — كورنيش النيل', driverName: 'نهى فتحي', avatar: 'ن', vehicle: 'نيسان صني 2021 — رمادي', plate: 'س ل م 234', fare: 30, baseFare: 15, distanceFare: 10, timeFare: 5, distanceKm: 3.8, durationMin: 9, rating: { stars: 4, tags: ['complete.tagSafe'] } },
];

const PAGE_SIZE = 3;
let renderedCount = 0;

const listEl = qs('#history-list-items');
// <sd-page> is the scroll container (see f7-overrides.css), not the window.
const scroller = qs('sd-page');
const RETURN_KEY = 'shedrive.historyReturn';

const CALENDAR_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>`;

function renderCard(trip) {
  const article = document.createElement('article');
  article.className = 'history-card';
  article.setAttribute('role', 'listitem');

  // The whole card is one link-like control: date, route, fare and driver read as
  // its accessible name, and Enter / Space / tap open the trip detail (#1568).
  article.innerHTML = `
    <div class="history-card__link" role="link" tabindex="0">
      <div class="history-card__meta">
        <span class="history-card__date">${CALENDAR_ICON}<span>${trip.date}</span></span>
        <span class="badge badge--success history-card__status" data-i18n="history.completed">مكتملة</span>
      </div>
      <ol class="route history-card__route">
        <li class="route__stop route__stop--pickup">
          <span class="route__place">${trip.pickup}</span>
          <span class="route__label" data-i18n="home.pickup.label">نقطة الانطلاق</span>
        </li>
        <li class="route__stop route__stop--destination">
          <span class="route__place">${trip.destination}</span>
          <span class="route__label" data-i18n="home.destination.label">الوجهة</span>
        </li>
      </ol>
      <div class="history-card__fare">
        <span class="history-card__amount">${trip.fare} <span data-i18n="home.fare.egp">ج.م.</span></span>
        <span class="history-card__fare-label" data-i18n="history.tripFare">قيمة الرحلة</span>
      </div>
      <div class="history-card__driver">
        <span class="history-card__avatar" aria-hidden="true">${trip.avatar}</span>
        <span class="history-card__driver-name">${trip.driverName}</span>
      </div>
      <svg class="history-card__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `;

  const openDetail = () => {
    sessionStorage.setItem('shedrive.selectedTrip', JSON.stringify(trip));
    // Back from the detail screen returns to the same place in the list (#1568 Scenario 3).
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ count: renderedCount, top: scroller?.scrollTop ?? 0 }));
    window.location.assign('./trip-detail.html');
  };
  const link = article.querySelector('.history-card__link');
  link.addEventListener('click', openDetail);
  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
  });

  return article;
}

function renderNextPage() {
  const next = MOCK_TRIPS.slice(renderedCount, renderedCount + PAGE_SIZE);
  next.forEach((trip) => listEl?.appendChild(renderCard(trip)));
  renderedCount += next.length;
  applyTranslations();
}

/** Keep loading pages until the list overflows the screen — otherwise a tall
 *  viewport shows the whole first page with nothing to scroll, and the next page
 *  could never be reached. */
function fillViewport() {
  while (renderedCount < MOCK_TRIPS.length && scroller && scroller.scrollHeight <= scroller.clientHeight) {
    renderNextPage();
  }
}

// Returning from a trip's detail: restore the pages she had loaded and her scroll position.
let restore = null;
try { restore = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null'); } catch { restore = null; }
sessionStorage.removeItem(RETURN_KEY);

renderNextPage();
while (restore && renderedCount < Math.min(restore.count, MOCK_TRIPS.length)) renderNextPage();

// sd-page injects the stylesheets, so measure only once they have applied —
// before that sd-page has no fixed height and never looks scrollable.
function settle() {
  fillViewport();
  if (restore && scroller) scroller.scrollTop = restore.top;
}
if (document.readyState === 'complete') settle();
else window.addEventListener('load', settle, { once: true });
window.addEventListener('resize', fillViewport, { passive: true });

// ── Pagination: load the next page when the rider nears the bottom (#1567) ──
scroller?.addEventListener('scroll', () => {
  if (renderedCount >= MOCK_TRIPS.length) return;
  const nearBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 200;
  if (nearBottom) renderNextPage();
}, { passive: true });
