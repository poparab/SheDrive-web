/**
 * ad-empty-state.js — SheDrive admin empty / not-found / error placeholder
 *
 * Usage: <ad-empty-state icon="⚑" heading="No open reports"
 *          message="Nothing needs triage right now."></ad-empty-state>
 * Slotted children with data-slot="action" render below the message.
 */

class AdEmptyState extends HTMLElement {
  static observedAttributes = ['icon', 'heading', 'message'];

  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  attributeChangedCallback() {
    if (this._built) this.render();
  }

  build() {
    const passthrough = Array.from(this.childNodes);

    this.classList.add('ad-state');
    this._icon = document.createElement('span');
    this._icon.className = 'ad-state__icon';
    this._icon.setAttribute('aria-hidden', 'true');
    this._heading = document.createElement('p');
    this._heading.className = 'ad-state__title';
    this._message = document.createElement('p');
    this._message.className = 'ad-state__message';
    this._actions = document.createElement('div');
    this._actions.className = 'ad-row';

    this.textContent = '';
    this.append(this._icon, this._heading, this._message, this._actions);
    passthrough.forEach((node) => this._actions.appendChild(node));
    this._built = true;
  }

  render() {
    const icon = this.getAttribute('icon') ?? '';
    this._icon.textContent = icon;
    this._icon.hidden = !icon;

    const heading = this.getAttribute('heading') ?? '';
    this._heading.textContent = heading;
    this._heading.hidden = !heading;

    const message = this.getAttribute('message') ?? '';
    this._message.textContent = message;
    this._message.hidden = !message;

    this._actions.hidden = this._actions.childNodes.length === 0;
  }

  get actions() {
    return this._actions;
  }
}

if (!customElements.get('ad-empty-state')) {
  customElements.define('ad-empty-state', AdEmptyState);
}
