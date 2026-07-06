/**
 * sos.js — Rider Emergency Contacts screen (Phase 1 SOS)
 * Lets the rider manage the contacts who are alerted (with live location)
 * when SOS is triggered during a trip.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { mountEmergencyContacts } from '../../shared/scripts/emergency-contacts.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

mountEmergencyContacts(qs('#sos-contacts-root'));
