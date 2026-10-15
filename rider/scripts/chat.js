/**
 * chat.js — rider ↔ driver trip chat (rider side).
 *
 * The screen itself is shared with the driver app; see
 * shared/scripts/trip-chat.js for the behaviour and the ?state= switches.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qsa } from '../../shared/scripts/utils.js';
import { mountChat } from '../../shared/scripts/trip-chat.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

mountChat('rider');
