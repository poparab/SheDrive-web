/**
 * ad-detail-section.js — SheDrive admin key/value detail block
 * The standard presentation for profile and detail-pane facts.
 *
 * Usage:
 *   <ad-detail-section section-title="Personal details"></ad-detail-section>
 *   section.items = [{ label: 'Full name', value: 'Nour Hassan' }];
 *
 * `value` accepts a string or a Node (e.g. an <ad-status-pill>).
 * Pass `muted: true` for a de-emphasised value, `wide: true` to span the grid.
 */

class AdDetailSection extends HTMLElement {
  static observedAttributes = ['section-title', 'hint'];

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
    // into the body after the key/value grid.
    const passthrough = Array.from(this.childNodes);

    this.classList.add('ad-section');
    this._header = document.createElement('div');
    this._header.className = 'ad-section__header';
    this._titleEl = document.createElement('h2');
    this._titleEl.className = 'ad-section__title';
    this._actions = document.createElement('div');
    this._actions.className = 'ad-row';
    this._header.append(this._titleEl, this._actions);

    this._body = document.createElement('div');
    this._body.className = 'ad-section__body ad-stack';
    this._grid = document.createElement('div');
    this._grid.className = 'ad-detail-grid';
    this._extra = document.createElement('div');
    this._extra.className = 'ad-stack';
    this._body.append(this._grid, this._extra);

    this.textContent = '';
    this.append(this._header, this._body);

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
    this._titleEl.textContent = title;
    this._header.hidden = !title && !this._actions.childNodes.length;
  }

  /** @param {Array<{label:string,value:string|Node,muted?:boolean,wide?:boolean}>} items */
  set items(items) {
    this._items = items ?? [];
    if (this._built) this.renderItems();
  }

  get items() {
    return this._items ?? [];
  }

  /** Append arbitrary content below the key/value grid. */
  get body() {
    return this._extra;
  }

  get actions() {
    return this._actions;
  }

  renderItems() {
    const items = this._items ?? [];
    this._grid.textContent = '';
    this._grid.hidden = items.length === 0;

    items.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'ad-detail-item';
      if (item.wide) wrap.style.gridColumn = '1 / -1';

      const label = document.createElement('span');
      label.className = 'ad-detail-item__label';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'ad-detail-item__value';
      if (item.muted) value.classList.add('ad-detail-item__value--muted');

      if (item.value instanceof Node) {
        value.appendChild(item.value);
      } else {
        value.textContent = item.value === null || item.value === undefined || item.value === ''
          ? '—'
          : String(item.value);
      }

      wrap.append(label, value);
      this._grid.appendChild(wrap);
    });
  }
}

if (!customElements.get('ad-detail-section')) {
  customElements.define('ad-detail-section', AdDetailSection);
}
