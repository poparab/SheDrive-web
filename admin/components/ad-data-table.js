/**
 * ad-data-table.js — SheDrive admin data grid
 * Sortable sticky-header table with a pagination footer and built-in loading,
 * empty, and error renders. Every [Admin] list story specifies columns, page
 * size, and a default sort; this component is configured from that spec.
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
 */

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
    this._wrap.className = 'ad-table-wrap';

    this._table = document.createElement('table');
    this._table.className = 'ad-table';
    this._thead = document.createElement('thead');
    this._tbody = document.createElement('tbody');
    this._table.append(this._thead, this._tbody);
    this._wrap.appendChild(this._table);

    this._stateHost = document.createElement('div');

    this._footer = document.createElement('div');
    this._footer.className = 'ad-pagination';
    this._summary = document.createElement('span');
    this._controls = document.createElement('div');
    this._controls.className = 'ad-pagination__controls';

    this._prev = document.createElement('button');
    this._prev.type = 'button';
    this._prev.className = 'btn btn--ghost btn--sm';
    this._prev.textContent = 'Previous';
    this._prev.addEventListener('click', () => this.goToPage(this._page - 1));

    this._pageLabel = document.createElement('span');

    this._next = document.createElement('button');
    this._next.type = 'button';
    this._next.className = 'btn btn--ghost btn--sm';
    this._next.textContent = 'Next';
    this._next.addEventListener('click', () => this.goToPage(this._page + 1));

    this._controls.append(this._prev, this._pageLabel, this._next);
    this._footer.append(this._summary, this._controls);

    this.textContent = '';
    this.append(this._wrap, this._stateHost, this._footer);
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
    this._errorMessage = message ?? 'Something went wrong.';
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
          ? ` (sorted ${dir === 'asc' ? 'ascending' : 'descending'})`
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
  }

  renderBody() {
    this._tbody.textContent = '';
    this._stateHost.textContent = '';

    const showTable = this._status === 'ready';
    this._wrap.hidden = !showTable;
    this._stateHost.hidden = showTable;

    if (this._status === 'loading') {
      const skeleton = document.createElement('div');
      skeleton.className = 'ad-skeleton-rows';
      skeleton.setAttribute('role', 'status');
      skeleton.setAttribute('aria-label', 'Loading rows');
      for (let i = 0; i < 6; i += 1) {
        const bar = document.createElement('div');
        bar.className = 'ad-skeleton';
        skeleton.appendChild(bar);
      }
      this._stateHost.appendChild(skeleton);
      return;
    }

    if (this._status === 'error') {
      const state = document.createElement('ad-empty-state');
      state.setAttribute('icon', '⚠');
      state.setAttribute('heading', 'Could not load this list');
      state.setAttribute('message', this._errorMessage);
      if (this._onRetry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn--secondary btn--sm';
        retry.textContent = 'Try again';
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
      state.setAttribute('heading', config.heading ?? 'Nothing to show');
      state.setAttribute(
        'message',
        config.message ?? 'No records match the current filters.',
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
        if (column.className) td.classList.add(column.className);

        const value = column.render ? column.render(row) : row[column.key];
        if (value instanceof Node) {
          td.appendChild(value);
        } else {
          td.textContent =
            value === null || value === undefined || value === '' ? '—' : String(value);
        }

        tr.appendChild(td);
      });

      this._tbody.appendChild(tr);
    });
  }

  renderFooter() {
    const hide = this._status === 'loading' || this._status === 'error';
    this._footer.hidden = hide;
    if (hide) return;

    if (this._total === 0) {
      this._summary.textContent = 'No rows';
      this._controls.hidden = true;
      return;
    }

    const first = (this._page - 1) * this._pageSize + 1;
    const last = Math.min(this._page * this._pageSize, this._total);
    this._summary.textContent = `Showing ${first}–${last} of ${this._total}`;
    this._controls.hidden = this._totalPages <= 1;
    this._pageLabel.textContent = `Page ${this._page} of ${this._totalPages}`;
    this._prev.disabled = this._page <= 1;
    this._next.disabled = this._page >= this._totalPages;
  }
}

if (!customElements.get('ad-data-table')) {
  customElements.define('ad-data-table', AdDataTable);
}
