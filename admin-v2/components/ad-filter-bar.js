/**
 * ad-filter-bar.js — SheDrive admin list filter row (v2 design)
 * Search, dropdowns, and date ranges built from a field spec, plus an actions
 * area for Reset and Export. Emits one consolidated 'change' event so screens
 * hold a single filter state object.
 *
 * Renders the delivered design kit's filter row:
 *
 *   <form>
 *     <div class="filter-container white-bg">
 *       <i class="fa-solid fa-sliders"></i>
 *       …labelled controls (input.form-control / select.form-select /
 *          .date-inputs-container)…
 *       <div class="end-side ms-auto">…buttons…</div>
 *     </div>
 *   </form>
 *
 * Each control keeps its visible `<label class="ad-filters__label">` inside an
 * `.ad-filters__field` wrapper — the portal's grids carry more filters than
 * the kit's static pages, so an unlabelled row would be unreadable.
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
 * A range whose end date precedes its start date is rejected with a
 * `.field__error` message and no 'change' event.
 *
 * Every string this component generates — the range separator, the two date
 * `aria-label`s and the range error — comes from `t()`. Field labels, option
 * labels and action labels are supplied already translated by the screen.
 *
 * Action `variant` maps onto the kit's buttons: 'primary' → `.btn-primary`,
 * anything else → `.btn-tertiary`. Labels that read as Reset or Export pick up
 * the kit's leading icon automatically.
 */

import { t } from '../scripts/admin-i18n.js';

const DEBOUNCE_MS = 300;

/**
 * Leading Font Awesome glyphs for the action labels the screens use. The
 * patterns carry the Arabic wording too (the kit's own «إعادة تعيين» / «بحث»),
 * so a translated label keeps its icon.
 */
const ACTION_ICONS = [
  [/reset|clear|إعادة تعيين|مسح/i, 'fa-arrows-rotate'],
  [/export|download|csv|تصدير|تنزيل/i, 'fa-file-arrow-down'],
  [/search|apply|filter|بحث|تطبيق|تصفية/i, 'fa-magnifying-glass'],
];

function actionIcon(label) {
  const match = ACTION_ICONS.find(([pattern]) => pattern.test(String(label ?? '')));
  return match ? match[1] : '';
}

class AdFilterBar extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
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

    const form = document.createElement('form');
    // The row filters live; there is nothing to submit.
    form.addEventListener('submit', (event) => event.preventDefault());

    const row = document.createElement('div');
    row.className = 'filter-container white-bg';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('filters.filters'));
    // Static decorative markup only.
    row.innerHTML = '<i class="fa-solid fa-sliders" aria-hidden="true"></i>';

    (this._fields ?? []).forEach((field) => {
      row.appendChild(this.buildField(field));
    });

    if ((this._actions ?? []).length) {
      const actions = document.createElement('div');
      actions.className = 'end-side ms-auto ad-filters__actions';

      this._actions.forEach((action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          action.variant === 'primary' ? 'btn btn-primary' : 'btn btn-tertiary';

        const glyph = actionIcon(action.label);
        // Static icon markup only — the label below is always a text node.
        if (glyph) btn.innerHTML = `<i class="fa-solid ${glyph}" aria-hidden="true"></i>`;
        btn.appendChild(document.createTextNode(action.label ?? t('common.search')));

        if (action.disabled) btn.disabled = true;
        if (action.stub) {
          btn.title = action.stub;
          btn.disabled = true;
        }
        btn.addEventListener('click', () => action.onClick?.(this.value));
        actions.appendChild(btn);
      });

      row.appendChild(actions);
    }

    form.appendChild(row);
    this.appendChild(form);
  }

  /** One labelled control, in the kit's input vocabulary. */
  buildField(field) {
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
      wrap.appendChild(this.buildSelect(field, inputId));
    } else if (field.type === 'daterange') {
      this.buildDateRange(field, inputId, wrap);
    } else {
      wrap.appendChild(this.buildTextInput(field, inputId));
    }

    return wrap;
  }

  buildSelect(field, inputId) {
    const select = document.createElement('select');
    select.className = 'form-select';
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
    return select;
  }

  buildTextInput(field, inputId) {
    const input = document.createElement('input');
    input.type = field.type === 'search' ? 'search' : 'text';
    input.className = 'form-control';
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
    return input;
  }

  buildDateRange(field, inputId, wrap) {
    const fromKey = field.fromKey ?? 'from';
    const toKey = field.toKey ?? 'to';

    const range = document.createElement('div');
    range.className = 'date-inputs-container ad-filters__range';

    const from = document.createElement('input');
    from.type = 'date';
    from.className = 'form-control';
    from.id = inputId;
    from.value = this._state[fromKey] ?? '';
    from.setAttribute('aria-label', t('filters.dateFrom', { label: field.label }));

    const to = document.createElement('input');
    to.type = 'date';
    to.className = 'form-control';
    to.value = this._state[toKey] ?? '';
    to.setAttribute('aria-label', t('filters.dateTo', { label: field.label }));

    const error = document.createElement('span');
    error.className = 'field__error';
    error.hidden = true;

    const onRangeChange = () => {
      // #1810/#1832: the end date must not precede the start date.
      if (from.value && to.value && to.value < from.value) {
        error.textContent = t('filters.dateRangeError');
        error.hidden = false;
        to.classList.add('input--error', 'is-invalid');
        return;
      }
      error.hidden = true;
      to.classList.remove('input--error', 'is-invalid');
      this._state[fromKey] = from.value;
      this._state[toKey] = to.value;
      this.emitChange();
    };

    from.addEventListener('change', onRangeChange);
    to.addEventListener('change', onRangeChange);

    const dash = document.createElement('span');
    dash.setAttribute('aria-hidden', 'true');
    dash.textContent = t('common.to');
    range.append(from, dash, to);

    this._inputs.set(fromKey, from);
    this._inputs.set(toKey, to);
    wrap.append(range, error);
  }
}

if (!customElements.get('ad-filter-bar')) {
  customElements.define('ad-filter-bar', AdFilterBar);
}
