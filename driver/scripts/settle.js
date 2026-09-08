/**
 * settle.js — Driver settlement screen (spec §5, §7.2)
 *
 * Read-only for the driver: recording an actual settlement is an admin action
 * (admin-v2 balances.html) that posts the ledger entry. This screen shows what she
 * owes, how she can hand the cash back, where the office is, and her past receipts.
 *
 * Demo switches are documented in finance-store.js (?owed, ?zero, ?error, …).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  SETTLEMENT_CHANNELS,
  getOutstanding,
  getSettlements,
  shouldFailRequest,
} from './finance-store.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

let failed = shouldFailRequest;

// ── What she owes ────────────────────────────────────
function renderOwed() {
  const owed = getOutstanding();
  const isZero = owed <= 0;

  qs('#settle-card').hidden = isZero;
  const zero = qs('#settle-zero');
  zero.hidden = !isZero;
  zero.setAttribute('aria-hidden', String(!isZero));

  const channels = qs('#settle-channels');
  channels.hidden = isZero;
  channels.setAttribute('aria-hidden', String(isZero));

  if (isZero) return;
  qs('#settle-amount').textContent = String(owed);
}

// ── Channels ──────────────────────────────────────────
function renderChannels() {
  const list = qs('#channels-list');
  list.textContent = '';

  SETTLEMENT_CHANNELS.forEach((channel) => {
    const card = document.createElement('div');
    card.className = 'settle-channel';

    const name = document.createElement('span');
    name.className = 'settle-channel__name';
    name.textContent = translate(channel.key);

    const note = document.createElement('span');
    note.className = 'settle-channel__note';
    note.textContent = translate(
      channel.refRequired ? 'driver.settle.refRequired' : 'driver.settle.refOptional',
    );

    card.append(name, note);
    list.appendChild(card);
  });
}

// ── History ───────────────────────────────────────────
const CHANNEL_KEYS = Object.fromEntries(SETTLEMENT_CHANNELS.map((c) => [c.id, c.key]));

function renderHistory() {
  const list = qs('#history-list');
  const settlements = getSettlements();
  const empty = qs('#history-empty');

  list.textContent = '';
  const isEmpty = settlements.length === 0;
  empty.hidden = !isEmpty;
  empty.setAttribute('aria-hidden', String(!isEmpty));

  const currency = translate('driver.currency');

  settlements.forEach((entry) => {
    const row = document.createElement('article');
    row.className = 'settle-row';

    const top = document.createElement('div');
    top.className = 'settle-row__top';

    const amount = document.createElement('span');
    amount.className = 'settle-row__amount';
    amount.textContent = `${entry.amount} ${currency}`;

    const receipt = document.createElement('span');
    receipt.className = 'badge settle-row__receipt';
    receipt.textContent = entry.ref || '—';

    top.append(amount, receipt);

    const meta = document.createElement('div');
    meta.className = 'settle-row__meta';

    const date = document.createElement('span');
    date.textContent = entry.at.replace(/-/g, '/');

    const channel = document.createElement('span');
    channel.textContent = entry.channel && CHANNEL_KEYS[entry.channel]
      ? translate(CHANNEL_KEYS[entry.channel])
      : translate('driver.settle.channel.officeCash');

    meta.append(date, document.createTextNode('·'), channel);

    row.append(top, meta);
    list.appendChild(row);
  });
}

function render() {
  if (failed) return;
  renderOwed();
  renderChannels();
  renderHistory();
}

// ── Error state ──────────────────────────────────────
function showError(on) {
  const box = qs('#settle-error');
  box.hidden = !on;
  box.setAttribute('aria-hidden', String(!on));
  qs('#settle-content').hidden = on;
}

qs('#settle-retry')?.addEventListener('click', () => {
  failed = false;
  showError(false);
  render();
});

// ── Boot ─────────────────────────────────────────────
if (failed) {
  showError(true);
} else {
  render();
}
document.addEventListener(I18N_EVENT, render);
