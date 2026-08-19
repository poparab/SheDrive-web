/**
 * ad-data-table.js — SheDrive admin data grid (v2 design)
 * Sortable table with a pagination footer and built-in loading, empty, and
 * error renders. Every [Admin] list story specifies columns, page size, and a
 * default sort; this component is configured from that spec.
 *
 * Renders the delivered design kit's grid:
 *
 *   <div class="table-responsive">
 *     <table class="table custom-grid-list">
 *       <thead>…sortable header buttons (.ad-table__sort)…</thead>
 *       <tbody>…</tbody>
 *       <tfoot><tr><td colspan="n">
 *         "Showing 1–20 of 84" + <ul class="pagination">…</ul>
 *       </td></tr></tfoot>
 *     </table>
 *   </div>
 *
 * The pagination window shows the first and last page, the pages either side
 * of the current one, `…` gaps for the rest, and prev/next chevrons. The
 * current page is `.page-item.active`; unavailable controls are
 * `.page-item.disabled`.
 *
 * Loading paints skeleton rows (`.ad-skeleton`) inside the table wrap so the
 * grid does not jump. Empty and error render an <ad-empty-state> instead of a
 * table — the kit's `.result-message` block.
 *
 * Usage:
 *   table.pageSize = 20;
 *   table.sort = { key: 'submittedAt', dir: 'asc' };
 *   table.columns = [
 *     { key: 'name', label: 'Driver name', sortable: true,
 *       render: (row) => row.name },
 *     { key: 'fare', label: 'Fare (EGP)', sortable: true, numeric: true,
 *       render: (row) => formatEgp(row.fare.total) },
 *   ];
 *   table.rowHref = (row) => `driver-profile.html?id=${row.id}`;
 *   table.setLoading();
 *   table.setData(page);            // { rows, total, page, pageSize, totalPages }
 *   table.setError('message', () => retry());
 *
 * Events (both bubble):
 *   'sortchange' → detail { key, dir }
 *   'pagechange' → detail { page }
 *   'rowclick'   → detail { row }
 *
 * `render` may return a string, a Node, or null. Return a Node for pills and
 * links; strings are inserted as text, never as HTML.
 *
 * Column flags: `sortable`, `numeric` (start-aligned Latin figures), `ltr`
 * (the cell holds Latin data — an id, phone number, email, plate number or
 * money — so it must not be re-ordered by the bidi algorithm in Arabic),
 * `headerClass`, `className`.
 *
 * Every string this component generates — the summary line, the page controls,
 * the sort announcement, and the loading / empty / error copy — comes from
 * `t()`.
 */

import { t } from '../scripts/admin-i18n.js';

/** How many page numbers sit either side of the current one. */
const PAGE_WINDOW = 1;

