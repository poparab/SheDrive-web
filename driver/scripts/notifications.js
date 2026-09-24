/**
 * notifications.js — driver notification inbox.
 *
 * The screen itself is shared with the rider app; see
 * shared/scripts/notification-inbox.js for the behaviour and the ?state= switches.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qsa } from '../../shared/scripts/utils.js';
import { mountInbox } from '../../shared/scripts/notification-inbox.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

mountInbox('driver');
