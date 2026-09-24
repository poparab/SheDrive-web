/**
 * notification-settings.js — driver notification preferences.
 *
 * Shared with the rider app; see shared/scripts/notification-inbox.js.
 * ?state=push-off shows the screen with push denied at the OS level.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qsa } from '../../shared/scripts/utils.js';
import { mountNotificationSettings } from '../../shared/scripts/notification-inbox.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

mountNotificationSettings('driver');
