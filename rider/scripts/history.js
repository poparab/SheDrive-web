/**
 * history.js — Rider trip history screen controller
 * Auth guard + i18n + period tabs + paginated trip list + card navigation (#1567).
 * Real trip history is served from the API (#5912) — MOCK_TRIPS stands in for that
 * response, dated relative to today so every tab has trips to show.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, applyTranslations, getLanguage, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Periods are Cairo calendar days; a week starts on Saturday (#1567, #5912) ──
const TIME_ZONE = 'Africa/Cairo';

/** Today's date in Cairo, as a UTC-midnight Date (so day arithmetic never crosses a DST edge). */
function cairoToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
}

const TODAY = cairoToday();
const DAYS_SINCE_SATURDAY = (TODAY.getUTCDay() + 1) % 7; // Sat = 0 … Fri = 6
const DAYS_SINCE_MONTH_START = TODAY.getUTCDate() - 1;

/** How many days back each tab reaches (0 = today only). */
const PERIOD_REACH = {
  today: 0,
  week: DAYS_SINCE_SATURDAY,
  month: DAYS_SINCE_MONTH_START,
};

// Completed trips only, newest first. `daysAgo` + `time` place each one on a Cairo
// day; places and names carry both languages so a language switch relabels the list.
const MOCK_TRIPS = [
  { id: 't1', daysAgo: 0, time: '18:40', pickup: { ar: 'الشيخ زايد، الجيزة', en: 'Sheikh Zayed City, Giza' }, destination: { ar: 'مطار القاهرة الدولي', en: 'Cairo International Airport' }, driver: { ar: 'نورا', en: 'Noura' }, vehicle: 'تويوتا كورولا 2023 — أبيض', fare: 650, baseFare: 15, distanceFare: 520, timeFare: 115, distanceKm: 48.6, durationMin: 62, rating: { stars: 5, tags: ['complete.tagSafe', 'complete.tagClean'] } },
  { id: 't2', daysAgo: 0, time: '09:15', pickup: { ar: 'المقطم، القاهرة', en: 'Al-Mokattam, Cairo' }, destination: { ar: 'الحي الحادي عشر، مدينة نصر', en: '11th District, Nasr City' }, driver: { ar: 'ماجدة', en: 'Magda' }, vehicle: 'هيونداي إلنترا 2022 — فضي', fare: 126, baseFare: 15, distanceFare: 86, timeFare: 25, distanceKm: 11.4, durationMin: 24, rating: null },
  { id: 't3', daysAgo: 1, time: '20:05', pickup: { ar: 'مدينة نصر، القاهرة', en: 'Nasr City, Cairo' }, destination: { ar: 'الحي السابع، ٦ أكتوبر', en: '7th District, 6th of October' }, driver: { ar: 'كريمة', en: 'Karima' }, vehicle: 'كيا سيراتو 2023 — أسود', fare: 338, baseFare: 15, distanceFare: 268, timeFare: 55, distanceKm: 36.2, durationMin: 51, rating: { stars: 4, tags: ['complete.tagFriendly'] } },
  { id: 't4', daysAgo: 2, time: '13:30', pickup: { ar: 'الرحاب، القاهرة الجديدة', en: 'El-Rehab, New Cairo' }, destination: { ar: 'الجامعة الأمريكية، القاهرة الجديدة', en: 'American University, New Cairo' }, driver: { ar: 'نسمة', en: 'Nesma' }, vehicle: 'تويوتا كورولا 2023 — أبيض', fare: 65, baseFare: 15, distanceFare: 38, timeFare: 12, distanceKm: 6.1, durationMin: 14, rating: { stars: 5, tags: ['complete.tagSafe'] } },
  { id: 't5', daysAgo: 4, time: '17:50', pickup: { ar: 'جنة، القاهرة الجديدة', en: 'Janna, New Cairo' }, destination: { ar: 'نادي وادي دجلة، القاهرة الجديدة', en: 'Wadi Degla Club, New Cairo' }, driver: { ar: 'لارا', en: 'Lara' }, vehicle: 'نيسان صني 2021 — رمادي', fare: 86, baseFare: 15, distanceFare: 56, timeFare: 15, distanceKm: 8.3, durationMin: 19, rating: null },
  { id: 't6', daysAgo: 6, time: '11:20', pickup: { ar: 'الزمالك، القاهرة', en: 'Zamalek, Cairo' }, destination: { ar: 'وسط البلد، القاهرة', en: 'Downtown, Cairo' }, driver: { ar: 'هبة', en: 'Heba' }, vehicle: 'هيونداي إلنترا 2022 — فضي', fare: 54, baseFare: 15, distanceFare: 29, timeFare: 10, distanceKm: 4.2, durationMin: 13, rating: { stars: 5, tags: ['complete.tagClean', 'complete.tagFriendly'] } },
  { id: 't7', daysAgo: 8, time: '08:45', pickup: { ar: 'المعادي، القاهرة', en: 'Maadi, Cairo' }, destination: { ar: 'مصر الجديدة، القاهرة', en: 'Heliopolis, Cairo' }, driver: { ar: 'سارة', en: 'Sara' }, vehicle: 'كيا سيراتو 2023 — أسود', fare: 142, baseFare: 15, distanceFare: 99, timeFare: 28, distanceKm: 17.5, durationMin: 32, rating: null },
  { id: 't8', daysAgo: 10, time: '19:10', pickup: { ar: 'الدقي، الجيزة', en: 'Dokki, Giza' }, destination: { ar: 'المهندسين، الجيزة', en: 'Mohandessin, Giza' }, driver: { ar: 'منى', en: 'Mona' }, vehicle: 'تويوتا كورولا 2023 — أبيض', fare: 48, baseFare: 15, distanceFare: 24, timeFare: 9, distanceKm: 3.6, durationMin: 11, rating: { stars: 4, tags: ['complete.tagSafe'] } },
  { id: 't9', daysAgo: 13, time: '16:25', pickup: { ar: 'الهرم، الجيزة', en: 'Al-Haram, Giza' }, destination: { ar: 'مول مصر، ٦ أكتوبر', en: 'Mall of Egypt, 6th of October' }, driver: { ar: 'رنا', en: 'Rana' }, vehicle: 'نيسان صني 2021 — رمادي', fare: 175, baseFare: 15, distanceFare: 128, timeFare: 32, distanceKm: 19.8, durationMin: 34, rating: { stars: 5, tags: ['complete.tagFriendly'] } },
  { id: 't10', daysAgo: 15, time: '10:00', pickup: { ar: 'شبرا، القاهرة', en: 'Shubra, Cairo' }, destination: { ar: 'جامعة القاهرة، الجيزة', en: 'Cairo University, Giza' }, driver: { ar: 'ياسمين', en: 'Yasmin' }, vehicle: 'هيونداي إلنترا 2022 — فضي', fare: 97, baseFare: 15, distanceFare: 64, timeFare: 18, distanceKm: 12.1, durationMin: 27, rating: null },
  { id: 't11', daysAgo: 17, time: '21:35', pickup: { ar: 'التجمع الخامس، القاهرة الجديدة', en: 'Fifth Settlement, New Cairo' }, destination: { ar: 'سيتي ستارز، مدينة نصر', en: 'City Stars, Nasr City' }, driver: { ar: 'دينا', en: 'Dina' }, vehicle: 'كيا سيراتو 2023 — أسود', fare: 118, baseFare: 15, distanceFare: 80, timeFare: 23, distanceKm: 14.7, durationMin: 26, rating: { stars: 5, tags: ['complete.tagSafe', 'complete.tagClean'] } },
  { id: 't12', daysAgo: 24, time: '12:15', pickup: { ar: 'حلوان، القاهرة', en: 'Helwan, Cairo' }, destination: { ar: 'المعادي، القاهرة', en: 'Maadi, Cairo' }, driver: { ar: 'نهى', en: 'Noha' }, vehicle: 'نيسان صني 2021 — رمادي', fare: 72, baseFare: 15, distanceFare: 45, timeFare: 12, distanceKm: 9.4, durationMin: 18, rating: null },
];

