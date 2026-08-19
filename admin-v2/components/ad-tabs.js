/**
 * ad-tabs.js — SheDrive admin in-page tab strip (v2 design)
 *
 * The delivered kit has no tab component, so the strip keeps its own markup:
 * a `.ad-tabs` tablist of `.ad-tabs__btn` buttons. Those two class names are
 * re-skinned onto the kit palette by styles/admin-bridge.css, and given the
 * kit's card-edge polish (hover wash, rounded top corners) by styles/detail.css
 * — there is no bespoke CSS in this file.
 *
 * Usage: tabs.tabs = [{ key: 'zones', label: 'Zones' }, { key: 'rates', label: 'Rate cards' }];
 *        tabs.active = 'zones';
 * Emits a bubbling 'tabchange' with event.detail.key.
 *
 * Tab labels are supplied already translated by the screen; the strip itself
 * only contributes the tablist's `aria-label`.
 */

import { t } from '../scripts/admin-i18n.js';

class AdTabs extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._strip = document.createElement('div');
    this._strip.className = 'ad-tabs';
    this._strip.setAttribute('role', 'tablist');
    this._strip.setAttribute('aria-label', t('tabs.label'));
    this.textContent = '';
    this.appendChild(this._strip);
    this._built = true;
  }

  set tabs(tabs) {
    this._tabs = tabs ?? [];
    if (!this._active && this._tabs.length) this._active = this._tabs[0].key;
    if (this._built) this.render();
  }

  get tabs() {
    return this._tabs ?? [];
  }

  set active(key) {
    this._active = key;
    if (this._built) this.render();
  }

  get active() {
    return this._active ?? null;
  }

  render() {
    this._strip.textContent = '';
    (this._tabs ?? []).forEach((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ad-tabs__btn';
      btn.setAttribute('role', 'tab');
      btn.textContent = tab.label;
      const selected = tab.key === this._active;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      btn.addEventListener('click', () => {
        if (tab.key === this._active) return;
        this.active = tab.key;
        this.dispatchEvent(
          new CustomEvent('tabchange', { bubbles: true, detail: { key: tab.key } }),
        );
      });
      this._strip.appendChild(btn);
    });
  }
}

if (!customElements.get('ad-tabs')) {
  customElements.define('ad-tabs', AdTabs);
}
