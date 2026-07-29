/**
 * ad-timeline.js — SheDrive admin chronological state history
 * Used for trip state transitions (#1671) and driver decision history (#1666).
 *
 * Usage: timeline.items = [
 *   { label: 'Trip started', meta: '14 Jul 2026, 09:42', note: null, tone: 'default' },
 * ];
 * tone: 'default' | 'muted' | 'success' | 'danger'
 */

class AdTimeline extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._list = document.createElement('ol');
    this._list.className = 'ad-timeline';
    this.textContent = '';
    this.appendChild(this._list);
    this._built = true;
  }

  set items(items) {
    this._items = items ?? [];
    if (this._built) this.render();
  }

  get items() {
    return this._items ?? [];
  }

  render() {
    const items = this._items ?? [];
    this._list.textContent = '';

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'ad-timeline__item';
      if (item.tone && item.tone !== 'default') {
        li.classList.add(`ad-timeline__item--${item.tone}`);
      }

      const marker = document.createElement('span');
      marker.className = 'ad-timeline__marker';
      const dot = document.createElement('span');
      dot.className = 'ad-timeline__dot';
      marker.appendChild(dot);

      const body = document.createElement('div');
      const label = document.createElement('div');
      label.className = 'ad-timeline__label';
      label.textContent = item.label ?? '';
      body.appendChild(label);

      if (item.meta) {
        const meta = document.createElement('div');
        meta.className = 'ad-timeline__meta';
        meta.textContent = item.meta;
        body.appendChild(meta);
      }

      if (item.note) {
        const note = document.createElement('p');
        note.className = 'ad-timeline__note';
        note.textContent = item.note;
        body.appendChild(note);
      }

      li.append(marker, body);
      this._list.appendChild(li);
    });
  }
}

if (!customElements.get('ad-timeline')) {
  customElements.define('ad-timeline', AdTimeline);
}
