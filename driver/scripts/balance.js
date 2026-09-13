/**
 * balance.js — Driver balance and statement (#1788 / API #1781)
 *
 * The balance is signed: negative means she owes the platform, positive means the
 * platform owes her. The screen never shows her a minus sign in front of her own
 * money — it states the direction in words and colours the statement rows instead.
 *
 * Demo switches are documented in finance-store.js (?owed, ?available, ?warn,
 * ?blocked, ?zero, ?error).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  ENTRY_TYPES,
  POLICY,
  getBalance,
  getEntries,
  getLastSettlement,
  getLimitState,
  getOutstanding,
  shouldFailRequest,
} from './finance-store.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const PAGE_SIZE = 5;
const isAr = () => document.documentElement.lang === 'ar';

let shown = PAGE_SIZE;
let failed = shouldFailRequest;

// ── Balance headline ─────────────────────────────────
function renderHeadline() {
  const balance = getBalance();
  const outstanding = getOutstanding();
  const isZero = balance === 0;

  qs('#balance-card').hidden = isZero;
  const zero = qs('#balance-zero');
  zero.hidden = !isZero;
  zero.setAttribute('aria-hidden', String(!isZero));
  if (isZero) return;

  const owes = balance < 0;
  const headline = qs('#balance-headline');
  const explain = qs('#balance-explain');

  // Always show a positive figure — the words carry the direction, not a sign.
  qs('#balance-amount').textContent = String(owes ? outstanding : Math.abs(balance));

  headline.setAttribute('data-i18n', owes ? 'driver.balance.owedHeadline' : 'driver.balance.availableHeadline');
  headline.textContent = translate(owes ? 'driver.balance.owedHeadline' : 'driver.balance.availableHeadline');

  explain.setAttribute('data-i18n', owes ? 'driver.balance.explain' : 'driver.balance.availableExplain');
  explain.textContent = translate(owes ? 'driver.balance.explain' : 'driver.balance.availableExplain');

  qs('#balance-card').classList.toggle('balance-card--owed', owes);
  qs('#balance-card').classList.toggle('balance-card--available', !owes);
}

// ── Balance-limit band ───────────────────────────────
function renderBand() {
  const band = qs('#balance-band');
  const state = getLimitState();
  const show = state !== 'ok';

  band.hidden = !show;
  band.setAttribute('aria-hidden', String(!show));
  if (!show) return;

  band.classList.toggle('balance-band--blocked', state === 'blocked');
  qs('#balance-band-msg').textContent =
    state === 'blocked'
      ? translate('driver.balance.limitBlock')
      : translate('driver.balance.limitWarn', {
          owed: getOutstanding(),
          limit: POLICY.balanceLimit,
        });
}

// ── Last settlement ──────────────────────────────────
function renderSettlement() {
  const row = qs('#balance-settlement');
  const last = getLastSettlement();
  row.hidden = !last;
  row.setAttribute('aria-hidden', String(!last));
  if (!last) return;
  qs('#settlement-amount').textContent = String(last.amount);
  qs('#settlement-date').textContent = last.date.replace(/-/g, '/');
}

// ── Statement ────────────────────────────────────────
function renderStatement() {
  const list = qs('#statement-list');
  const entries = getEntries();
  const empty = qs('#statement-empty');
  const more = qs('#statement-more');

  list.textContent = '';

  const isEmpty = entries.length === 0;
  empty.hidden = !isEmpty;
  empty.setAttribute('aria-hidden', String(!isEmpty));

  const page = entries.slice(0, shown);
  const currency = translate('driver.currency');

  page.forEach((entry) => {
    const meta = ENTRY_TYPES[entry.type];
    const credit = entry.amount > 0;

    const row = document.createElement(entry.tripId ? 'a' : 'div');
    row.className = `statement-row statement-row--${credit ? 'credit' : 'debit'}`;
    if (entry.tripId) {
      row.href = `./trip-detail.html?id=${encodeURIComponent(entry.tripId)}`;
    }

    const info = document.createElement('div');
    info.className = 'statement-row__info';

    const label = document.createElement('span');
    label.className = 'statement-row__label';
    label.textContent = meta ? translate(meta.key) : entry.type;

    const sub = document.createElement('span');
    sub.className = 'statement-row__sub';
    const route = entry.route ? (isAr() ? entry.route.ar : entry.route.en) : entry.ref || '';
    sub.textContent = route ? `${entry.at.replace(/-/g, '/')} · ${route}` : entry.at.replace(/-/g, '/');

    info.append(label, sub);

    const amount = document.createElement('span');
    amount.className = 'statement-row__amount';
    // Sign here is meaningful: it is a ledger movement, not her balance.
    amount.textContent = `${credit ? '+' : '−'}${Math.abs(entry.amount)} ${currency}`;

    row.append(info, amount);
    list.appendChild(row);
  });

  const hasMore = entries.length > shown;
  more.hidden = !hasMore;
  more.setAttribute('aria-hidden', String(!hasMore));
}

function render() {
  if (failed) return;
  renderHeadline();
  renderBand();
  renderSettlement();
  renderStatement();
}

// ── Error state ──────────────────────────────────────
function showError(on) {
  const box = qs('#balance-error');
  box.hidden = !on;
  box.setAttribute('aria-hidden', String(!on));
  qs('#balance-content').hidden = on;
}

qs('#balance-retry')?.addEventListener('click', () => {
  failed = false;
  showError(false);
  render();
});

qs('#statement-more')?.addEventListener('click', () => {
  shown += PAGE_SIZE;
  renderStatement();
});

// ── Boot ─────────────────────────────────────────────
if (failed) {
  showError(true);
} else {
  render();
}
document.addEventListener(I18N_EVENT, render);
