/**
 * ad-timeline.js — SheDrive admin chronological state history (v2 design)
 * Used for trip state transitions (#1671) and driver decision history (#1666).
 *
 * Renders the delivered kit's vertical timeline:
 *
 *   <ol class="timeline-vertical">
 *     <li class="success"><lable>Trip ended</lable><span>13 Aug, 11:47</span></li>
 *   </ol>
 *
 * `<lable>` is the kit's own (misspelled) element name — the kit's CSS targets
 * it, so it is matched here verbatim. It is a plain inline element carrying
 * readable text, so nothing is hidden from assistive technology.
 *
 * Tones map onto the kit's `li` modifiers: 'success' and 'danger' exist in the
 * kit, 'muted' is added by styles/detail.css. The legacy `ad-timeline__*`
 * class names ride along on the same nodes for any screen CSS that used them.
 *
 * Usage: timeline.items = [
 *   { label: 'Trip started', meta: '14 Jul 2026, 09:42', note: null, tone: 'default' },
 * ];
 * tone: 'default' | 'muted' | 'success' | 'danger'
 *
 * `label`, `meta` and `note` are supplied already translated by the screen —
 * screens build them from `statusLabel()` and scripts/format.js, both of which
 * are bilingual — so the component generates no copy of its own.
 */

const KIT_TONE = {
  muted: 'muted',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  active: 'active',
};

class AdTimeline extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._list = document.createElement('ol');
    this._list.className = 'timeline-vertical ad-timeline';
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
        const kitTone = KIT_TONE[item.tone];
        if (kitTone) li.classList.add(kitTone);
      }

      const label = document.createElement('lable');
      label.className = 'ad-timeline__label';
      label.textContent = item.label ?? '';
      li.appendChild(label);

      if (item.meta) {
        const meta = document.createElement('span');
        meta.className = 'ad-timeline__meta';
        meta.textContent = item.meta;
        li.appendChild(meta);
      }

      if (item.note) {
        const note = document.createElement('p');
        note.className = 'ad-timeline__note';
        note.textContent = item.note;
        li.appendChild(note);
      }

      this._list.appendChild(li);
    });
  }
}

if (!customElements.get('ad-timeline')) {
  customElements.define('ad-timeline', AdTimeline);
}
