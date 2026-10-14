/**
 * payout-store.js — the driver's payout method, mock (payouts spec §2, §3)
 *
 * One method per driver: a mobile wallet, a bank account or a prepaid card. It
 * is collected as the last onboarding step and she can change it any time from
 * driver/payout-method.html. Her own change needs no approval — it applies at
 * once, and a payout batch uses whatever method she has when it is generated.
 *
 * Only the format is validated (the name is never checked against her national
 * ID). The full card or account number is never kept here: the mock stores the
 * last four digits only, the same way every screen shows it (`•••• 4821`). The
 * real backend encrypts the full number and only the payout export file carries it.
 *
 * Shared by driver/onboarding.html (step 7), driver/payout-method.html,
 * driver/my-profile.html (summary row) and driver/balance.html (failed banner).
 *
 * Storage (localStorage):
 *   shedrive.payoutMethod   {type, provider, holder, last4, savedAt}
 *
 * Demo switches (query string):
 *   ?state=failed          her last payout failed (payout-method.html)
 *   ?state=payout-failed   her last payout failed (balance.html)
 */

import { storage } from '../../shared/scripts/storage.js';

const STORAGE_KEY = 'shedrive.payoutMethod';

/** The three method types, in the order the form offers them. */
export const PAYOUT_TYPES = {
  wallet: { key: 'driver.payout.type.wallet', exportType: 'MOBILE_WALLET' },
  bank:   { key: 'driver.payout.type.bank',   exportType: 'BANK_ACCOUNT' },
  card:   { key: 'driver.payout.type.card',   exportType: 'PREPAID_CARD' },
};

export const WALLET_PROVIDERS = [
  { id: 'vodafone_cash', key: 'driver.payout.provider.vodafoneCash' },
  { id: 'orange_cash',   key: 'driver.payout.provider.orangeCash' },
  { id: 'e_money',       key: 'driver.payout.provider.eMoney' },
  { id: 'we_pay',        key: 'driver.payout.provider.wePay' },
];

export const BANKS = [
  { id: 'cib',             key: 'driver.payout.bank.cib' },
  { id: 'nbe',             key: 'driver.payout.bank.nbe' },
  { id: 'banque_misr',     key: 'driver.payout.bank.banqueMisr' },
  { id: 'qnb',             key: 'driver.payout.bank.qnb' },
  { id: 'aaib',            key: 'driver.payout.bank.aaib' },
  { id: 'banque_du_caire', key: 'driver.payout.bank.banqueDuCaire' },
  { id: 'hsbc',            key: 'driver.payout.bank.hsbc' },
];

/** The i18n key of a provider or bank id, whichever list it is in. */
export function providerKey(id) {
  return [...WALLET_PROVIDERS, ...BANKS].find((p) => p.id === id)?.key || '';
}

/** Demo method she gave at onboarding. */
const DEMO_METHOD = { type: 'wallet', provider: 'vodafone_cash', holder: '', last4: '4821', savedAt: '2026-05-02' };

/** Her last payout, when the result file came back FAILED (spec §3). */
export const LAST_FAILED_PAYOUT = {
  amount: 54,
  at: '2026-06-22',
  reasonKey: 'driver.payout.failReason.accountNotFound',
};

const params = new URLSearchParams(location.search);
const demoState = params.get('state');

// The method saved on this page, so it shows even without storage.
let savedThisPage = null;

// ── Reads ────────────────────────────────────────────

/** Her current method. Every driver has one — it is required to be in the system. */
export function getPayoutMethod() {
  if (savedThisPage) return { ...savedThisPage };
  return storage.get(STORAGE_KEY) || { ...DEMO_METHOD };
}

/** `•••• 4821` — the only form a number is ever shown in. */
export function maskNumber(last4) {
  return `•••• ${last4}`;
}

/** Whether the screen shows the "last payout failed" warning (demo switch). */
export function hasFailedPayout() {
  return demoState === 'failed' || demoState === 'payout-failed';
}

// ── Validation (spec §2 field table) ─────────────────

const digits = (v) => String(v || '').replace(/[\s-]/g, '');

/**
 * Check one method's raw form values. Returns `{ ok, errors }`, where `errors`
 * maps a field name to the i18n key of its message.
 *   wallet: provider, number            (01 + 9 digits)
 *   bank:   provider, holder, number    (10–20 digits, or EG + 27 digits)
 *   card:   holder, number              (16 digits)
 */
export function validatePayout(type, values) {
  const errors = {};
  const holder = String(values.holder || '').trim();
  const number = digits(values.number).toUpperCase();

  if (!PAYOUT_TYPES[type]) {
    errors.type = 'driver.payout.error.type';
    return { ok: false, errors };
  }

  if (type === 'wallet') {
    if (!values.provider) errors.provider = 'driver.payout.error.provider';
    if (!number) errors.number = 'driver.payout.error.walletEmpty';
    else if (!/^01\d{9}$/.test(number)) errors.number = 'driver.payout.error.walletFormat';
  }

  if (type === 'bank') {
    if (!values.provider) errors.provider = 'driver.payout.error.bank';
    if (holder.length < 3 || holder.length > 100) errors.holder = 'driver.payout.error.holder';
    if (!number) errors.number = 'driver.payout.error.accountEmpty';
    else if (!/^\d{10,20}$/.test(number) && !/^EG\d{27}$/.test(number)) errors.number = 'driver.payout.error.accountFormat';
  }

  if (type === 'card') {
    if (holder.length < 3 || holder.length > 100) errors.holder = 'driver.payout.error.cardName';
    if (!number) errors.number = 'driver.payout.error.cardEmpty';
    else if (!/^\d{16}$/.test(number)) errors.number = 'driver.payout.error.cardFormat';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

// ── Writes ───────────────────────────────────────────


/**
 * Save a validated method. Applies immediately — no approval (spec §2). Only
 * the last four digits are kept.
 */
export function savePayoutMethod(type, values) {
  const number = digits(values.number);
  const method = {
    type,
    provider: type === 'card' ? '' : values.provider,
    holder: type === 'wallet' ? '' : String(values.holder || '').trim(),
    last4: number.slice(-4),
    savedAt: new Date().toISOString().slice(0, 10),
  };
  storage.set(STORAGE_KEY, method);
  savedThisPage = method;
  return method;
}
