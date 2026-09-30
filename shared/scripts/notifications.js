/**
 * notifications.js — the notification inbox.
 *
 * One store serves both apps; `role` is 'rider' or 'driver'. The feed is a mock
 * of what the backend returns: every item carries i18n keys rather than text, so
 * the inbox re-renders in the other language without a refetch. Names inside
 * params come as {ar, en} pairs for the same reason.
 *
 * The inbox is the durable record. A push is only a copy of an inbox item, so
 * whatever she misses on the lock screen is still here. Every item carries the `href` of the screen it is about.
 *
 * Storage (localStorage):
 *   shedrive.notificationsRead   {rider: [id], driver: [id]}   read ids
 */

import { storage } from './storage.js';

const READ_KEY = 'shedrive.notificationsRead';

const HOUR = 60;
const DAY = 24 * HOUR;

/* ── Mock feed ──────────────────────────────────────────────────────────── */

const FEED = {
  rider: [
    { id: 'r1', category: 'trip', key: 'tripComplete', params: { fare: 55, driver: { ar: 'نورا', en: 'Noura' } }, ago: 6, href: './history.html' },
    { id: 'r2', category: 'trip', key: 'driverArrived', params: { driver: { ar: 'نورا', en: 'Noura' } }, ago: 31, href: './history.html' },
    { id: 'r3', category: 'payment', key: 'cancelFee', params: { fee: 15 }, ago: 3 * HOUR, href: './payments.html' },
    { id: 'r4', category: 'safety', key: 'contactAdded', params: { contact: { ar: 'منى', en: 'Mona' } }, ago: DAY + 2 * HOUR, href: './sos.html' },
    { id: 'r5', category: 'offers', key: 'hours', params: {}, ago: 3 * DAY, href: './home.html' },
    { id: 'r6', category: 'account', key: 'welcome', params: {}, ago: 6 * DAY, href: './home.html' },
  ],
  driver: [
    { id: 'd1', category: 'earnings', key: 'settled', params: { amount: 250 }, ago: 12, href: './balance.html' },
    { id: 'd2', category: 'account', key: 'licenceExpiring', params: { date: '15/10/2026' }, ago: 48, href: './profile.html' },
    { id: 'd3', category: 'trip', key: 'rated', params: { rating: '4.9' }, ago: 4 * HOUR, href: './history.html' },
    { id: 'd4', category: 'earnings', key: 'nearLimit', params: { owed: 420, limit: 500 }, ago: DAY + 5 * HOUR, href: './settle.html' },
    { id: 'd5', category: 'offers', key: 'hours', params: {}, ago: 3 * DAY, href: './home.html' },
    { id: 'd6', category: 'account', key: 'approved', params: {}, ago: 6 * DAY, href: './home.html' },
  ],
};

/** A long feed, so the design review can see the list scroll and group. */
function longFeed(role) {
  const base = FEED[role];
  return Array.from({ length: 24 }, (_, i) => {
    const src = base[i % base.length];
    return { ...src, id: `${src.id}-${i}`, ago: src.ago + i * 7 * HOUR };
  });
}

/**
 * The inbox for a role, newest first, each item flagged `read`.
 * `state` is the design-review switch: 'empty' | 'long' | 'unread' | undefined.
 */
export function getFeed(role, state) {
  if (state === 'empty') return [];
  const items = state === 'long' ? longFeed(role) : FEED[role].slice();
  const read = state === 'unread' ? new Set() : readIds(role);
  return items
    .sort((a, b) => a.ago - b.ago)
    .map((n) => ({ ...n, read: read.has(n.id.split('-')[0]) }));
}

export function unreadCount(role) {
  return getFeed(role).filter((n) => !n.read).length;
}

/* ── Read state ─────────────────────────────────────────────────────────── */

/**
 * Until she has opened anything, items older than two hours count as read, so a
 * fresh install shows a realistic two unread. After that only her own ids count.
 */
function readIds(role) {
  const saved = (storage.get(READ_KEY) || {})[role];
  if (Array.isArray(saved)) return new Set(saved);
  return new Set(FEED[role].filter((n) => n.ago > 2 * HOUR).map((n) => n.id));
}

function writeRead(role, ids) {
  const all = storage.get(READ_KEY) || {};
  all[role] = Array.from(ids);
  storage.set(READ_KEY, all);
}

export function markRead(role, id) {
  const ids = readIds(role);
  ids.add(id.split('-')[0]);
  writeRead(role, ids);
}

export function markAllRead(role) {
  writeRead(role, FEED[role].map((n) => n.id));
}

/* ── Time grouping ──────────────────────────────────────────────────────── */

/** 'today' | 'yesterday' | 'earlier' — from minutes-ago against the local clock. */
export function dayGroup(ago, now = new Date()) {
  const minutesToday = now.getHours() * HOUR + now.getMinutes();
  if (ago <= minutesToday) return 'today';
  if (ago <= minutesToday + DAY) return 'yesterday';
  return 'earlier';
}
