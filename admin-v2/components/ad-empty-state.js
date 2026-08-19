/**
 * ad-empty-state.js — SheDrive admin empty / not-found / error placeholder
 *
 * Renders the delivered design kit's centred result block:
 *
 *   <div class="result-message primary">
 *     <span class="icon"><img src="vendor/icons/not-found.svg" alt=""></span>
 *     <h3>heading</h3>
 *     <p>message</p>
 *     …slotted action buttons…
 *   </div>
 *
 * Usage: <ad-empty-state icon="⚑" heading="No open reports"
 *          message="Nothing needs triage right now."></ad-empty-state>
 *        <ad-empty-state icon="not-found.svg" tone="warning" …>
 *
 * Attributes:
 *   icon    — either a kit icon file name ending in `.svg`, or one of the
 *             legacy glyphs the screen scripts still pass (mapped below).
 *   heading — the `<h3>`
 *   message — the `<p>`
 *   tone    — primary | info | success | warning | danger (default primary)
 *
 * With neither `heading` nor `message` set, the block falls back to core's
 * translated `state.emptyHeading` / `state.emptyMessage`.
 *
 * Children present at mount are moved below the message and act as the
 * result block's buttons; `state.actions` returns that container so a caller
 * can append a retry button after construction.
 */

import { iconUrl } from './ad-styles.js';
import { t } from '../scripts/admin-i18n.js';

const TONES = new Set(['primary', 'info', 'success', 'warning', 'danger']);

/**
 * The screen scripts predate the kit and pass single-glyph icons. Map the
 * known ones onto kit SVGs; anything unrecognised falls back to not-found.
 */
const GLYPH_ICONS = {
  '⚠': 'cloud-connection-off.svg',
  '☐': 'not-found.svg',
  '⛟': 'steering-wheel.svg',
  '⚑': 'shield.svg',
  '☺': 'user-star.svg',
  '⊕': 'applications.svg',
  '⇄': 'trips.svg',
  '⇌': 'trips.svg',
  '☰': 'file-checked.svg',
  '⚿': 'users.svg',
  '✓': 'checked-2.svg',
  '◎': 'target.svg',
};

const FALLBACK_ICON = 'not-found.svg';

/** Resolve an `icon` attribute value to a kit icon file name. */
function resolveIcon(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/\.svg$/i.test(raw)) return raw;
  return GLYPH_ICONS[raw] ?? FALLBACK_ICON;
}

class AdEmptyState extends HTMLElement {
  static observedAttributes = ['icon', 'heading', 'message', 'tone'];

  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  attributeChangedCallback() {
    if (this._built) this.render();
  }

  build() {
    const passthrough = Array.from(this.childNodes);

    this._block = document.createElement('div');
    this._block.className = 'result-message primary';

    this._icon = document.createElement('span');
    this._icon.className = 'icon';
    this._iconImg = document.createElement('img');
    this._iconImg.alt = '';
    this._iconImg.setAttribute('aria-hidden', 'true');
    this._icon.appendChild(this._iconImg);

    this._heading = document.createElement('h3');
    this._message = document.createElement('p');

    // The kit styles direct `.btn` children of `.result-message`, so actions
    // live in the block itself rather than in a wrapper.
    this._actions = document.createElement('div');
    this._actions.className = 'ad-state__actions';

    this._block.append(this._icon, this._heading, this._message, this._actions);

    this.textContent = '';
    this.appendChild(this._block);
    passthrough.forEach((node) => this._actions.appendChild(node));
    this._built = true;
  }

  render() {
    const tone = String(this.getAttribute('tone') ?? '').trim();
    this._block.className = `result-message ${TONES.has(tone) ? tone : 'primary'}`;

    const icon = resolveIcon(this.getAttribute('icon'));
    if (icon) this._iconImg.src = iconUrl(icon);
    this._icon.hidden = !icon;

    // A block with neither attribute is a bare <ad-empty-state> placed by a
    // screen that has nothing of its own to say — fall back to core's copy
    // rather than rendering an empty card. One attribute is enough to opt out,
    // so a heading-only or message-only block still renders exactly as asked.
    const bare =
      !this.hasAttribute('heading') && !this.hasAttribute('message');

    const heading = this.getAttribute('heading') ?? (bare ? t('state.emptyHeading') : '');
    this._heading.textContent = heading;
    this._heading.hidden = !heading;

    const message = this.getAttribute('message') ?? (bare ? t('state.emptyMessage') : '');
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
