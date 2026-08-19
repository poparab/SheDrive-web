/**
 * auth-redirect.js — SheDrive admin portal (v2) standalone auth screens
 *
 * The delivered design kit ships one file per authentication state
 * (2fa.html, 2fa-frist-time.html, recovery-code.html, password-forgot.html,
 * password-new.html). The portal implements all of those states as steps of the
 * single sign-in controller in index.html, because they share one flow, one
 * pending-admin identity and one set of validation rules.
 *
 * These pages exist so a designer or reviewer can open a kit URL directly. Each
 * one declares `data-step` on <body> and hands over to index.html on that step,
 * preserving every other query parameter (`?auth=strict`, `?state=…`, `?lang=…`)
 * so the deep links keep behaving exactly as they do on the sign-in screen.
 *
 * They are bilingual for the moment they are on screen, but they carry no
 * language switcher: the handover to index.html happens immediately, and the
 * switcher lives there. The stored language and any `?lang=` both survive.
 */

import { injectAdminStyles, ensureToastHost } from '../components/ad-styles.js';
import '../../shared/components/sd-toast-host.js';
import { t, initAdminI18n, applyAdminTranslations } from './admin-i18n.js';

// Direction has to be on <html> before the style stack picks LTR or RTL.
initAdminI18n();

injectAdminStyles({ screenStyles: 'styles/login.css' });
ensureToastHost();

const step = document.body.dataset.step;

/** `data-step` value → the document-title key for that state. */
const TITLE_KEYS = {
  '2fa': 'auth.docTitle.twoFactor',
  enrol: 'auth.docTitle.enrol',
  recovery: 'auth.docTitle.recovery',
  forgot: 'auth.docTitle.forgot',
  change: 'auth.docTitle.change',
};

applyAdminTranslations();
if (TITLE_KEYS[step]) document.title = t(TITLE_KEYS[step]);

const params = new URLSearchParams(window.location.search);

if (step) {
  params.set('step', step);
  window.location.replace(`./index.html?${params.toString()}`);
} else {
  console.warn('[admin mockup] auth-redirect.js needs data-step on <body>.');
}
