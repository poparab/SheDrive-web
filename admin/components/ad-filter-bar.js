/**
 * ad-filter-bar.js — SheDrive admin list filter row
 * Search, dropdowns, and date ranges built from a field spec, plus an actions
 * area for Reset and Export. Emits one consolidated 'change' event so screens
 * hold a single filter state object.
 *
 * Usage:
 *   bar.fields = [
 *     { type: 'search', key: 'search', label: 'Search', placeholder: 'Name or phone', grow: true },
 *     { type: 'select', key: 'status', label: 'Status', value: 'all',
 *       options: [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }] },
 *     { type: 'daterange', key: 'date', label: 'Submission date',
 *       fromKey: 'from', toKey: 'to' },
 *   ];
 *   bar.actions = [{ label: 'Export CSV', variant: 'ghost', onClick: () => exportCsv() }];
 *   bar.value;                       // { search: '', status: 'all', from: '', to: '' }
 *
 * Events: 'change' (bubbles) → detail is the full value object.
 * Search inputs are debounced by 300 ms; selects and dates fire immediately.
 */

const DEBOUNCE_MS = 300;

class AdFilterBar extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this.classList.add('ad-filters');
    this._fields = this._fields ?? [];
    this._actions = this._actions ?? [];
    this._state = this._state ?? {};
    this._inputs = new Map();
    this._built = true;
  }

  set fields(fields) {
    this._fields = fields ?? [];
    this._state = {};
    this._fields.forEach((field) => {
      if (field.type === 'daterange') {
        this._state[field.fromKey ?? 'from'] = field.from ?? '';
        this._state[field.toKey ?? 'to'] = field.to ?? '';
      } else {
        this._state[field.key] = field.value ?? '';
      }
    });
    if (this._built) this.render();
  }

  get fields() {
    return this._fields ?? [];
  }

  set actions(actions) {
    this._actions = actions ?? [];
    if (this._built) this.render();
  }

  /** Current filter state — pass straight into a mock-api list method. */
  get value() {
    return { ...this._state };
  }

  /** Programmatically set one key without firing a change event. */
  setValue(key, value) {
    this._state[key] = value;
    const input = this._inputs.get(key);
    if (input) input.value = value;
  }

  reset() {
    this.fields = this._fields.map((field) => ({ ...field }));
    this.emitChange();
  }

  emitChange() {
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: this.value }));
  }

  render() {
    this.textContent = '';
    this._inputs.clear();

    (this._fields ?? []).forEach((field) => {
      const wrap = document.createElement('div');
      wrap.className = 'ad-filters__field';
      if (field.grow) wrap.classList.add('ad-filters__field--grow');

      const inputId = `filter-${field.key ?? field.fromKey}`;
      const label = document.createElement('label');
      label.className = 'ad-filters__label';
      label.textContent = field.label;
      label.htmlFor = inputId;
      wrap.appendChild(label);

      if (field.type === 'select') {
        const select = document.createElement('select');
        select.className = 'input';
        select.id = inputId;
        (field.options ?? []).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          if (String(option.value) === String(this._state[field.key])) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => {
          this._state[field.key] = select.value;
          this.emitChange();
        });
        this._inputs.set(field.key, select);
        wrap.appendChild(select);
      } else if (field.type === 'daterange') {
        const fromKey = field.fromKey ?? 'from';
        const toKey = field.toKey ?? 'to';

        const range = document.createElement('div');
        range.className = 'ad-filters__range';

        const from = document.createElement('input');
        from.type = 'date';
        from.className = 'input';
        from.id = inputId;
        from.value = this._state[fromKey] ?? '';
        from.setAttribute('aria-label', `${field.label} from`);

        const to = document.createElement('input');
        to.type = 'date';
        to.className = 'input';
        to.value = this._state[toKey] ?? '';
        to.setAttribute('aria-label', `${field.label} to`);

        const error = document.createElement('span');
        error.className = 'field__error';
        error.hidden = true;

        const onRangeChange = () => {
          // #1810/#1832: the end date must not precede the start date.
          if (from.value && to.value && to.value < from.value) {
            error.textContent = 'End date must be after start date';
            error.hidden = false;
            to.classList.add('input--error');
            return;
          }
          error.hidden = true;
          to.classList.remove('input--error');
          this._state[fromKey] = from.value;
          this._state[toKey] = to.value;
          this.emitChange();
        };

        from.addEventListener('change', onRangeChange);
        to.addEventListener('change', onRangeChange);

        const dash = document.createElement('span');
        dash.textContent = 'to';
        range.append(from, dash, to);

        this._inputs.set(fromKey, from);
        this._inputs.set(toKey, to);
        wrap.append(range, error);
      } else {
        const input = document.createElement('input');
        input.type = field.type === 'search' ? 'search' : 'text';
        input.className = 'input';
        input.id = inputId;
        input.placeholder = field.placeholder ?? '';
        input.value = this._state[field.key] ?? '';
        if (field.maxLength) input.maxLength = field.maxLength;

        let timer;
        input.addEventListener('input', () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            this._state[field.key] = input.value.trim();
            this.emitChange();
          }, DEBOUNCE_MS);
        });

        this._inputs.set(field.key, input);
        wrap.appendChild(input);
      }

      this.appendChild(wrap);
    });

    if ((this._actions ?? []).length) {
      const actions = document.createElement('div');
      actions.className = 'ad-filters__actions';

      this._actions.forEach((action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn btn--${action.variant ?? 'ghost'} btn--sm`;
        btn.textContent = action.label;
        if (action.disabled) btn.disabled = true;
        if (action.stub) {
          btn.title = action.stub;
          btn.disabled = true;
        }
        btn.addEventListener('click', () => action.onClick?.(this.value));
        actions.appendChild(btn);
      });

      this.appendChild(actions);
    }
  }
}

if (!customElements.get('ad-filter-bar')) {
  customElements.define('ad-filter-bar', AdFilterBar);
}
