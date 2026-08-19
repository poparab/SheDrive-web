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

const AREAS = [core, components, lists, details, config, auth];

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
