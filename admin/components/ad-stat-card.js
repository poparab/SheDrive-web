/**
 * ad-stat-card.js — SheDrive admin KPI tile
 * Label, numeric value, and a last-refreshed line (#1669 requires all three).
 *
 * Usage: <ad-stat-card label="Active trips" value="12" meta="Updated 09:42"></ad-stat-card>
 */

class AdStatCard extends HTMLElement {
  static observedAttributes = ['label', 'value', 'meta'];

  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  attributeChangedCallback() {
    if (this._built) this.render();
  }

  build() {
    this.classList.add('ad-stat');
    this._label = document.createElement('span');
    this._label.className = 'ad-stat__label';
    this._value = document.createElement('span');
    this._value.className = 'ad-stat__value';
    this._meta = document.createElement('span');
    this._meta.className = 'ad-stat__meta';
    this.append(this._label, this._value, this._meta);
    this._built = true;
  }

  set value(next) {
    this.setAttribute('value', next ?? '—');
  }

  get value() {
    return this.getAttribute('value') ?? '';
  }

  set meta(next) {
    this.setAttribute('meta', next ?? '');
  }

  render() {
    this._label.textContent = this.getAttribute('label') ?? '';
    this._value.textContent = this.getAttribute('value') ?? '—';
    const meta = this.getAttribute('meta') ?? '';
    this._meta.textContent = meta;
    this._meta.hidden = !meta;
  }
}

if (!customElements.get('ad-stat-card')) {
  customElements.define('ad-stat-card', AdStatCard);
}
