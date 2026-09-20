/**
 * ad-combobox.js — SheDrive admin searchable person picker
 *
 * A single control that replaces the delivered kit's redundant pair of a
 * free-text "Search by driver name …" box next to a name-only
 * "Select Driver …" dropdown. The admin types either a name **or a phone
 * number**, sees the matches with both on the row, and picks one.
 *
 * Phone matters: a driver rings the office about a payment and gives her
 * number, not her spelling. Matching on digits only means 0100 123 4567,
 * 01001234567 and +20 100 123 4567 all find the same person.
 *
 * Light DOM, kit vocabulary (`.form-control`), WAI-ARIA 1.2 combobox pattern:
 *
 *   <ad-combobox>
 *     <div class="ad-combobox">
 *       <input class="form-control ad-combobox__input" role="combobox"
 *              aria-expanded aria-controls aria-autocomplete="list">
 *       <button class="ad-combobox__clear" type="button">…</button>
 *       <ul class="ad-combobox__list" role="listbox">
 *         <li class="ad-combobox__option" role="option">
 *           <span class="ad-combobox__name">…</span>
 *           <span class="ad-combobox__meta">…</span>
 *         </li>
 *       </ul>
 *       <span class="ad-combobox__status" role="status"></span>
 *     </div>
 *   </ad-combobox>
 *
 * Usage:
 *   const box = document.createElement('ad-combobox');
 *   box.placeholder = t('reconciliation.driverPlaceholder');
 *   box.options = drivers.map((d) => ({
 *     value: String(d.id),
 *     label: d.name,          // primary line, and what the input shows once picked
 *     meta: d.phone,          // secondary line; matched on digits
 *     note: t('status.suspended'), // optional trailing qualifier
 *   }));
 *   box.value = '';           // selected option's `value`, '' when nothing is picked
 *
 * Events: 'change' (bubbles) → detail { value, option }.
 *
 * Contract notes for <ad-form-modal>, which drives it like a native control:
 *   - `value` is a real property getter/setter, so `control.value` reads back.
 *   - `focus()` forwards to the inner input, so validation can focus the field.
 *   - `id` / `name` set on the host are forwarded to the inner input.
 *   - The inner input matches the modal's `input:not([readonly])` focus query.
 *
 * Every string this component generates comes from `t()`. Option labels and the
 * placeholder are supplied already translated by the screen.
 */

import { t } from '../scripts/admin-i18n.js';

/**
 * Matching a phone means matching its digits, whatever the typed formatting —
 * and whatever the notation. An Egyptian mobile is written 01012345678 locally,
 * +20 101 234 5678 internationally and 1012345678 in the records; all three are
 * the same number, so each is reduced to the national form before comparing.
 */
function digits(value) {
  const raw = String(value ?? '').replace(/\D+/g, '');
  return raw.replace(/^(?:00)?20/, '').replace(/^0+/, '');
}

function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * An option matches when the query is a substring of its label, of any extra
 * search term, or — once the query contains digits — of its meta's digits.
 */
function matches(option, query) {
  const term = normalise(query);
  if (!term) return true;

  const haystack = [option.label, option.note, ...(option.search ?? [])]
    .filter(Boolean)
    .map(normalise);
  if (haystack.some((value) => value.includes(term))) return true;

  const typed = digits(term);
  return typed.length > 0 && digits(option.meta).includes(typed);
}

