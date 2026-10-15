/**
 * ad-banner.js — SheDrive admin status banner (v2 design kit)
 *
 * A banner is the message that *stays*: it describes the state the record is
 * in (suspended, closed, inactive, could not load), not an event that just
 * happened. Toasts report events and go away; a banner is there for as long as
 * the state is true, and it is gone the moment the state changes.
 *
 * Renders the delivered kit's alert:
 *
 *   <ad-banner tone="warning">
 *     <div class="alert warning ad-banner" role="status">
 *       <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
 *       <div class="details">
 *         <h6>heading</h6>
 *         <p>message</p>
 *       </div>
 *       <a class="btn btn-sm …">action</a>          (optional)
 *     </div>
 *   </ad-banner>
 *
 * Usage — a screen script drives it, because banners follow live state:
 *   banner.show({ tone: 'danger', heading, message,
 *                 action: { label, href } | { label, onClick } });
 *   banner.hide();
 *
 * Tones: info | success | warning | danger. `danger` banners are announced
 * (role="alert"); the others are polite (role="status").
 */

const ICONS = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-circle-exclamation',
};

const ACTION_CLASS = {
  info: 'btn-primary-outline',
  success: 'btn-success-outline',
  warning: 'btn-warning-outline',
  danger: 'btn-danger-outline',
};

class AdBanner extends HTMLElement {
  connectedCallback() {
    if (!this._state) this.hidden = true;
  }

  show({ tone = 'info', heading = '', message = '', action = null } = {}) {
    const safeTone = Object.hasOwn(ICONS, tone) ? tone : 'info';
    this._state = { tone: safeTone, heading, message, action };
    this.textContent = '';

    const box = document.createElement('div');
    box.className = `alert ${safeTone} ad-banner`;
    box.setAttribute('role', safeTone === 'danger' ? 'alert' : 'status');

    const icon = document.createElement('i');
    icon.className = ICONS[safeTone];
    icon.setAttribute('aria-hidden', 'true');

    const details = document.createElement('div');
    details.className = 'details';
    if (heading) {
      const h = document.createElement('h6');
      h.textContent = heading;
      details.appendChild(h);
    }
    if (message) {
      const p = document.createElement('p');
      p.textContent = message;
      details.appendChild(p);
    }

    box.append(icon, details);

    if (action?.label) {
      const control = document.createElement(action.href ? 'a' : 'button');
      control.className = `btn btn-sm ${ACTION_CLASS[safeTone]} ad-banner__action`;
      control.textContent = action.label;
      if (action.href) {
        control.href = action.href;
      } else {
        control.type = 'button';
        control.addEventListener('click', () => action.onClick?.());
      }
      box.appendChild(control);
    }

    this.appendChild(box);
    this.hidden = false;
  }

  hide() {
    this._state = null;
    this.textContent = '';
    this.hidden = true;
  }
}

if (!customElements.get('ad-banner')) {
  customElements.define('ad-banner', AdBanner);
}
