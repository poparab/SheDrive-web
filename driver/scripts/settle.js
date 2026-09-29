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

// Back to the balance screen with the same demo state she came from (#3979 ↔ #3977).
const backLink = document.querySelector('sd-app-header a[href="./balance.html"]');
if (backLink) backLink.href = `./balance.html${location.search}`;

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

const svg = (inner) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const CHANNEL_ICONS = {
  office_cash: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  bank_deposit: svg('<path d="M3 10 12 4l9 6"/><line x1="5" y1="10" x2="5" y2="18"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="14" y1="10" x2="14" y2="18"/><line x1="19" y1="10" x2="19" y2="18"/><line x1="3" y1="20" x2="21" y2="20"/>'),
  mobile_wallet: svg('<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>'),
  field_agent: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/>'),
};

// ── Channels ──────────────────────────────────────────
function renderChannels() {
  const list = qs('#channels-list');
  list.textContent = '';

  SETTLEMENT_CHANNELS.forEach((channel) => {
    const card = document.createElement('div');
    card.className = 'settle-channel';

    const icon = document.createElement('span');
    icon.className = 'icon-tile icon-tile--lg icon-tile--round';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = CHANNEL_ICONS[channel.id] || CHANNEL_ICONS.office_cash;

    const body = document.createElement('span');
    body.className = 'settle-channel__body';

    const name = document.createElement('span');
    name.className = 'settle-channel__name';
    name.textContent = translate(channel.key);

    const note = document.createElement('span');
    note.className = 'settle-channel__note';
    note.textContent = translate(
      channel.refRequired ? 'driver.settle.refRequired' : 'driver.settle.refOptional',
    );

    body.append(name, note);
    card.append(icon, body);
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
