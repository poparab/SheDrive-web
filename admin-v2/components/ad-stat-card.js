/**
 * ad-stat-card.js — SheDrive admin KPI tile
 * Label, numeric value, and a last-refreshed line (#1669 requires all three).
 *
 * Renders the delivered design kit's KPI widget. The host carries the kit's
 * `.widjets-theme-2` scope so the tone classes resolve from any screen:
 *
 *   <div class="neutral-widjet primary">
 *     <div class="widjet-body">
 *       <div class="icon"><img src="vendor/icons/chart.svg" alt=""></div>
 *       <div class="content">
 *         <p class="number">12</p>
 *         <p>Active trips</p>
 *         <span>Updated 09:42</span>
 *       </div>
 *     </div>
 *   </div>
 *
 * Usage: <ad-stat-card label="Active trips" value="12" meta="Updated 09:42"
 *          tone="blue" icon="trips.svg"></ad-stat-card>
 *
 * Attributes:
 *   label — the caption under the number
 *   value — the number itself
 *   meta  — the small line under the caption (hidden when empty)
 *   tone  — primary | blue | success | danger | warning (default primary)
 *   icon  — a file name in vendor/icons/ (default chart.svg)
 *
 * `label` and `meta` are supplied already translated by the screen; the card
 * itself only contributes the em-dash placeholder for a missing value.
 */

import { iconUrl } from './ad-styles.js';
import { t } from '../scripts/admin-i18n.js';

const TONES = new Set(['primary', 'blue', 'success', 'danger', 'warning']);
const DEFAULT_ICON = 'chart.svg';

class AdStatCard extends HTMLElement {
  static observedAttributes = ['label', 'value', 'meta', 'tone', 'icon'];

  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  attributeChangedCallback() {
    if (this._built) this.render();
  }

  build() {
    // '.widjets-theme-2' is the kit's scope for the tone classes below.
    this.classList.add('widjets-theme-2');

    this._widget = document.createElement('div');
    this._widget.className = 'neutral-widjet primary';

    const body = document.createElement('div');
    body.className = 'widjet-body';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'icon';
    this._iconImg = document.createElement('img');
    this._iconImg.alt = '';
    this._iconImg.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(this._iconImg);

    const content = document.createElement('div');
    content.className = 'content';
    this._value = document.createElement('p');
    // The KPI figure is always Latin digits (see scripts/format.js), so it is
    // isolated from the bidi algorithm in Arabic. The isolation goes on the
    // block itself: the kit styles *any* <span> inside .content as its small
    // caption line, so wrapping the figure in one shrinks it to caption size.
    this._value.className = 'number ad-ltr-block';
    this._valueText = this._value;
    this._label = document.createElement('p');
    this._meta = document.createElement('span');
    content.append(this._value, this._label, this._meta);

    body.append(iconWrap, content);
    this._widget.appendChild(body);

    this.textContent = '';
    this.appendChild(this._widget);
    this._built = true;
  }

  set value(next) {
    this.setAttribute('value', next ?? t('common.notAvailable'));
  }

  get value() {
    return this.getAttribute('value') ?? '';
  }

  set meta(next) {
    this.setAttribute('meta', next ?? '');
  }

  render() {
    const tone = String(this.getAttribute('tone') ?? '').trim();
    this._widget.className = `neutral-widjet ${TONES.has(tone) ? tone : 'primary'}`;

    this._iconImg.src = iconUrl(this.getAttribute('icon') || DEFAULT_ICON);

    this._label.textContent = this.getAttribute('label') ?? '';
    this._valueText.textContent = this.getAttribute('value') ?? t('common.notAvailable');

    const meta = this.getAttribute('meta') ?? '';
    this._meta.textContent = meta;
    this._meta.hidden = !meta;
  }
}

if (!customElements.get('ad-stat-card')) {
  customElements.define('ad-stat-card', AdStatCard);
}
