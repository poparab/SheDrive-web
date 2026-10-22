/**
 * pricing-zones.js — SheDrive admin service zones & rate cards
 * #1831 map + list overview, #1756 create a zone by drawing its boundary,
 * #1830 edit and delete, #1757 the per-zone rate card that activates a zone.
 *
 * Zone status is always derived from the rate card — there is deliberately no
 * manual activate/deactivate control anywhere on this screen (#1757 S6).
 *
 * Kit v22-09 port (2026-10-14): the kit's service-zone page — "Create Zone"
 * in the title row, the map card on top, a Zone | Rate card | Created by |
 * Created at | Status | Action grid with `grid-options-btn` row actions, the
 * rate card and rename as `default-modal`s, delete as `popup-warning`, and a
 * toast after each change. Maker-checker (§1) is unchanged: a rate
 * card save or removal becomes a request, and the zone stays locked until it
 * is decided.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { createRequestGuard } from './request-guard.js';
import { downloadCsv, formatDateTime, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { openDialog, openSuccess } from './pricing-dialogs.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#zone-filters');
const table = qs('#zone-table');
const panel = qs('#zone-map');
const drawPanel = qs('#draw-panel');
const drawCount = qs('#draw-count');
const drawError = qs('#draw-error');
const mapSummary = qs('#map-summary');
const createBtn = qs('#create-zone');

// The kit puts "Create Zone" at the end of the page-title row.
qs('#ad-page-actions')?.appendChild(createBtn);

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
/** Every zone matching the filters — the map and the CSV export use it. */
let allMatching = [];

const RATE_FIELDS = [
  ['baseFare', 'zones.rateBase'],
  ['perKm', 'zones.ratePerKm'],
  ['perMin', 'zones.ratePerMin'],
  ['minFare', 'zones.rateMin'],
  ['cancellationFee', 'zones.rateCancel'],
];

// ── Filters (#1831) ───────────────────────────────────

filters.fields = [
  { type: 'search', key: 'search', label: t('zones.zoneName'), placeholder: t('kitPricing.zoneSearchPlaceholder'), grow: true, maxLength: 60 },
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'all',
    options: [
      { value: 'all', label: t('kitPricing.allStatuses') },
      { value: 'active', label: t('status.active') },
      { value: 'inactive', label: t('status.inactive') },
    ],
  },
  { type: 'daterange', key: 'date', label: t('zones.createdAt'), fromKey: 'from', toKey: 'to' },
];

filters.actions = [{ label: t('common.exportCsv'), variant: 'ghost', onClick: exportCsv }];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

function exportCsv() {
  if (!allMatching.length) return;
  downloadCsv(
    `shedrive-zones-${toDateInputValue(Date.now())}.csv`,
    [
      t('zones.zoneName'),
      t('common.status'),
      ...RATE_FIELDS.map(([, key]) => `${t(key)} (${t('common.egp')})`),
      t('zones.createdBy'),
      t('zones.createdAt'),
    ],
    allMatching.map((zone) => [
      zone.name,
      t(`status.${zone.status}`),
      ...RATE_FIELDS.map(([field]) => (zone.rateCard ? Number(zone.rateCard[field] ?? 0).toFixed(2) : '')),
      zone.createdBy,
      formatDateTime(zone.createdAt),
    ]),
  );
}

// ── Columns (#1831) — the kit's order ─────────────────

table.pageSize = query.pageSize;
table.sort = query.sort;

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

