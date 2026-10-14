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
 * Controls are placeholder-only, as in the kit. Each keeps its `<label>` for
 * assistive tech, but visually hidden (`.ad-visually-hidden`); a select shows
 * its name in the "all" option ("Status: All", or the field's `placeholder`)
 * and a date range carries the label as a `title`.
 *
 * The kit's button group always ends the row: **Reset** (`btn-tertiary`,
 * clears every field and emits 'change') and **Search** (`btn-primary`,
 * flushes a pending debounced search and re-emits the current value — the row
 * still filters live). Screen actions follow; an Export action renders as the
 * kit's `btn-primary-gradient` with `fa-file-csv`. Opt out of either built-in
 * button with `bar.toolbar = { reset: false, search: false }` or the
 * `no-reset` / `no-search` attributes. Enter in a text field acts as Search.
 *
 * Usage:
 *   bar.fields = [
 *     { type: 'search', key: 'search', label: 'Search', placeholder: 'Name or phone', grow: true },
 *     { type: 'combobox', key: 'driverId', label: 'Driver', placeholder: 'Name or phone',
 *       options: [{ value: '7', label: 'Amira Kamal', meta: '01001234567' }] },
 *     { type: 'select', key: 'status', label: 'Status', value: 'all',
 *       options: [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }] },
 *     { type: 'daterange', key: 'date', label: 'Submission date',
 *       fromKey: 'from', toKey: 'to' },
 *   ];
 *   bar.actions = [{ label: 'Export CSV', variant: 'ghost', onClick: () => exportCsv() }];
 *   bar.value;                       // { search: '', status: 'all', from: '', to: '' }
 *
 * Events: 'change' (bubbles) → detail is the full value object.
 * Search inputs are debounced by 300 ms; selects, comboboxes and dates fire
 * immediately.
 * A range whose end date precedes its start date is rejected with a
 * `.field__error` message and no 'change' event.
 *
 * Every string this component generates — the range separator, the two date
 * `aria-label`s and the range error — comes from `t()`. Field labels, option
 * labels and action labels are supplied already translated by the screen.
 *
 * Action `variant` maps onto the kit's buttons: 'primary' → `.btn-primary`,
 * 'success' → `.btn-success`, 'gradient' → `.btn-primary-gradient`, anything
 * else → `.btn-tertiary` — except that an Export / CSV label always becomes the
 * kit's gradient Export button. Labels that read as Reset, Search or Export
 * pick up the kit's leading icon automatically.
 */

import { t } from '../scripts/admin-i18n.js';
import './ad-combobox.js';

const DEBOUNCE_MS = 300;

/**
 * Leading Font Awesome glyphs for the action labels the screens use. The
 * patterns carry the Arabic wording too (the kit's own «إعادة تعيين» / «بحث»),
 * so a translated label keeps its icon.
 */
const ACTION_ICONS = [
  [/reset|clear|إعادة تعيين|مسح/i, 'fa-arrows-rotate'],
  [/export|download|csv|تصدير|تنزيل/i, 'fa-file-csv'],
  [/search|apply|filter|بحث|تطبيق|تصفية/i, 'fa-magnifying-glass'],
];

const EXPORT_LABEL = /export|csv|تصدير/i;

