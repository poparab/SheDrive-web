/**
 * pricing-zones.js — SheDrive admin service zones & rate cards
 * #1831 map + list overview, #1756 create a zone by drawing its boundary,
 * #1830 edit and delete, #1757 the per-zone rate card that activates a zone.
 *
 * Zone status is always derived from the rate card — there is deliberately no
 * manual activate/deactivate control anywhere on this screen (#1757 S6).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime, formatEgp } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#zone-modal');
const filters = qs('#zone-filters');
const table = qs('#zone-table');
const panel = qs('#zone-map');
const drawPanel = qs('#draw-panel');
const drawCount = qs('#draw-count');
const drawError = qs('#draw-error');
const mapSummary = qs('#map-summary');

const query = {
  search: '',
  status: 'all',
  from: '',
  to: '',
  page: 1,
  pageSize: 50,
  sort: { key: 'name', dir: 'asc' },
};

let mapReady = false;
/** Set while drawing: 'create', or { id, name } when re-drawing an existing zone. */
let drawMode = null;

// ── Filters (#1831) ───────────────────────────────────

filters.fields = [
  { type: 'search', key: 'search', label: 'Zone name', placeholder: 'e.g. Maadi', grow: true, maxLength: 60 },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  { type: 'daterange', key: 'date', label: 'Created at (UTC+2)', fromKey: 'from', toKey: 'to' },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

// ── Columns (#1831) ───────────────────────────────────

table.pageSize = query.pageSize;
table.sort = query.sort;

table.columns = [
  {
    key: 'name',
    label: 'Zone name',
    sortable: true,
    render: (zone) => {
      const wrap = document.createElement('span');
      wrap.className = 'list__name';
      const primary = document.createElement('span');
      primary.className = 'list__name-primary';
      primary.textContent = zone.name;
      wrap.appendChild(primary);
      // #1757 S5 — an inactive zone must warn that it blocks trips.
      if (zone.status === 'inactive') {
        const warn = document.createElement('span');
        warn.className = 'pricing__warning';
        warn.textContent = '⚠ No rate card — trips will be blocked';
        wrap.appendChild(warn);
      }
      return wrap;
    },
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (zone) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = zone.status;
      return pill;
    },
  },
  {
    key: 'rateCard',
    label: 'Rate card',
    render: (zone) => {
      if (!zone.rateCard) {
        const none = document.createElement('span');
        none.className = 'ad-muted';
        none.textContent = 'Not configured';
        return none;
      }
      const wrap = document.createElement('span');
      wrap.className = 'pricing__rates';
      [
        ['Base', zone.rateCard.baseFare],
        ['Per km', zone.rateCard.perKm],
        ['Per min', zone.rateCard.perMin],
        ['Min', zone.rateCard.minFare],
        ['Cancel', zone.rateCard.cancellationFee],
      ].forEach(([label, value]) => {
        const item = document.createElement('span');
        item.className = 'pricing__rate';
        const key = document.createElement('span');
        key.className = 'pricing__rate-label';
        key.textContent = `${label} `;
        item.append(key, document.createTextNode(formatEgp(value)));
        wrap.appendChild(item);
      });
      return wrap;
    },
  },
  { key: 'createdBy', label: 'Created by', render: (zone) => zone.createdBy },
  {
    key: 'createdAt',
    label: 'Created at (UTC+2)',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (zone) => formatDateTime(zone.createdAt),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (zone) => {
      const wrap = document.createElement('span');
      wrap.className = 'pricing__actions';

      wrap.appendChild(
        actionButton(zone.rateCard ? 'Rate card' : 'Set rate card', 'secondary', () =>
          openRateCard(zone),
        ),
      );
      wrap.appendChild(actionButton('Rename', 'ghost', () => openRename(zone)));
      wrap.appendChild(actionButton('Redraw', 'ghost', () => startDraw({ id: zone.id, name: zone.name }, zone.polygon)));
      wrap.appendChild(actionButton('Delete', 'danger', () => openDelete(zone)));

      return wrap;
    },
  },
];

