/**
 * list-metrics.js — SheDrive admin portal (v2) list-screen KPI row
 *
 * The delivered design kit puts a row of four KPI widgets above every list
 * screen (drivers, applications, riders, trips). The portal has no dedicated
 * counts endpoint, so each tile is derived from the same mock list call the
 * grid already uses: ask for one row of a given status and read `total`.
 *
 * That keeps the numbers honest — they always agree with what the grid would
 * show for that filter — at the cost of a handful of extra mock calls per load.
 *
 * Tile labels are display copy, so screens pass them already translated:
 *
 * Usage:
 *   const cards = mountStatRow(qs('#drivers-stats'), [
 *     { key: 'all',      label: t('drivers.statTotal'),  tone: 'primary', icon: 'steering-wheel.svg' },
 *     { key: 'approved', label: t('status.approved'),    tone: 'success', icon: 'checked-2.svg' },
 *   ]);
 *   await fillStatRow(cards, (status) => mockApi.listDrivers({ status, pageSize: 1 }));
 */

import { formatCount } from './format.js';
import { t } from './admin-i18n.js';

/**
 * Render the widget row and return the tiles keyed by spec key.
 * @param {HTMLElement} host
 * @param {Array<{key: string, label: string, tone?: string, icon?: string}>} specs
 * @returns {Map<string, HTMLElement>}
 */
export function mountStatRow(host, specs) {
  const cards = new Map();
  if (!host) return cards;

  host.textContent = '';
  host.classList.add('ad-stats');

  specs.forEach((spec) => {
    const card = document.createElement('ad-stat-card');
    card.setAttribute('label', spec.label);
    card.setAttribute('value', t('common.notAvailable'));
    if (spec.tone) card.setAttribute('tone', spec.tone);
    if (spec.icon) card.setAttribute('icon', spec.icon);
    host.appendChild(card);
    cards.set(spec.key, card);
  });

  return cards;
}

/**
 * Fill every tile from one list call per key. A failed count leaves the tile at
 * an em dash rather than showing a wrong number.
 * @param {Map<string, HTMLElement>} cards
 * @param {(key: string) => Promise<{total: number}>} count
 */
export async function fillStatRow(cards, count) {
  await Promise.all(
    Array.from(cards.entries()).map(async ([key, card]) => {
      try {
        const result = await count(key);
        card.setAttribute('value', formatCount(result?.total ?? 0));
      } catch {
        card.setAttribute('value', t('common.notAvailable'));
      }
    }),
  );
}