class AdDataTable extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._columns = this._columns ?? [];
    this._rows = [];
    this._sort = this._sort ?? null;
    this._pageSize = this._pageSize ?? 20;
    this._page = 1;
    this._total = 0;
    this._totalPages = 1;
    this._status = 'idle';

    this._wrap = document.createElement('div');
    this._wrap.className = 'table-responsive';

    this._table = document.createElement('table');
    this._table.className = 'table custom-grid-list';
    this._thead = document.createElement('thead');
    this._tbody = document.createElement('tbody');

    this._tfoot = document.createElement('tfoot');
    this._footRow = document.createElement('tr');
    this._footCell = document.createElement('td');
    this._footer = document.createElement('div');
    this._footer.className = 'ad-pagination';
    this._summary = document.createElement('span');
    this._controls = document.createElement('ul');
    this._controls.className = 'pagination ad-pagination__controls';
    // A label, not role=navigation: the <ul> must keep its list semantics
    // so the page-item <li>s stay valid children.
    this._controls.setAttribute('aria-label', t('table.pagination'));
    this._footer.append(this._summary, this._controls);
    this._footCell.appendChild(this._footer);
    this._footRow.appendChild(this._footCell);
    this._tfoot.appendChild(this._footRow);

    this._table.append(this._thead, this._tbody, this._tfoot);
    this._wrap.appendChild(this._table);

    this._stateHost = document.createElement('div');

    this.textContent = '';
    this.append(this._wrap, this._stateHost);
    this._built = true;
  }

  // ── Configuration ─────────────────────────────────

  set columns(columns) {
    this._columns = columns ?? [];
    if (this._built) this.renderHead();
  }

  get columns() {
    return this._columns ?? [];
  }

  set pageSize(size) {
    this._pageSize = Number(size) || 20;
  }

  get pageSize() {
    return this._pageSize;
  }

  /** @param {{key: string, dir: 'asc'|'desc'} | null} sort */
  set sort(sort) {
    this._sort = sort;
    if (this._built) this.renderHead();
  }

  get sort() {
    return this._sort;
  }

  set rowHref(fn) {
    this._rowHref = fn;
  }

  set emptyState(config) {
    this._emptyState = config;
  }

  get page() {
    return this._page;
  }

  // ── State transitions ─────────────────────────────

  setLoading() {
    this._status = 'loading';
    this.render();
  }

  /** @param {{rows: Array, total: number, page: number, pageSize: number, totalPages: number}} result */
  setData(result) {
    this._rows = result?.rows ?? [];
    this._total = result?.total ?? this._rows.length;
    this._page = result?.page ?? 1;
    this._pageSize = result?.pageSize ?? this._pageSize;
    this._totalPages = result?.totalPages ?? 1;
    this._status = this._rows.length ? 'ready' : 'empty';
    this.render();
  }

  setError(message, onRetry) {
    this._status = 'error';
    this._errorMessage = message ?? t('state.errorMessage');
    this._onRetry = onRetry;
    this.render();
  }

  goToPage(page) {
    const next = Math.min(Math.max(1, page), this._totalPages);
    if (next === this._page) return;
    this.dispatchEvent(new CustomEvent('pagechange', { bubbles: true, detail: { page: next } }));
  }

  // ── Rendering ─────────────────────────────────────

  render() {
    this.renderHead();
    this.renderBody();
    this.renderFooter();
  }

  renderHead() {
    if (!this._thead) return;
    this._thead.textContent = '';
    const row = document.createElement('tr');

    (this._columns ?? []).forEach((column) => {
      const th = document.createElement('th');
      th.scope = 'col';
      if (column.numeric) th.classList.add('ad-table__num');
      if (column.headerClass) th.classList.add(column.headerClass);

      if (column.sortable) {
        const active = this._sort?.key === column.key;
        const dir = active ? this._sort.dir : null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ad-table__sort';
        btn.setAttribute(
          'aria-sort',
          dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none',
        );
        btn.append(document.createTextNode(column.label));

        const icon = document.createElement('span');
        icon.className = 'ad-table__sort-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '⇅';
        btn.appendChild(icon);

        const sortedLabel = document.createElement('span');
        sortedLabel.className = 'ad-visually-hidden';
        sortedLabel.textContent = active
          ? ` ${t(dir === 'asc' ? 'table.sortAscending' : 'table.sortDescending')}`
          : '';
        btn.appendChild(sortedLabel);

        btn.addEventListener('click', () => {
          const nextDir = active && this._sort.dir === 'asc' ? 'desc' : 'asc';
          this.dispatchEvent(
            new CustomEvent('sortchange', {
              bubbles: true,
              detail: { key: column.key, dir: nextDir },
            }),
          );
        });

        th.appendChild(btn);
        if (active) {
          th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        }
      } else {
        th.textContent = column.label;
      }

      row.appendChild(th);
    });

    this._thead.appendChild(row);
    this._footCell.colSpan = Math.max(1, (this._columns ?? []).length);
  }

  renderBody() {
    this._tbody.textContent = '';
    this._stateHost.textContent = '';

    const showTable = this._status === 'ready' || this._status === 'loading';
    this._wrap.hidden = !showTable;
    this._stateHost.hidden = showTable;

    if (this._status === 'loading') {
      // Skeleton rows keep the grid frame in place while data lands.
      const columnCount = Math.max(1, (this._columns ?? []).length);
      for (let i = 0; i < 6; i += 1) {
        const tr = document.createElement('tr');
        tr.className = 'ad-skeleton-row';
        if (i === 0) {
          tr.setAttribute('role', 'status');
          tr.setAttribute('aria-label', t('table.loadingRows'));
        }
        for (let c = 0; c < columnCount; c += 1) {
          const td = document.createElement('td');
          const bar = document.createElement('div');
          bar.className = 'ad-skeleton';
          td.appendChild(bar);
          tr.appendChild(td);
        }
        this._tbody.appendChild(tr);
      }
      return;
    }

    if (this._status === 'error') {
      const state = document.createElement('ad-empty-state');
      state.setAttribute('icon', 'cloud-connection-off.svg');
      state.setAttribute('heading', t('state.errorHeading'));
      state.setAttribute('message', this._errorMessage);
      if (this._onRetry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-primary-rounded-outline';
        retry.innerHTML = '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>';
        retry.appendChild(document.createTextNode(t('common.tryAgain')));
        retry.addEventListener('click', () => this._onRetry());
        state.appendChild(retry);
      }
      this._stateHost.appendChild(state);
      return;
    }

    if (this._status === 'empty' || this._status === 'idle') {
      const config = this._emptyState ?? {};
      const state = document.createElement('ad-empty-state');
      state.setAttribute('icon', config.icon ?? '☐');
      state.setAttribute('heading', config.heading ?? t('state.emptyHeading'));
      state.setAttribute(
        'message',
        config.message ?? t('state.emptyMessage'),
      );
      this._stateHost.appendChild(state);
      return;
    }

    this._rows.forEach((row) => {
      const tr = document.createElement('tr');
      const href = this._rowHref?.(row);

      if (href) {
        tr.dataset.rowLink = href;
        tr.tabIndex = 0;
        tr.setAttribute('role', 'link');
        const activate = () => {
          this.dispatchEvent(new CustomEvent('rowclick', { bubbles: true, detail: { row } }));
          window.location.href = href;
        };
        tr.addEventListener('click', (event) => {
          // Let real links and buttons inside a cell win.
          if (event.target.closest('a, button')) return;
          activate();
        });
        tr.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        });
      }

      (this._columns ?? []).forEach((column) => {
        const td = document.createElement('td');
        if (column.numeric) td.classList.add('ad-table__num');
        // Latin data (ids, phones, emails, plates, money) must keep its own
        // direction inside an Arabic-aligned cell — styles/admin-rtl.css
        // isolates .ad-ltr.
        if (column.ltr) td.classList.add('ad-ltr');
        if (column.className) td.classList.add(column.className);

        const value = column.render ? column.render(row) : row[column.key];
        if (value instanceof Node) {
          td.appendChild(value);
        } else {
          td.textContent =
            value === null || value === undefined || value === ''
              ? t('common.notAvailable')
              : String(value);
        }

        tr.appendChild(td);
      });

      this._tbody.appendChild(tr);
    });
  }

  renderFooter() {
    const hide = this._status === 'loading' || this._status === 'error';
    this._tfoot.hidden = hide;
    if (hide) return;

    this._controls.textContent = '';

    if (this._total === 0) {
      this._summary.textContent = t('table.noRows');
      this._controls.hidden = true;
      return;
    }

    const first = (this._page - 1) * this._pageSize + 1;
    const last = Math.min(this._page * this._pageSize, this._total);
    this._summary.textContent = t('table.showing', { first, last, total: this._total });

    this._controls.hidden = this._totalPages <= 1;
    if (this._totalPages <= 1) return;

    this._controls.appendChild(
      this.buildChevron(
        'fa-chevron-left',
        t('table.previousPage'),
        this._page - 1,
        this._page <= 1,
      ),
    );

    this.pageWindow().forEach((entry) => {
      this._controls.appendChild(
        entry === '…' ? this.buildGap() : this.buildPageItem(entry),
      );
    });

    this._controls.appendChild(
      this.buildChevron(
        'fa-chevron-right',
        t('table.nextPage'),
        this._page + 1,
        this._page >= this._totalPages,
      ),
    );
  }

  /** [1, '…', 4, 5, 6, '…', 12] for the current page and total page count. */
  pageWindow() {
    const total = this._totalPages;
    const current = this._page;
    const wanted = new Set([1, total]);
    for (let p = current - PAGE_WINDOW; p <= current + PAGE_WINDOW; p += 1) {
      if (p >= 1 && p <= total) wanted.add(p);
    }

    const pages = Array.from(wanted).sort((a, b) => a - b);
    const out = [];
    pages.forEach((page, index) => {
      if (index > 0 && page - pages[index - 1] > 1) out.push('…');
      out.push(page);
    });
    return out;
  }

  buildPageItem(page) {
    const li = document.createElement('li');
    li.className = 'page-item';
    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = 'javascript:;';
    link.textContent = String(page);

    if (page === this._page) {
      li.classList.add('active');
      li.setAttribute('aria-current', 'page');
    } else {
      link.setAttribute('aria-label', t('table.goToPage', { page }));
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.goToPage(page);
      });
    }

    li.appendChild(link);
    return li;
  }

  buildGap() {
    const li = document.createElement('li');
    li.className = 'page-item disabled';
    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = 'javascript:;';
    link.tabIndex = -1;
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('aria-label', t('table.morePages'));
    link.textContent = '…';
    li.appendChild(link);
    return li;
  }

  buildChevron(glyph, label, target, disabled) {
    const li = document.createElement('li');
    li.className = disabled ? 'page-item disabled' : 'page-item';
    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = 'javascript:;';
    link.setAttribute('aria-label', label);
    // Static icon markup only.
    link.innerHTML = `<i class="fa-solid ${glyph}" aria-hidden="true"></i>`;

    if (disabled) {
      link.tabIndex = -1;
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.goToPage(target);
      });
    }

    li.appendChild(link);
    return li;
  }
}

if (!customElements.get('ad-data-table')) {
  customElements.define('ad-data-table', AdDataTable);
}
