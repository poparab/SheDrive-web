/**
 * format.js — SheDrive admin portal display formatters
 * Egypt operates on UTC+2 with no daylight saving, so timestamps are rendered
 * in a fixed +02:00 offset rather than the viewer's local zone.
 */

const CAIRO_OFFSET_MS = 2 * 60 * 60 * 1000;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "14 Jul 2026, 09:42" in UTC+2. */
export function formatDateTime(value) {
  const p = toCairoParts(value);
  if (!p) return '—';
  return `${p.day} ${MONTHS[p.month]} ${p.year}, ${pad(p.hours)}:${pad(p.minutes)}`;
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
  return `${Number(amount).toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

/** "1,240" — grouped integer. */
export function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-EG');
}

/** "12.5%" */
export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('en-EG', { maximumFractionDigits: 2 })}%`;
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
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours} h ${remainder} min ago` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** "1.4 km" / "820 m" */
export function formatDistance(km) {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '—';
  const value = Number(km);
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toLocaleString('en-EG', { maximumFractionDigits: 1 })} km`;
}

/** "18 min" / "1 h 05 min" */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return '—';
  const total = Math.round(Number(minutes));
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${pad(total % 60)} min`;
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
