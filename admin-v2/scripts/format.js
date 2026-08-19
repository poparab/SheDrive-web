/**
 * format.js — SheDrive admin portal display formatters
 * Egypt operates on UTC+2 with no daylight saving, so timestamps are rendered
 * in a fixed +02:00 offset rather than the viewer's local zone.
 *
 * Bilingual: month names and unit suffixes follow the active language, but
 * every number stays in Latin digits in both. Operations staff read plate
 * numbers, fares and ids against the same source systems all day, and mixing
 * Arabic-Indic digits into that is a transcription error waiting to happen.
 */

import { t, lang } from './admin-i18n.js';

const CAIRO_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Latin digits in both languages — see the module header. */
const NUMBER_LOCALE = 'en-EG';

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

function month(index) {
  return (MONTHS[lang()] ?? MONTHS.en)[index];
}

function toCairoParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + CAIRO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** "14 Jul 2026" in UTC+2. */
export function formatDate(value) {
  const p = toCairoParts(value);
  if (!p) return '—';
  return `${p.day} ${month(p.month)} ${p.year}`;
}

/** "14 Jul 2026, 09:42" in UTC+2. */
export function formatDateTime(value) {
  const p = toCairoParts(value);
  if (!p) return '—';
  return `${p.day} ${month(p.month)} ${p.year}, ${pad(p.hours)}:${pad(p.minutes)}`;
}

/** "09:42" in UTC+2. */
export function formatTime(value) {
  const p = toCairoParts(value);
  if (!p) return '—';
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

/** "2026-07-14" in UTC+2 — for <input type="date"> values and comparisons. */
export function toDateInputValue(value) {
  const p = toCairoParts(value);
  if (!p) return '';
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

/** "1,240.50 EGP" — always two decimals. */
export function formatEgp(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return `${Number(amount).toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${t('common.egp')}`;
}

/** "1,240" — grouped integer. */
export function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(NUMBER_LOCALE);
}

/** "12.5%" */
export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 2 })}%`;
}

/** "+20 100 234 5678" from a stored 10-digit local number. */
export function formatPhone(number) {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (digits.length !== 10) return String(number ?? '—');
  return `+20 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** National ID masked to the last 4 digits — admins never need the full value. */
export function maskNid(nid) {
  const digits = String(nid ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

/** "4 min ago" / "2 h 15 min ago" — relative to `now`. */
export function formatElapsed(value, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return t('units.secondsAgo', { seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('units.minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) {
    return remainder
      ? t('units.hoursMinutesAgo', { hours, minutes: remainder })
      : t('units.hoursAgo', { hours });
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? t('units.oneDayAgo') : t('units.daysAgo', { days });
}

/** "1.4 km" / "820 m" */
export function formatDistance(km) {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '—';
  const value = Number(km);
  if (value < 1) return t('units.metres', { value: Math.round(value * 1000) });
  return t('units.kilometres', {
    value: value.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 1 }),
  });
}

/** "18 min" / "1 h 05 min" */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return '—';
  const total = Math.round(Number(minutes));
  if (total < 60) return t('units.minutes', { value: total });
  return t('units.hoursMinutes', { hours: Math.floor(total / 60), minutes: pad(total % 60) });
}

/** Human label for an internal snake_case value. */
export function humanize(value) {
  if (!value) return '—';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Escape a value for CSV, then join rows — used by the export buttons. */
export function toCsv(headers, rows) {
  const escape = (cell) => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\r\n');
}

/** Trigger a client-side CSV download. Mockup-only stand-in for a server export. */
export function downloadCsv(filename, headers, rows) {
  const blob = new Blob([`﻿${toCsv(headers, rows)}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