function actionButton(label, variant, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn--${variant} btn--sm`;
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

table.emptyState = {
  icon: '◎',
  heading: 'No zones yet',
  message: 'Create the first service zone — all of Cairo and Giza must be covered before launch.',
};

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = query.sort;
  load();
});

table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

// ── #1757 rate card ───────────────────────────────────

function openRateCard(zone) {
  const card = zone.rateCard;
  modal.open({
    title: `Rate card — ${zone.name}`,
    description: card
      ? 'Changes take effect immediately for new trips. Previous values are kept in the pricing audit log.'
      : 'Saving a complete rate card activates this zone and it starts accepting trips.',
    confirmLabel: card ? 'Save rate card' : 'Save and activate zone',
    fields: [
      money('baseFare', 'Base fare (EGP)', card?.baseFare, 0.01, 'Base fare is required', 'Base fare must be at least 0.01 EGP'),
      money('perKm', 'Per-km rate (EGP)', card?.perKm, 0.01, 'Per-km rate is required', 'Per-km rate must be at least 0.01 EGP'),
      money('perMin', 'Per-min rate (EGP)', card?.perMin, 0.01, 'Per-min rate is required', 'Per-min rate must be at least 0.01 EGP'),
      {
        ...money('minFare', 'Minimum fare (EGP)', card?.minFare, 0.01, 'Minimum fare is required', 'Minimum fare must be at least 0.01 EGP'),
        // #1757 S3 — the floor cannot sit below the base fare.
        validate: (value, values) =>
          Number(value) < Number(values.baseFare)
            ? 'Minimum fare cannot be less than base fare'
            : null,
      },
      {
        ...money('cancellationFee', 'Cancellation fee (EGP)', card?.cancellationFee ?? 0, 0, 'Cancellation fee is required', 'Cancellation fee cannot be negative'),
        required: false,
        hint: 'Charged to a rider who cancels outside the grace period.',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.saveRateCard(zone.id, values);
      shell.showToast(
        card ? 'Rate card updated — live for new trips.' : `${zone.name} is now Active.`,
        'success',
      );
      await load();
    },
  });
}

function money(key, label, value, min, emptyError, rangeError) {
  return {
    key,
    type: 'number',
    label,
    required: true,
    step: '0.01',
    min,
    value: value ?? '',
    emptyError,
    invalidError: 'Enter a valid amount',
    rangeError,
  };
}

// ── #1830 rename / delete ─────────────────────────────

function openRename(zone) {
  modal.open({
    title: `Rename ${zone.name}`,
    confirmLabel: 'Save name',
    fields: [
      {
        key: 'name',
        type: 'text',
        label: 'Zone name',
        required: true,
        value: zone.name,
        minLength: 2,
        maxLength: 60,
        emptyError: 'Enter a zone name',
        lengthError: 'Zone name must be 2–60 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.updateZone(zone.id, { name: values.name });
      shell.showToast('Zone renamed.', 'success');
      await load();
    },
  });
}

function openDelete(zone) {
  modal.open({
    title: `Delete ${zone.name}?`,
    description:
      'Trips starting inside this area will be blocked until another zone covers it. This cannot be undone.',
    confirmLabel: 'Delete zone',
    danger: true,
    fields: [],
    onConfirm: async () => {
      await mockApi.deleteZone(zone.id);
      shell.showToast(`${zone.name} deleted.`, 'warning');
      await load();
    },
  });
}

// ── #1756 create by drawing a boundary ────────────────

qs('#create-zone').addEventListener('click', () => startDraw('create'));

function startDraw(mode, existingPolygon) {
  if (!mapReady) {
    shell.showToast('The map is unavailable, so a boundary cannot be drawn.', 'danger');
    return;
  }
  drawMode = mode;
  drawPanel.hidden = false;
  drawError.classList.remove('is-visible');
  qs('#draw-hint').textContent =
    mode === 'create'
      ? 'Click the map to place at least three points. The boundary must not cross itself.'
      : `Redrawing ${mode.name}. Click to place points, or undo back to the original.`;

  if (existingPolygon) {
    panel.loadDrawPolygon(existingPolygon);
    drawCount.textContent = `${existingPolygon.length - 1} points`;
  } else {
    panel.startDraw((count) => {
      drawCount.textContent = `${count} point${count === 1 ? '' : 's'}`;
    });
    drawCount.textContent = '0 points';
  }
  drawPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

qs('#draw-undo').addEventListener('click', () => {
  panel.undoDrawPoint();
});

qs('#draw-cancel').addEventListener('click', () => {
  panel.cancelDraw();
  drawPanel.hidden = true;
  drawMode = null;
});

qs('#draw-finish').addEventListener('click', () => {
  const { polygon, error } = panel.finishDraw();

  // #1756 S4 — fewer than 3 points, or a self-intersecting ring, is rejected.
  if (error) {
    drawError.textContent = error;
    drawError.classList.add('is-visible');
    return;
  }
  drawError.classList.remove('is-visible');
  drawPanel.hidden = true;

  if (drawMode === 'create') {
    modal.open({
      title: 'Name the new zone',
      description:
        'A new zone starts Inactive until a rate card is configured, so it will not accept trips yet.',
      confirmLabel: 'Create zone',
      fields: [
        {
          key: 'name',
          type: 'text',
          label: 'Zone name',
          required: true,
          minLength: 2,
          maxLength: 60,
          placeholder: 'e.g. Nasr City East',
          emptyError: 'Enter a zone name',
          lengthError: 'Zone name must be 2–60 characters',
        },
      ],
      onConfirm: async (values) => {
        await mockApi.createZone({ name: values.name, polygon });
        shell.showToast(`${values.name} created — Inactive until a rate card is set.`, 'success');
        drawMode = null;
        await load();
      },
      onClose: () => {
        drawMode = null;
      },
    });
  } else {
    const target = drawMode;
    mockApi
      .updateZone(target.id, { name: target.name, polygon })
      .then(async () => {
        shell.showToast(`${target.name} boundary updated.`, 'success');
        drawMode = null;
        await load();
      })
      .catch((error) => shell.showToast(error.message, 'danger'));
  }
});

// ── Load ──────────────────────────────────────────────

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listZones(query);
    if (!isCurrent()) return;
    table.setData(result);

    // The map shows every matching zone, not just the current page.
    if (mapReady) {
      panel.setPolygons(result.allMatching);
      const active = result.allMatching.filter((z) => z.status === 'active').length;
      const inactive = result.allMatching.length - active;
      panel.setEmpty(
        result.allMatching.length === 0,
        'No zones match these filters — nothing to show on the map.',
      );
      mapSummary.textContent =
        `Cairo / Giza · ${active} active, ${inactive} inactive` +
        (inactive ? ' — inactive zones block trips in their area' : '');
    }
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

// Load the list first so the grid is usable even if the map never arrives.
await load();

const map = await panel.mount({ zoom: 9.6, tall: true });
if (map) {
  mapReady = true;
  await load();
} else {
  mapSummary.textContent = 'Map unavailable — the zone list below is unaffected';
  qs('#create-zone').disabled = true;
  qs('#create-zone').title = 'Drawing a boundary needs the map';
}
