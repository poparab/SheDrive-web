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
import { t } from './admin-i18n.js';

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
  { type: 'search', key: 'search', label: t('zones.zoneName'), placeholder: t('zones.zoneNamePlaceholder'), grow: true, maxLength: 60 },
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      { value: 'active', label: t('status.active') },
      { value: 'inactive', label: t('status.inactive') },
    ],
  },
  { type: 'daterange', key: 'date', label: t('zones.createdAt'), fromKey: 'from', toKey: t('common.to') },
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
    label: t('zones.zoneName'),
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
        warn.textContent = t('zones.noRateCardWarning');
        wrap.appendChild(warn);
      }
      return wrap;
    },
  },
  {
    key: 'status',
    label: t('common.status'),
    sortable: true,
    render: (zone) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = zone.status;
      return pill;
    },
  },
  {
    key: 'rateCard',
    label: t('zones.rateCard'),
    render: (zone) => {
      if (!zone.rateCard) {
        const none = document.createElement('span');
        none.className = 'ad-muted';
        none.textContent = t('zones.notConfigured');
        return none;
      }
      const wrap = document.createElement('span');
      wrap.className = 'pricing__rates';
      [
        [t('zones.rateBase'), zone.rateCard.baseFare],
        [t('zones.ratePerKm'), zone.rateCard.perKm],
        [t('zones.ratePerMin'), zone.rateCard.perMin],
        [t('zones.rateMin'), zone.rateCard.minFare],
        [t('zones.rateCancel'), zone.rateCard.cancellationFee],
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
  { key: 'createdBy', label: t('zones.createdBy'), render: (zone) => zone.createdBy },
  {
    key: 'createdAt',
    label: t('zones.createdAt'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (zone) => formatDateTime(zone.createdAt),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (zone) => {
      const wrap = document.createElement('span');
      wrap.className = 'pricing__actions';

      wrap.appendChild(
        actionButton(zone.rateCard ? t('zones.rateCard') : t('zones.setRateCard'), 'primary-outline', () =>
          openRateCard(zone),
        ),
      );
      wrap.appendChild(actionButton(t('zones.rename'), 'tertiary', () => openRename(zone)));
      wrap.appendChild(actionButton(t('zones.redraw'), 'tertiary', () => startDraw({ id: zone.id, name: zone.name }, zone.polygon)));
      wrap.appendChild(actionButton(t('common.delete'), 'danger', () => openDelete(zone)));

      return wrap;
    },
  },
];

function actionButton(label, variant, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-${variant} btn--sm`;
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

table.emptyState = {
  icon: '◎',
  heading: t('zones.emptyHeading'),
  message: t('zones.emptyMessage'),
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
      ? t('zones.rateCardDescEdit')
      : t('zones.rateCardDescNew'),
    confirmLabel: card ? t('zones.rateCardConfirmEdit') : t('zones.rateCardConfirmNew'),
    fields: [
      money('baseFare', t('zones.baseFare'), card?.baseFare, 0.01, t('zones.baseFareEmpty'), t('zones.baseFareRange')),
      money('perKm', t('zones.perKm'), card?.perKm, 0.01, t('zones.perKmEmpty'), t('zones.perKmRange')),
      money('perMin', t('zones.perMin'), card?.perMin, 0.01, t('zones.perMinEmpty'), t('zones.perMinRange')),
      {
        ...money('minFare', t('zones.minFare'), card?.minFare, 0.01, t('zones.minFareEmpty'), t('zones.minFareRange')),
        // #1757 S3 — the floor cannot sit below the base fare.
        validate: (value, values) =>
          Number(value) < Number(values.baseFare)
            ? t('zones.minFareBelowBase')
            : null,
      },
      {
        ...money('cancellationFee', t('zones.cancellationFee'), card?.cancellationFee ?? 0, 0, t('zones.cancellationFeeEmpty'), t('zones.cancellationFeeRange')),
        required: false,
        hint: t('zones.cancellationFeeHint'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.saveRateCard(zone.id, values);
      shell.showToast(
        card ? t('zones.rateCardUpdatedToast') : `${zone.name} is now Active.`,
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
    invalidError: t('zones.amountInvalid'),
    rangeError,
  };
}

// ── #1830 rename / delete ─────────────────────────────

function openRename(zone) {
  modal.open({
    title: `Rename ${zone.name}`,
    confirmLabel: t('zones.renameConfirm'),
    fields: [
      {
        key: 'name',
        type: 'text',
        label: t('zones.zoneName'),
        required: true,
        value: zone.name,
        minLength: 2,
        maxLength: 60,
        emptyError: t('zones.zoneNameEmpty'),
        lengthError: t('zones.zoneNameLength'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.updateZone(zone.id, { name: values.name });
      shell.showToast(t('zones.renamedToast'), 'success');
      await load();
    },
  });
}

function openDelete(zone) {
  modal.open({
    title: `Delete ${zone.name}?`,
    description:
      t('zones.deleteDescription'),
    confirmLabel: t('zones.deleteConfirm'),
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
    shell.showToast(t('zones.mapUnavailableToast'), 'danger');
    return;
  }
  drawMode = mode;
  drawPanel.hidden = false;
  drawError.classList.remove('is-visible');
  qs('#draw-hint').textContent =
    mode === 'create'
      ? t('zones.drawHint')
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
      title: t('zones.createTitle'),
      description:
        t('zones.createDescription'),
      confirmLabel: t('zones.createZone'),
      fields: [
        {
          key: 'name',
          type: 'text',
          label: t('zones.zoneName'),
          required: true,
          minLength: 2,
          maxLength: 60,
          placeholder: t('zones.newZonePlaceholder'),
          emptyError: t('zones.zoneNameEmpty'),
          lengthError: t('zones.zoneNameLength'),
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
        t('zones.mapEmptyFiltered'),
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
  mapSummary.textContent = t('zones.mapUnavailable');
  qs('#create-zone').disabled = true;
  qs('#create-zone').title = t('zones.createNeedsMap');
}