table.columns = [
  {
    key: 'name',
    label: t('zones.zoneName'),
    sortable: true,
    render: (zone) => {
      const wrap = document.createElement('div');
      wrap.className = 'pricing-zones__name';
      wrap.appendChild(textNode('p', 'text-bold', zone.name));
      // Maker-checker (2026-10-14 §1): the proposed card waits for another admin.
      if (zone.pendingChange) {
        wrap.dataset.zonePending = 'true';
        wrap.appendChild(pendingNotice(zone));
      }
      return wrap;
    },
  },
  {
    key: 'rateCard',
    label: t('zones.rateCard'),
    render: (zone) => {
      // #1757 S5 — a zone with no rate card must warn that it blocks trips.
      if (!zone.rateCard) return textNode('p', 'warning-color text-bold pricing__no-card', t('zones.noRateCardWarning'));
      const wrap = document.createElement('div');
      wrap.className = 'pricing__rates';
      RATE_FIELDS.forEach(([field, key]) => {
        // span, not the kit's <p>: the kit forces a grid <p> to full size with !important.
        const item = document.createElement('span');
        item.append(document.createTextNode(`${t(key)} `), textNode('span', 'text-bold ad-ltr', formatEgp(zone.rateCard[field] ?? 0)));
        wrap.appendChild(item);
      });
      return wrap;
    },
  },
  { key: 'createdBy', label: t('zones.createdBy'), ltr: true, render: (zone) => zone.createdBy },
  {
    key: 'createdAt',
    label: t('zones.createdAt'),
    sortable: true,
    className: 'pricing-zones__wrap',
    headerClass: 'pricing-zones__wrap',
    render: (zone) => formatDateTime(zone.createdAt),
  },
  {
    // Always the CURRENT card's status — a pending change does not move it.
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
    key: 'actions',
    label: t('kitPricing.action'),
    className: 'ad-table__nowrap',
    render: (zone) => {
      const wrap = document.createElement('span');
      wrap.className = 'pricing-zones__actions';

      const rateBtn = iconButton(
        'edit-icon',
        'fa-solid fa-calculator',
        zone.rateCard ? t('zones.rateCard') : t('zones.setRateCard'),
        () => openRateCard(zone),
      );
      // One pending request per zone: the card (edit and removal) is locked until it is decided.
      if (zone.pendingChange) {
        rateBtn.disabled = true;
        rateBtn.title = t('pricingApproval.lockedTitle');
        rateBtn.setAttribute('aria-label', `${t('zones.rateCard')} — ${t('pricingApproval.lockedTitle')}`);
      }
      wrap.append(
        rateBtn,
        iconButton('view-icon', 'fa-regular fa-pen-to-square', t('zones.rename'), () => openRename(zone)),
        iconButton('pause-icon', 'fa-solid fa-bezier-curve', t('zones.redraw'), () =>
          startDraw({ id: zone.id, name: zone.name }, zone.polygon),
        ),
        iconButton('delete-icon', 'fa-solid fa-trash-can', t('common.delete'), () => openDelete(zone)),
      );
      return wrap;
    },
  },
];