class AdCombobox extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._options = this._options ?? [];
    this._value = this._value ?? '';
    this._open = false;
    this._activeIndex = -1;
    this._filtered = [];
    this._built = true;
  }

  // ── Public API ──────────────────────────────────────

  set options(options) {
    this._options = (options ?? []).map((option) => ({
      ...option,
      value: String(option.value),
    }));
    // A value that no longer exists in the list is no longer a selection.
    if (this._value && !this.optionFor(this._value)) this._value = '';
    if (this._built) this.render();
  }

  get options() {
    return this._options ?? [];
  }

  set placeholder(text) {
    this._placeholder = text ?? '';
    if (this._input) this._input.placeholder = this._placeholder;
  }

  get placeholder() {
    return this._placeholder ?? '';
  }

  set value(next) {
    this._value = next === null || next === undefined ? '' : String(next);
    if (this._input) this.syncInputToValue();
  }

  get value() {
    return this._value ?? '';
  }

  /** The full option object behind `value`, or null. */
  get selectedOption() {
    return this.optionFor(this._value) ?? null;
  }

  focus() {
    this._input?.focus();
  }

  optionFor(value) {
    return (this._options ?? []).find((option) => option.value === String(value));
  }

  // ── Rendering ───────────────────────────────────────

  render() {
    const hadFocus = this._input && document.activeElement === this._input;
    this.textContent = '';

    const shell = document.createElement('div');
    shell.className = 'ad-combobox';

    const listId = `${this.id || `ad-combobox-${Math.random().toString(36).slice(2, 8)}`}-listbox`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control ad-combobox__input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = this._placeholder ?? '';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);
    if (this.id) input.id = this.id;
    if (this.name) input.name = this.name;
    this._input = input;

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ad-combobox__clear';
    clear.setAttribute('aria-label', t('combobox.clear'));
    // Static icon markup only.
    clear.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    clear.hidden = true;
    this._clear = clear;

    const list = document.createElement('ul');
    list.className = 'ad-combobox__list';
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    this._list = list;

    // Announces the result count to a screen reader as the admin types.
    const status = document.createElement('span');
    status.className = 'ad-combobox__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this._status = status;

    shell.append(input, clear, list, status);
    this.appendChild(shell);

    this.bind();
    this.syncInputToValue();
    if (hadFocus) input.focus();
  }

  bind() {
    const input = this._input;

    input.addEventListener('input', () => {
      this.openList(input.value);
      // Typing past a selection means the selection is no longer what is shown.
      if (this._value && normalise(this.selectedOption?.label) !== normalise(input.value)) {
        this.commit('', { silent: false });
      }
      this._clear.hidden = input.value === '';
    });

    input.addEventListener('focus', () => this.openList(input.value, { all: !this._value }));

    input.addEventListener('keydown', (event) => this.handleKey(event));

    // A click outside, or a tab away, must not leave free text that means
    // nothing — restore the picked option's label, or empty the box.
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (this.contains(document.activeElement)) return;
        this.closeList();
        this.syncInputToValue();
      }, 0);
    });

    this._clear.addEventListener('click', () => {
      this.commit('');
      this._input.value = '';
      this._clear.hidden = true;
      this._input.focus();
      this.openList('', { all: true });
    });

    this._list.addEventListener('mousedown', (event) => {
      // Keep focus on the input so blur never fires between press and click.
      event.preventDefault();
    });

    this._list.addEventListener('click', (event) => {
      const option = event.target.closest('.ad-combobox__option');
      if (!option || option.dataset.value === undefined) return;
      this.pick(option.dataset.value);
    });
  }

  // ── List behaviour ──────────────────────────────────

  openList(query, { all = false } = {}) {
    const term = all ? '' : query;
    this._filtered = (this._options ?? []).filter((option) => matches(option, term));
    this._activeIndex = this._filtered.findIndex((option) => option.value === this._value);
    this._open = true;
    this.paintList();
  }

  closeList() {
    this._open = false;
    this._activeIndex = -1;
    this._list.hidden = true;
    this._list.textContent = '';
    this._input.setAttribute('aria-expanded', 'false');
    this._input.removeAttribute('aria-activedescendant');
  }

  paintList() {
    const list = this._list;
    list.textContent = '';

    if (!this._filtered.length) {
      const empty = document.createElement('li');
      empty.className = 'ad-combobox__empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = t('combobox.noMatches');
      list.appendChild(empty);
      this._status.textContent = t('combobox.noMatches');
    } else {
      this._filtered.forEach((option, index) => {
        const item = document.createElement('li');
        item.className = 'ad-combobox__option';
        item.id = `${list.id}-opt-${index}`;
        item.setAttribute('role', 'option');
        item.dataset.value = option.value;
        item.setAttribute('aria-selected', option.value === this._value ? 'true' : 'false');
        if (index === this._activeIndex) item.classList.add('is-active');

        const name = document.createElement('span');
        name.className = 'ad-combobox__name';
        name.textContent = option.label;
        item.appendChild(name);

        if (option.note) {
          const note = document.createElement('span');
          note.className = 'ad-combobox__note';
          note.textContent = option.note;
          item.appendChild(note);
        }

        if (option.meta) {
          const meta = document.createElement('span');
          // Phone numbers keep their own direction inside the Arabic portal.
          meta.className = 'ad-combobox__meta ad-ltr';
          meta.textContent = option.meta;
          item.appendChild(meta);
        }

        list.appendChild(item);
      });
      this._status.textContent = t('combobox.resultCount', { count: this._filtered.length });
    }

    list.hidden = false;
    this._input.setAttribute('aria-expanded', 'true');
    this.syncActiveDescendant();
  }

  syncActiveDescendant() {
    const items = Array.from(this._list.querySelectorAll('.ad-combobox__option'));
    items.forEach((item, index) => item.classList.toggle('is-active', index === this._activeIndex));
    const active = items[this._activeIndex];
    if (active) {
      this._input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      this._input.removeAttribute('aria-activedescendant');
    }
  }

  move(delta) {
    if (!this._open) {
      this.openList(this._input.value, { all: !this._input.value });
      return;
    }
    if (!this._filtered.length) return;
    const last = this._filtered.length - 1;
    let next = this._activeIndex + delta;
    if (next < 0) next = last;
    if (next > last) next = 0;
    this._activeIndex = next;
    this.syncActiveDescendant();
  }

  handleKey(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Home':
        if (!this._open) return;
        event.preventDefault();
        this._activeIndex = 0;
        this.syncActiveDescendant();
        break;
      case 'End':
        if (!this._open) return;
        event.preventDefault();
        this._activeIndex = this._filtered.length - 1;
        this.syncActiveDescendant();
        break;
      case 'Enter': {
        if (!this._open || this._activeIndex < 0) return;
        // Inside <ad-form-modal> a bare Enter would otherwise submit the form.
        event.preventDefault();
        this.pick(this._filtered[this._activeIndex].value);
        break;
      }
      case 'Escape':
        if (!this._open) return;
        event.preventDefault();
        this.closeList();
        this.syncInputToValue();
        break;
      default:
        break;
    }
  }

  // ── Selection ───────────────────────────────────────

  pick(value) {
    this.commit(value);
    this.closeList();
    this.syncInputToValue();
    this._input.focus();
  }

  commit(value, { silent = false } = {}) {
    const next = value === null || value === undefined ? '' : String(value);
    if (next === this._value) return;
    this._value = next;
    if (!silent) {
      this.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: this._value, option: this.selectedOption },
        }),
      );
    }
  }

  /** Put the picked option's label back in the box — or empty it. */
  syncInputToValue() {
    const option = this.selectedOption;
    this._input.value = option ? option.label : '';
    this._clear.hidden = this._input.value === '';
  }
}

if (!customElements.get('ad-combobox')) {
  customElements.define('ad-combobox', AdCombobox);
}

export { AdCombobox };
