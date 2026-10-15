/**
 * i18n/index.js — SheDrive admin portal (v2) locale registry
 *
 * Locales are ES modules rather than JSON so `t()` is synchronous from the very
 * first line of a screen script (see scripts/admin-i18n.js for why).
 *
 * Each area module exports `en` and `ar` objects with the same shape. They are
 * merged one level deep, so two areas may contribute different namespaces, and
 * a later area may extend an earlier namespace without clobbering it.
 *
 * Arabic wording follows the delivered design kit's own `*_ar.html` pages —
 * they are the client's terminology, so when the kit names a thing, we use its
 * word rather than inventing a synonym.
 */

import * as core from './core.js';
import * as components from './components.js';
import * as lists from './lists.js';
import * as details from './details.js';
import * as config from './config.js';
import * as auth from './auth.js';
import * as finance from './finance.js';
import * as approvals from './approvals.js';
import * as payouts from './payouts.js';
import * as settlementImports from './settlement-imports.js';
import * as financeEdits from './finance-edits.js';
import * as profilePricing from './profile-pricing.js';
import * as kitLists from './kit-lists.js';
import * as kitBalances from './kit-balances.js';
import * as kitDetails from './kit-details.js';
import * as kitPeople from './kit-people.js';
import * as kitPricing from './kit-pricing.js';
import * as kitAdmin from './kit-admin.js';
import * as kitFinance from './kit-finance.js';
import * as feedback from './feedback.js';

const AREAS = [core, components, lists, details, config, auth, finance, approvals, payouts, settlementImports, financeEdits, profilePricing, kitLists, kitBalances, kitDetails, kitPeople, kitPricing, kitAdmin, kitFinance, feedback];

function merge(code) {
  const out = {};
  AREAS.forEach((area) => {
    const strings = area[code] ?? {};
    Object.entries(strings).forEach(([namespace, values]) => {
      out[namespace] = { ...(out[namespace] ?? {}), ...values };
    });
  });
  return out;
}

export const STRINGS = {
  en: merge('en'),
  ar: merge('ar'),
};