const tripsFor = (period) => MOCK_TRIPS.filter((trip) => trip.daysAgo <= PERIOD_REACH[period]);

/** The trip's Cairo date and time as a UTC Date — format it with timeZone 'UTC'. */
function tripMoment(trip) {
  const [h, m] = trip.time.split(':').map(Number);
  return new Date(TODAY.getTime() - trip.daysAgo * 86400000 + (h * 60 + m) * 60000);
}

const locale = () => (getLanguage() === 'ar' ? 'ar-EG' : 'en-US');

/** Card date, as Figma draws it: "Mon, June 8". */
function cardDate(trip) {
  return new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', weekday: 'short', month: 'long', day: 'numeric' }).format(tripMoment(trip));
}

/** Detail date: full date and time, for trip-detail.html. */
function detailDate(trip) {
  return new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(tripMoment(trip));
}

const PAGE_SIZE = 3;
const PERIODS = ['today', 'week', 'month'];
let period = 'today';
let renderedCount = 0;

const listEl = qs('#history-list-items');
const tabs = qsa('.history-tab');
const panel = qs('#history-panel');
// <sd-page> is the scroll container (see f7-overrides.css), not the window.
const scroller = qs('sd-page');
const RETURN_KEY = 'shedrive.historyReturn';
// ?state=empty | loading is a designer preview — it wins over the real tab state.
const demoState = new URLSearchParams(location.search).get('state');