function iconButton(kind, glyph, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn grid-options-btn ${kind}`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  const icon = document.createElement('i');
  icon.className = glyph;
  icon.setAttribute('aria-hidden', 'true');
  btn.appendChild(icon);
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

/** "Per km 4.50 EGP → 5.00 EGP · Min 30.00 EGP → 35.00 EGP" — only the fields that change. */
function proposedSummary(current, after) {
  return RATE_FIELDS.filter(([key]) => after[key] !== undefined && Number(after[key]) !== Number(current?.[key]))
    .map(([key, labelKey]) =>
      current && current[key] !== undefined
        ? `${t(labelKey)} ${formatEgp(current[key])} → ${formatEgp(after[key])}`
        : `${t(labelKey)} ${formatEgp(after[key])}`,
    )
    .join(' · ');
}

function pendingNotice(zone) {
  const pending = zone.pendingChange;
  const removal = Boolean(pending.after?.removed);
  const box = document.createElement('div');
  box.className = 'pricing__pending';

  const chip = document.createElement('span');
  chip.className = 'status-pending';
  const icon = document.createElement('span');
  icon.className = 'icon';
  const glyph = document.createElement('i');
  glyph.className = 'fa-solid fa-hourglass-half';
  glyph.setAttribute('aria-hidden', 'true');
  icon.appendChild(glyph);
  // The kit chip is one fixed-height line, so it carries the short label; the summary says what changes.
  chip.append(icon, document.createTextNode(t('pricingApproval.locked')));
  chip.title = removal ? t('pricingApproval.pendingRemovalChip') : t('pricingApproval.pendingChip');

  const summary = textNode(
    'span',
    'pricing__pending-summary',
    removal
      ? t('pricingApproval.proposedRemoval')
      : t('pricingApproval.proposed', { summary: proposedSummary(zone.rateCard, pending.after) || '—' }),
  );

  const meta = textNode(
    'span',
    'pricing__pending-summary',
    `${t('pricingApproval.pendingMeta', { who: pending.maker, when: formatDateTime(pending.madeAt) })} · `,
  );
  const link = document.createElement('a');
  link.href = approvalHref(pending.id);
  link.textContent = t('pricingApproval.viewRequest');
  link.addEventListener('click', (event) => event.stopPropagation());
  meta.appendChild(link);

  box.append(chip, summary, meta);
  return box;
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

// ── #1757 rate card — kit "Set the rate" default-modal ─

async function openRateCard(zone) {
  const card = zone.rateCard;
  const { confirmed, result } = await openDialog({
    variant: 'default',
    icon: 'calculate-dollar.svg',
    title: t('kitPricing.setRateTitle', { zone: zone.name }),
    description: card ? t('pricingApproval.rateCardDescApproval') : t('pricingApproval.rateCardDescNewApproval'),
    confirm: { label: t('pricingApproval.sendForApproval'), icon: 'fa-solid fa-paper-plane', className: 'btn-success' },
    // Removing the card lives with the card itself — the grid keeps the kit's four actions.
    extraActions: card
      ? [{ label: t('pricingApproval.removeBtn'), icon: 'fa-solid fa-ban', className: 'btn-danger-outline', onClick: () => openRemoveRateCard(zone) }]
      : [],
    fields: [
      money('baseFare', t('zones.baseFare'), card?.baseFare, 0.01, t('zones.baseFareEmpty'), t('zones.baseFareRange')),
      money('perKm', t('zones.perKm'), card?.perKm, 0.01, t('zones.perKmEmpty'), t('zones.perKmRange')),
      money('perMin', t('zones.perMin'), card?.perMin, 0.01, t('zones.perMinEmpty'), t('zones.perMinRange')),
      {
        ...money('minFare', t('zones.minFare'), card?.minFare, 0.01, t('zones.minFareEmpty'), t('zones.minFareRange')),
        // #1757 S3 — the floor cannot sit below the base fare.
        validate: (value, values) => (Number(value) < Number(values.baseFare) ? t('zones.minFareBelowBase') : null),
      },
      {
        ...money('cancellationFee', t('zones.cancellationFee'), card?.cancellationFee ?? 0, 0, t('zones.cancellationFeeEmpty'), t('zones.cancellationFeeRange')),
        required: false,
        hint: t('zones.cancellationFeeHint'),
      },
    ],
    // Nothing changes until another admin approves (2026-10-14 §1).
    onConfirm: (values) => mockApi.saveRateCard(zone.id, values),
  });
  if (!confirmed) return;
  await load();
  openSuccess({
    title: t('kitPricing.sentTitle'),
    description: t('pricingApproval.rateSent'),
    requestId: result?.request?.id,
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

async function openRemoveRateCard(zone) {
  const { confirmed, result } = await openDialog({
    variant: 'warning',
    title: t('pricingApproval.removeTitle', { zone: zone.name }),
    description: t('pricingApproval.removeDescription'),
    confirm: { label: t('pricingApproval.removeConfirm'), icon: 'fa-solid fa-paper-plane', className: 'btn-danger' },
    onConfirm: () => mockApi.removeRateCard(zone.id),
  });
  if (!confirmed) return;
  await load();
  openSuccess({
    title: t('kitPricing.sentTitle'),
    description: t('pricingApproval.removeSent'),
    requestId: result?.request?.id,
  });
}

// ── #1830 rename / delete ─────────────────────────────

function zoneNameField(value, placeholder) {
  return {
    key: 'name',
    type: 'text',
    label: t('zones.zoneName'),
    required: true,
    value: value ?? '',
    placeholder,
    minLength: 2,
    maxLength: 60,
    emptyError: t('zones.zoneNameEmpty'),
    lengthError: t('zones.zoneNameLength'),
  };
}

async function openRename(zone) {
  const { confirmed } = await openDialog({
    variant: 'default',
    icon: 'edit.svg',
    title: t('zones.renameTitle', { name: zone.name }),
    confirm: { label: t('zones.renameConfirm'), className: 'btn-success' },
    fields: [zoneNameField(zone.name)],
    onConfirm: (values) => mockApi.updateZone(zone.id, { name: values.name }),
  });
  if (!confirmed) return;
  await load();
  openSuccess({ title: t('kitPricing.doneTitle'), description: t('zones.renamedToast') });
}

async function openDelete(zone) {
  const { confirmed } = await openDialog({
    variant: 'warning',
    title: t('kitPricing.deleteZoneTitle', { name: zone.name }),
    description: t('zones.deleteDescription'),
    confirm: { label: t('kitPricing.confirmDelete'), icon: 'fa-solid fa-xmark', className: 'btn-danger' },
    onConfirm: () => mockApi.deleteZone(zone.id),
  });
  if (!confirmed) return;
  await load();
  openSuccess({ title: t('kitPricing.doneTitle'), description: t('zones.deletedToast', { name: zone.name }) });
}

// ── #1756 create by drawing a boundary ────────────────

createBtn.addEventListener('click', () => startDraw('create'));

function pointsLabel(count) {
  return count === 1 ? t('zones.pointOne') : t('zones.pointMany', { count });
}

function startDraw(mode, existingPolygon) {
  if (!mapReady) {
    shell.showToast(t('zones.mapUnavailableToast'), 'danger', { title: t('toast.failedTitle') });
    return;
  }
  drawMode = mode;
  drawPanel.hidden = false;
  drawError.classList.remove('is-visible');
  qs('#draw-hint').textContent =
    mode === 'create' ? t('zones.drawHint') : t('zones.drawHintRedraw', { name: mode.name });

  if (existingPolygon) {
    panel.loadDrawPolygon(existingPolygon);
    drawCount.textContent = pointsLabel(existingPolygon.length - 1);
  } else {
    panel.startDraw((count) => {
      drawCount.textContent = pointsLabel(count);
    });
    drawCount.textContent = pointsLabel(0);
  }
  qs('#zone-map-row').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

qs('#draw-undo').addEventListener('click', () => {
  panel.undoDrawPoint();
});

qs('#draw-cancel').addEventListener('click', () => {
  panel.cancelDraw();
  drawPanel.hidden = true;
  drawMode = null;
});

qs('#draw-finish').addEventListener('click', async () => {
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
    let name = '';
    const { confirmed } = await openDialog({
      variant: 'default',
      icon: 'add-location.svg',
      title: t('zones.createTitle'),
      description: t('zones.createDescription'),
      confirm: { label: t('zones.createZone'), className: 'btn-success' },
      fields: [zoneNameField('', t('zones.newZonePlaceholder'))],
      onConfirm: async (values) => {
        name = values.name;
        return mockApi.createZone({ name: values.name, polygon });
      },
    });
    drawMode = null;
    if (!confirmed) {
      await load();
      return;
    }
    await load();
    openSuccess({ title: t('kitPricing.doneTitle'), description: t('zones.createdToast', { name }) });
  } else {
    const target = drawMode;
    // No form is open here, so a failed save is an error toast; Retry resends
    // the same boundary.
    const save = () =>
      mockApi
        .updateZone(target.id, { name: target.name, polygon })
        .then(async () => {
          shell.showToast(t('zones.boundaryUpdatedToast', { name: target.name }), 'success');
          drawMode = null;
          await load();
        })
        .catch((err) =>
          shell.showToast(err.message, 'danger', {
            title: t('toast.boundaryFailedTitle'),
            action: { label: t('toast.retry'), onClick: save },
          }),
        );
    save();
  }
});

// ── Pending rate-card changes ─────────────────────────

const pendingBanner = qs('#zones-pending');
const zonesBanner = qs('#zones-banner');
let mapFailed = false;

/**
 * An inactive zone blocks every trip that starts inside it, so it stays on
 * screen as a banner until each one has a rate card. A missing map outranks it:
 * it is the reason the admin cannot fix anything here.
 */
function renderZonesBanner(zones) {
  if (mapFailed) {
    zonesBanner.show({
      tone: 'warning',
      heading: t('banner.mapUnavailableHeading'),
      message: t('banner.mapUnavailableMessage'),
    });
    return;
  }
  const inactive = zones.filter((z) => z.status !== 'active').length;
  if (!inactive) {
    zonesBanner.hide();
    return;
  }
  zonesBanner.show({
    tone: 'warning',
    heading: t('banner.zonesInactiveHeading'),
    message: t('banner.zonesInactiveMessage', { inactive, total: zones.length }),
  });
}

function renderPendingNotice(zones) {
  const count = zones.filter((z) => z.pendingChange).length;
  pendingBanner.hidden = count === 0;
  qs('#zones-pending-text').textContent = t('pricingApproval.zonesPendingNotice', { n: count });
}

/** Tint the row of a zone whose rate card is awaiting approval. */
function tintPendingRows() {
  table.querySelectorAll('tbody tr').forEach((row) => {
    row.classList.toggle('pricing-zones__row--pending', Boolean(row.querySelector('[data-zone-pending]')));
  });
}

// ── Load ──────────────────────────────────────────────

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listZones(query);
    if (!isCurrent()) return;
    // Carry `pendingChange` across from allMatching by id, in case a page row lacks it.
    const pendingById = new Map((result.allMatching ?? []).map((z) => [String(z.id), z.pendingChange ?? null]));
    result.rows = result.rows.map((zone) => ({
      ...zone,
      pendingChange: zone.pendingChange ?? pendingById.get(String(zone.id)) ?? null,
    }));
    allMatching = result.allMatching ?? [];
    table.setData(result);
    tintPendingRows();
    renderPendingNotice(allMatching);
    renderZonesBanner(allMatching);

    // The map shows every matching zone, not just the current page.
    if (mapReady) {
      panel.setPolygons(allMatching);
      const active = allMatching.filter((z) => z.status === 'active').length;
      const inactive = allMatching.length - active;
      panel.setEmpty(allMatching.length === 0, t('zones.mapEmptyFiltered'));
      mapSummary.textContent = inactive
        ? t('zones.mapSummaryBlocked', { active, inactive })
        : t('zones.mapSummary', { active, inactive });
    }
  } catch (error) {
    if (!isCurrent()) return;
    allMatching = [];
    table.setError(error.message, load);
  }
}

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({ onDecided: load });

// Load the list first so the grid is usable even if the map never arrives.
await load();

const map = await panel.mount({ zoom: 9.6, tall: true });
if (map) {
  mapReady = true;
  await load();
} else {
  mapFailed = true;
  renderZonesBanner(allMatching);
  mapSummary.textContent = t('zones.mapUnavailable');
  createBtn.disabled = true;
  createBtn.title = t('zones.createNeedsMap');
}
