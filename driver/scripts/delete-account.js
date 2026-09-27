/**
 * delete-account.js — driver account deletion.
 *
 * Shared with the rider app; see shared/scripts/account-deletion.js.
 * ?state= owed | blocked-trip | blocked-balance | verify | done
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qsa } from '../../shared/scripts/utils.js';
import { mountAccountDeletion } from '../../shared/scripts/account-deletion.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

mountAccountDeletion('driver');
