/**
 * ad-detail-section.js — SheDrive admin key/value detail block (v2 design)
 * The standard presentation for profile and detail-pane facts, rendered as the
 * delivered kit's `.standard-card-theme2.white-bg` card: a `.card-header` with
 * the title, an optional subtitle and a round SVG icon, and a `.card-body`
 * holding the kit's `.list-multi-column > .row > .col > .row.list-row` pairs.
 *
 * The legacy `ad-detail-grid` / `ad-detail-item` / `ad-detail-item__*` class
 * names ride along on the same nodes, so screen CSS written against the old
 * markup still matches.
 *
 * Usage:
 *   <ad-detail-section section-title="Personal details"
 *                      icon="user-2.svg"></ad-detail-section>
 *   section.items = [{ label: 'Full name', value: 'Nour Hassan' }];
 *
 * Attributes:
 *   section-title — the card heading (h5)
 *   hint          — optional subtitle rendered in the kit's title slot
 *   icon          — a file name in vendor/icons/ (default 'profile-info.svg')
 *
 * `value` accepts a string or a Node (e.g. an <ad-status-pill>).
 * Pass `muted: true` for a de-emphasised value, `wide: true` to let the value
 * wrap onto its own full-width line, and `ltr: true` when the value is Latin
 * data — an id, phone number, email, plate number or money — that must not
 * be re-ordered by the bidi algorithm in Arabic.
 *
 * `section-title`, `hint` and every item label/value are supplied already
 * translated by the screen; the component itself only contributes the em-dash
 * placeholder for an empty value.
 *
 * Slotted children are preserved: `data-slot="actions"` moves into the card
 * header, anything else is appended below the key/value list.
 */

import { iconUrl } from './ad-styles.js';
import { t } from '../scripts/admin-i18n.js';

const DEFAULT_ICON = 'profile-info.svg';

class AdDetailSection extends HTMLElement {
  static observedAttributes = ['section-title', 'hint', 'icon'];

  connectedCallback() {
    if (!this._built) this.build();
    this.renderHeader();
    this.renderItems();
  }

  attributeChangedCallback() {
    if (this._built) this.renderHeader();
  }

  build() {
    // Slotted markup (an action button, a nested table) is preserved and moved
    // into the body after the key/value list.
    const passthrough = Array.from(this.childNodes);

    this.classList.add('ad-detail-section');

    this._card = document.createElement('div');
    this._card.className = 'standard-card-theme2 white-bg';

    this._header = document.createElement('div');
    this._header.className = 'card-header ad-section__header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'card-title';
    this._titleEl = document.createElement('h5');
    this._titleEl.className = 'ad-section__title';
    // The kit's own cards carry an empty <spam> in this slot; it is the card's
    // subtitle line, so the `hint` attribute renders there.
    this._hintEl = document.createElement('spam');
    this._hintEl.className = 'ad-section__hint';
    titleWrap.append(this._titleEl, this._hintEl);

    this._actions = document.createElement('div');
    this._actions.className = 'ad-row ad-detail-section__actions';

    this._iconWrap = document.createElement('div');
    this._iconWrap.className = 'icon';
    this._iconImg = document.createElement('img');
    this._iconImg.alt = '';
    this._iconImg.setAttribute('aria-hidden', 'true');
    this._iconWrap.appendChild(this._iconImg);

    this._header.append(titleWrap, this._actions, this._iconWrap);

    this._body = document.createElement('div');
    this._body.className = 'card-body pb-0 ad-section__body ad-stack';

    this._grid = document.createElement('div');
    this._grid.className = 'list-multi-column no-border p-0 ad-detail-grid';
    const gridRow = document.createElement('div');
    gridRow.className = 'row gx-4';
    this._gridCol = document.createElement('div');
    this._gridCol.className = 'col';
    gridRow.appendChild(this._gridCol);
    this._grid.appendChild(gridRow);

    this._extra = document.createElement('div');
    this._extra.className = 'ad-stack';
    this._body.append(this._grid, this._extra);

    this._card.append(this._header, this._body);

    this.textContent = '';
    this.appendChild(this._card);

    passthrough.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.slot === 'actions') {
        this._actions.appendChild(node);
      } else {
        this._extra.appendChild(node);
      }
    });

    this._built = true;
  }

  renderHeader() {
    const title = this.getAttribute('section-title') ?? '';
    const hint = this.getAttribute('hint') ?? '';
    this._titleEl.textContent = title;
    this._hintEl.textContent = hint;
    this._hintEl.hidden = !hint;
    this._iconImg.src = iconUrl(this.getAttribute('icon') || DEFAULT_ICON);
    this._header.hidden = !title && !hint && !this._actions.childNodes.length;
  }

  /** @param {Array<{label:string,value:string|Node,muted?:boolean,wide?:boolean}>} items */
  set items(items) {
    this._items = items ?? [];
    if (this._built) this.renderItems();
  }

  get items() {
    return this._items ?? [];
  }

  /** Append arbitrary content below the key/value list. */
  get body() {
    return this._extra;
  }

  get actions() {
    return this._actions;
  }

  renderItems() {
    const items = this._items ?? [];
    this._gridCol.textContent = '';
    this._grid.hidden = items.length === 0;

    items.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'row gx-0 list-row ad-detail-item';
      if (item.wide) wrap.classList.add('ad-detail-item--wide');

      const label = document.createElement('div');
      label.className = 'list-item col text-bold ad-detail-item__label';
      label.textContent = item.label;

      const value = document.createElement('div');
      value.className = 'list-item col-auto justify-content-md-end ad-detail-item__value';
      if (item.muted) value.classList.add('ad-detail-item__value--muted');
      // Latin data (ids, phone numbers, emails, plate numbers, money) keeps its
      // own direction beside an Arabic label — styles/admin-rtl.css isolates it.
      if (item.ltr) value.classList.add('ad-ltr', 'ad-detail-item__value--ltr');

      if (item.value instanceof Node) {
        value.appendChild(item.value);
      } else {
        value.textContent = item.value === null || item.value === undefined || item.value === ''
          ? t('common.notAvailable')
          : String(item.value);
      }

      wrap.append(label, value);
      this._gridCol.appendChild(wrap);
    });
  }
}

if (!customElements.get('ad-detail-section')) {
  customElements.define('ad-detail-section', AdDetailSection);
}