function actionClass(action) {
  if (EXPORT_LABEL.test(String(action.label ?? ''))) return 'btn btn-primary-gradient';
  switch (action.variant) {
    case 'primary':
      return 'btn btn-primary';
    case 'success':
      return 'btn btn-success';
    case 'gradient':
      return 'btn btn-primary-gradient';
    default:
      return 'btn btn-tertiary';
  }
}

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

  /** Built-in Reset / Search buttons; both on by default. */
  set toolbar(config) {
    this._toolbar = { ...(config ?? {}) };
    if (this._built) this.render();
  }

  get toolbar() {
    return {
      reset: !this.hasAttribute('no-reset'),
      search: !this.hasAttribute('no-search'),
      ...(this._toolbar ?? {}),
    };
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
    window.clearTimeout(this._debounce);
    this.fields = this._fields.map((field) => ({ ...field }));
    this.emitChange();
  }

  /** The kit's Search button: commit any half-typed search, then re-emit. */
  search() {
    window.clearTimeout(this._debounce);
    (this._fields ?? []).forEach((field) => {
      if (field.type && field.type !== 'search' && field.type !== 'text') return;
      const input = this._inputs.get(field.key);
      if (input) this._state[field.key] = input.value.trim();
    });
    this.emitChange();
  }

  emitChange() {
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: this.value }));
  }

  render() {
    this.textContent = '';
    this._inputs.clear();

    const form = document.createElement('form');
    // The row filters live; Enter acts as the kit's Search button.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.search();
    });

    const row = document.createElement('div');
    row.className = 'filter-container white-bg';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('filters.filters'));
    // Static decorative markup only.
    row.innerHTML = '<i class="fa-solid fa-sliders" aria-hidden="true"></i>';

    (this._fields ?? []).forEach((field) => {
      row.appendChild(this.buildField(field));
    });

    const toolbar = this.toolbar;
    const buttons = [];
    if (toolbar.reset) {
      buttons.push({
        label: t('common.reset'),
        className: 'btn btn-tertiary',
        builtIn: 'reset',
        onClick: () => this.reset(),
      });
    }
    if (toolbar.search) {
      buttons.push({
        label: t('common.search'),
        className: 'btn btn-primary',
        builtIn: 'search',
        onClick: () => this.search(),
      });
    }
    (this._actions ?? []).forEach((action) => {
      buttons.push({ ...action, className: actionClass(action) });
    });

    if (buttons.length) {
      const actions = document.createElement('div');
      actions.className = 'end-side ms-auto ad-filters__actions';

      buttons.forEach((action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = action.className;
        if (action.builtIn) btn.dataset.filterAction = action.builtIn;

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
    // Placeholder-only controls, as in the kit; the label stays for AT.
    label.className = 'ad-filters__label ad-visually-hidden';
    label.textContent = field.label;
    label.htmlFor = inputId;
    wrap.appendChild(label);

    if (field.type === 'select') {
      wrap.appendChild(this.buildSelect(field, inputId));
    } else if (field.type === 'combobox') {
      wrap.appendChild(this.buildCombobox(field, inputId));
    } else if (field.type === 'daterange') {
      this.buildDateRange(field, inputId, wrap);
    } else {
      wrap.appendChild(this.buildTextInput(field, inputId));
    }

    return wrap;
  }

  /**
   * With no visible label, the "all" option names the filter — the kit's
   * "All Statuses". A field `placeholder` wins; otherwise "Status: All".
   */
  optionText(field, option) {
    const isAll = option.value === 'all' || option.value === '';
    if (!isAll || !field.label) return option.label;
    if (field.placeholder) return field.placeholder;
    return t('kitLists.selectAll', { label: field.label, all: option.label });
  }

  buildSelect(field, inputId) {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = inputId;
    select.title = field.label ?? '';
    (field.options ?? []).forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = this.optionText(field, option);
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

  /**
   * A searchable person picker. Used wherever an admin has to find one driver
   * or rider among hundreds — she types a name or a phone number rather than
   * scrolling a flat <select> of names (#4382).
   */
  buildCombobox(field, inputId) {
    const box = document.createElement('ad-combobox');
    box.id = inputId;
    box.name = field.key;
    box.placeholder = field.placeholder ?? t('combobox.placeholder');
    box.options = field.options ?? [];
    box.value = this._state[field.key] ?? '';
    box.addEventListener('change', (event) => {
      // The combobox's own detail must not escape as the bar's filter payload.
      event.stopPropagation();
      this._state[field.key] = event.detail.value;
      this.emitChange();
    });
    this._inputs.set(field.key, box);
    return box;
  }

  buildTextInput(field, inputId) {
    const input = document.createElement('input');
    input.type = field.type === 'search' ? 'search' : 'text';
    input.className = 'form-control';
    input.id = inputId;
    input.placeholder = field.placeholder ?? field.label ?? '';
    input.value = this._state[field.key] ?? '';
    if (field.maxLength) input.maxLength = field.maxLength;

    input.addEventListener('input', () => {
      window.clearTimeout(this._debounce);
      this._debounce = window.setTimeout(() => {
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
    // No visible label in the kit's row — the tooltip names the range.
    range.title = field.label ?? '';

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
