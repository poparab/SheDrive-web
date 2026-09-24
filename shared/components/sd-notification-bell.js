import { I18N_EVENT, isI18nReady, translate } from '../scripts/i18n.js';

const BELL_ICON = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
`;

/**
 * <sd-notification-bell href="./notifications.html" count="2">
 *
 * A link to the notification inbox with an unread badge. Presentational: the page
 * script reads the unread count and sets `count`. The badge caps at 9+.
 */
class SdNotificationBell extends HTMLElement {
  static get observedAttributes() {
    return ['count', 'href'];
  }

  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;
    this.dataset.sdMounted = 'true';
    this.classList.add('sd-notification-bell');

    this._link = document.createElement('a');
    this._link.className = 'btn btn--icon btn--ghost sd-notification-bell__link';
    this._link.innerHTML = BELL_ICON;

    this._badge = document.createElement('span');
    this._badge.className = 'sd-notification-bell__badge';
    this._badge.setAttribute('aria-hidden', 'true');
    this._link.appendChild(this._badge);

    this.replaceChildren(this._link);
    this.render();

    document.addEventListener(I18N_EVENT, () => this.render());
  }

  attributeChangedCallback() {
    if (this._link) this.render();
  }

  render() {
    const count = Math.max(0, Number(this.getAttribute('count')) || 0);
    this._link.setAttribute('href', this.getAttribute('href') || './notifications.html');

    this._badge.textContent = count > 9 ? '9+' : String(count);
    this._badge.hidden = count === 0;

    // With unread items the label carries the count, which a static
    // data-i18n-aria-label cannot interpolate — so it is set from translate().
    if (count > 0 && isI18nReady()) {
      this._link.removeAttribute('data-i18n-aria-label');
      this._link.setAttribute('aria-label', translate('notifications.bellUnread', { count }));
    } else {
      this._link.setAttribute('data-i18n-aria-label', 'notifications.title');
      this._link.setAttribute('aria-label', isI18nReady() ? translate('notifications.title') : 'الإشعارات');
    }
  }
}

if (!customElements.get('sd-notification-bell')) {
  customElements.define('sd-notification-bell', SdNotificationBell);
}