const CALENDAR_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>`;

function renderCard(trip) {
  const lang = getLanguage();
  const driverName = trip.driver[lang];
  const article = document.createElement('article');
  article.className = 'history-card';
  article.setAttribute('role', 'listitem');

  // The whole card is one link-like control: date, route, fare and driver read as
  // its accessible name, and Enter / Space / tap open the trip detail (#1568).
  article.innerHTML = `
    <div class="history-card__link" role="link" tabindex="0">
      <div class="history-card__meta">
        <span class="history-card__date">${CALENDAR_ICON}<span>${cardDate(trip)}</span></span>
        <span class="badge badge--success history-card__status" data-i18n="history.completed">مكتملة</span>
      </div>
      <ol class="route history-card__route">
        <li class="route__stop route__stop--pickup">
          <span class="route__place">${trip.pickup[lang]}</span>
          <span class="route__label" data-i18n="home.pickup.label">نقطة الانطلاق</span>
        </li>
        <li class="route__stop route__stop--destination">
          <span class="route__place">${trip.destination[lang]}</span>
          <span class="route__label" data-i18n="home.destination.label">الوجهة</span>
        </li>
      </ol>
      <div class="history-card__fare">
        <span class="history-card__amount">${trip.fare} <span data-i18n="home.fare.egp">ج.م.</span></span>
        <span class="history-card__fare-label" data-i18n="history.tripFare">قيمة الرحلة</span>
      </div>
      <div class="history-card__driver">
        <span class="history-card__avatar" aria-hidden="true">${driverName.charAt(0)}</span>
        <span class="history-card__driver-name">${driverName}</span>
      </div>
      <svg class="history-card__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `;

  const openDetail = () => {
    // trip-detail.html reads plain strings, in the language she is using now.
    const { daysAgo, time, pickup, destination, driver, ...rest } = trip;
    sessionStorage.setItem('shedrive.selectedTrip', JSON.stringify({
      ...rest,
      date: detailDate(trip),
      pickup: pickup[lang],
      destination: destination[lang],
      driverName: driver[lang],
      avatar: driver[lang].charAt(0),
    }));
    // Back from the detail screen returns to the same tab and place in the list (#1567 Scenario 4).
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ tab: period, count: renderedCount, top: scroller?.scrollTop ?? 0 }));
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
  const next = tripsFor(period).slice(renderedCount, renderedCount + PAGE_SIZE);
  next.forEach((trip) => listEl?.appendChild(renderCard(trip)));
  renderedCount += next.length;
  applyTranslations();
}

/** Keep loading pages until the list overflows the screen — otherwise a tall
 *  viewport shows the whole first page with nothing to scroll, and the next page
 *  could never be reached. */
function fillViewport() {
  while (renderedCount < tripsFor(period).length && scroller && scroller.scrollHeight <= scroller.clientHeight) {
    renderNextPage();
  }
}

/** Show `next` period from its first page, or re-render `count` cards in place. */
function showPeriod(next, count = PAGE_SIZE) {
  period = next;
  tabs.forEach((tab) => {
    const selected = tab.dataset.period === period;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel?.setAttribute('aria-labelledby', tab.id);
  });

  if (!demoState) {
    if (tripsFor(period).length) delete document.body.dataset.state;
    else document.body.dataset.state = 'empty';
  }

  if (listEl) listEl.innerHTML = '';
  renderedCount = 0;
  do renderNextPage();
  while (renderedCount < Math.min(count, tripsFor(period).length));
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab.dataset.period === period) return;
    showPeriod(tab.dataset.period);
    if (scroller) scroller.scrollTop = 0;
    fillViewport();
  });
  // Arrow keys move between tabs (WAI-ARIA tabs pattern); the row mirrors in RTL.
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const forward = (e.key === 'ArrowRight') !== (document.dir === 'rtl');
    const i = (tabs.indexOf(tab) + (forward ? 1 : -1) + tabs.length) % tabs.length;
    tabs[i].focus();
    tabs[i].click();
  });
});

// A language switch re-renders the loaded cards — places, names and dates are data, not keys.
document.addEventListener(I18N_EVENT, () => {
  const top = scroller?.scrollTop ?? 0;
  showPeriod(period, renderedCount);
  if (scroller) scroller.scrollTop = top;
});

// Returning from a trip's detail: restore her tab, the pages she had loaded and her scroll position.
let restore = null;
try { restore = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null'); } catch { restore = null; }
sessionStorage.removeItem(RETURN_KEY);

showPeriod(PERIODS.includes(restore?.tab) ? restore.tab : 'today', restore?.count ?? PAGE_SIZE);

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
  if (renderedCount >= tripsFor(period).length) return;
  const nearBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 200;
  if (nearBottom) renderNextPage();
}, { passive: true });
