/**
 * trip-detail.js — Driver past trip detail screen controller (#1594)
 * Auth guard + i18n + bilingual trip data + static non-interactive map.
 *
 * Demo only:
 *   ?id=h1…h6      a trip from the history list (scripts/history.js)
 *   ?id=t-…        a trip opened from the balance statement; its route and date
 *                  come from the finance ledger so both screens agree
 *   ?state=unrated the rider skipped rating — shows the "No rating given" placeholder
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { MapService } from '../../shared/scripts/map.js';
import { getEntries } from './finance-store.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Mock trips (ids match scripts/history.js) ─────────
const WEEKDAY = {
  mon: { ar: 'الإثنين', en: 'Mon' }, sun: { ar: 'الأحد', en: 'Sun' }, fri: { ar: 'الجمعة', en: 'Fri' },
  thu: { ar: 'الخميس', en: 'Thu' }, wed: { ar: 'الأربعاء', en: 'Wed' }, tue: { ar: 'الثلاثاء', en: 'Tue' },
};
const MONTH = { 5: { ar: 'مايو', en: 'May' }, 6: { ar: 'يونيو', en: 'June' } };

const TRIPS = {
  h1: { ref: 'SDR-20260602-0042', day: 'mon', d: 2,  m: 6, at: '09:34', from: { ar: 'المعادي، القاهرة — شارع 9', en: 'Maadi, Cairo — Street 9' }, to: { ar: 'مدينة نصر — سيتي ستارز', en: 'Nasr City — City Stars' }, rider: { ar: 'نور أحمد', en: 'Nour Ahmed' }, score: 4.8, stars: 5, base: 5, distance: 40, time: 20, km: 12.4, minutes: 22 },
  h2: { ref: 'SDR-20260601-0031', day: 'sun', d: 1,  m: 6, at: '18:10', from: { ar: 'الزمالك، شارع 26 يوليو', en: 'Zamalek, 26th of July St' }, to: { ar: 'المعادي — مستشفى السلام', en: 'Maadi — Al Salam Hospital' }, rider: { ar: 'سارة مصطفى', en: 'Sara Mostafa' }, score: 4.9, stars: 4, base: 5, distance: 22, time: 10, km: 9.1, minutes: 19 },
  h3: { ref: 'SDR-20260530-0027', day: 'fri', d: 30, m: 5, at: '13:05', from: { ar: 'الزمالك، شارع البرازيل', en: 'Zamalek, Brazil St' }, to: { ar: 'القاهرة الجديدة', en: 'New Cairo' }, rider: { ar: 'منى حسن', en: 'Mona Hassan' }, score: 4.7, stars: null, base: 5, distance: 55, time: 25, km: 24.8, minutes: 41 },
  h4: { ref: 'SDR-20260529-0019', day: 'thu', d: 29, m: 5, at: '08:20', from: { ar: 'الرحاب، البوابة 13', en: 'El Rehab, Gate 13' }, to: { ar: 'الجامعة الأمريكية، التجمع', en: 'AUC, New Cairo' }, rider: { ar: 'نسمة علي', en: 'Nesma Ali' }, score: 5.0, stars: 5, base: 5, distance: 36, time: 15, km: 11.6, minutes: 24 },
  h5: { ref: 'SDR-20260528-0012', day: 'wed', d: 28, m: 5, at: '16:45', from: { ar: 'المقطم، الهضبة الوسطى', en: 'Mokattam, Middle Plateau' }, to: { ar: 'الحي 11، مدينة نصر', en: '11th District, Nasr City' }, rider: { ar: 'ماجدة سمير', en: 'Magda Samir' }, score: 4.6, stars: 5, base: 5, distance: 30, time: 13, km: 10.2, minutes: 27 },
  h6: { ref: 'SDR-20260527-0006', day: 'tue', d: 27, m: 5, at: '05:30', from: { ar: 'الشيخ زايد، الحي 16', en: 'Sheikh Zayed, District 16' }, to: { ar: 'مطار القاهرة الدولي', en: 'Cairo International Airport' }, rider: { ar: 'كريمة يوسف', en: 'Karima Youssef' }, score: 4.9, stars: 5, base: 5, distance: 160, time: 65, km: 58.3, minutes: 74 },
};

const COMMISSION = 0.2; // mock only — the driver never sees the rate, just the net figure (#1766)

const params = new URLSearchParams(location.search);
const id = params.get('id') || 'h1';

/** A trip opened from the balance statement reuses the default trip's figures,
 *  but takes its route and date from the ledger so both screens agree. */
