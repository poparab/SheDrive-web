/**
 * history.js — Rider trip history screen controller
 * Auth guard + i18n + paginated trip list + card navigation.
 * Real trip history is served from the API in a future sprint — MOCK_TRIPS
 * stands in for that response so pagination (#1567) can be demoed end-to-end.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
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

function renderCard(trip) {
  const article = document.createElement('article');
  article.className = 'history-card';
  article.setAttribute('role', 'option');
  article.tabIndex = 0;
  article.setAttribute('aria-label', `رحلة — ${trip.date}`);
  article.setAttribute('data-i18n-aria-label', 'aria.history.tripCard');
  article.innerHTML = `
    <div class="history-card__meta">
      <span class="history-card__date">${trip.date}</span>
      <span class="badge badge--success history-card__status" data-i18n="history.completed">مكتملة</span>
    </div>
    <div class="history-card__body">
      <div class="history-card__route">
        <span class="history-card__dot history-card__dot--green" aria-hidden="true"></span>
        <span class="history-card__destination">${trip.destination}</span>
      </div>
      <div class="history-card__footer">
        <div class="history-card__driver">
          <span class="history-card__avatar" aria-hidden="true">${trip.avatar}</span>
          <span class="history-card__driver-name">${trip.driverName}</span>
        </div>
        <span class="history-card__fare">${trip.fare} ج.م.</span>
      </div>
    </div>
    <svg class="history-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;

  const openDetail = () => {
    sessionStorage.setItem('shedrive.selectedTrip', JSON.stringify(trip));
    window.location.assign('./trip-detail.html');
  };
  article.addEventListener('click', openDetail);
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
  });

  return article;
}

function renderNextPage() {
  const next = MOCK_TRIPS.slice(renderedCount, renderedCount + PAGE_SIZE);
  next.forEach((trip) => listEl?.appendChild(renderCard(trip)));
  renderedCount += next.length;
}

renderNextPage();

// ── Pagination: load the next page when the rider nears the bottom (#1567) ──
window.addEventListener('scroll', () => {
  if (renderedCount >= MOCK_TRIPS.length) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
  if (nearBottom) renderNextPage();
});
