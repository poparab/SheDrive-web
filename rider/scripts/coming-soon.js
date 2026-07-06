import { auth } from '../../shared/scripts/auth.js';
import { initI18n } from '../../shared/scripts/i18n.js';

auth.requireAuth();
await initI18n();