function resolveTrip() {
  if (TRIPS[id]) return { ...TRIPS[id] };
  const trip = { ...TRIPS.h1, ref: `SDR-${id.toUpperCase()}` };
  const entry = getEntries().find((e) => e.tripId === id && e.route);
  if (entry) {
    const split = (text) => text.split(/\s*[←→]\s*/);
    const [fromAr, toAr] = split(entry.route.ar);
    const [fromEn, toEn] = split(entry.route.en);
    trip.from = { ar: fromAr, en: fromEn };
    trip.to = { ar: toAr, en: toEn };
    const [, m, d] = entry.at.split('-').map(Number);
    trip.m = m;
    trip.d = d;
    trip.day = null;
  }
  return trip;
}

const trip = resolveTrip();
const unrated = params.get('state') === 'unrated' || trip.stars == null;
if (unrated) document.body.dataset.state = 'unrated';

// ── Render ────────────────────────────────────────────
function render() {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const egp = translate('driver.currency');
  const total = trip.base + trip.distance + trip.time;
  const net = Math.round(total * (1 - COMMISSION));
  const money = (n) => `${n} ${egp}`;

  const month = MONTH[trip.m] ? MONTH[trip.m][lang] : String(trip.m);
  const day = trip.day ? `${WEEKDAY[trip.day][lang]}${lang === 'ar' ? '،' : ','} ` : '';
  const date = lang === 'ar' ? `${day}${trip.d} ${month} 2026` : `${day}${month} ${trip.d}, 2026`;

  qs('#dtd-total').textContent = total.toFixed(2);
  qs('#dtd-ref').textContent = `#${trip.ref}`;
  qs('#dtd-datetime').textContent = `${date} · ${trip.at}`;
  qs('#dtd-base').textContent = money(trip.base);
  qs('#dtd-distance-fare').textContent = money(trip.distance);
  qs('#dtd-time-fare').textContent = money(trip.time);
  qs('#dtd-total-row').textContent = money(total);
  qs('#dtd-net').textContent = money(net);

  qs('#dtd-pickup').textContent = trip.from[lang];
  qs('#dtd-destination').textContent = trip.to[lang];

  qs('#dtd-rider-name').textContent = trip.rider[lang];
  qs('#dtd-rider-initial').textContent = trip.rider[lang].charAt(0);
  qs('#dtd-rider-score').textContent = trip.score.toFixed(1);

  const stars = qs('#dtd-stars');
  const value = trip.stars || 0;
  stars.setAttribute('aria-label', `${value} / 5`);
  stars.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="dtd-star${i < value ? ' dtd-star--filled' : ''}" aria-hidden="true">★</span>`
  ).join('');

  qs('#dtd-km').textContent = `${trip.km} ${translate('complete.km')}`;
  qs('#dtd-minutes').textContent = `${trip.minutes} ${translate('trip.minutes')}`;
}

render();
document.addEventListener(I18N_EVENT, render);

// ── Back: return to the list at the same scroll position (#1594 S3) ──
// #dtd-back is a data-back control (shared/scripts/navigation.js): going back through
// history keeps the list page (and its scroll) as she left it.

// ── Static route map (non-interactive thumbnail) ──────
const map = MapService.init('map', { zoom: 12, center: [31.2407, 30.0494] });

if (map) {
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.dragRotate.disable();
  map.dragPan.disable();
  map.keyboard.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();

  const css = getComputedStyle(document.documentElement);
  const routeColor = css.getPropertyValue('--color-primary-600').trim();
  const destColor = css.getPropertyValue('--color-accent-600').trim();

  map.on('load', () => {
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [31.2357, 30.0444],
            [31.238,  30.047],
            [31.242,  30.051],
            [31.2457, 30.0544],
          ],
        },
      },
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] },
    });

    const pickupEl = document.createElement('div');
    pickupEl.className = 'map-user-dot';
    new mapboxgl.Marker({ element: pickupEl }).setLngLat([31.2357, 30.0444]).addTo(map);
    new mapboxgl.Marker({ color: destColor }).setLngLat([31.2457, 30.0544]).addTo(map);
  });
}
