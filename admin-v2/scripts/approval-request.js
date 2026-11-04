/**
 * approval-request.js — SheDrive admin: one finance request on its own page
 * Spec: 2026-10-14 spec §1 · Stories: #5617 (Approvals) + one approval-cycle
 * story per type (#6559–#6568, #5623) · Kit: SheDrive.AdminPanel_v3-11-2026
 * `approval-reqeust.html`
 *
 * 2026-11-04 — the designer replaced the review dialog with this page. The kit
 * draws one case (a payout result); every request type follows its frame:
 *
 *   title          "<type> —" + the request id, round back button
 *   row of two     Request details | Before → After
 *   the type's own section(s)   e.g. a result file: tiles, search, lines
 *   action bar     Approve Request / Reject Request (Financial lead only)
 *
 * What each type puts in those blocks is the STRUCTURE table below, so a type
 * gets the structure its decision needs instead of one generic layout.
 *
 * Approve → kit popup-warning confirm; Reject → kit default-modal with the
 * reason (10–500). The kit's popup-success is a toast here (DESIGN-PORT.md
 * "Feedback after an action"), and the page redraws in its decided state.
 *
 * `?id=APR-nnnn` (required) · `&return=<screen>` sets where the back button goes.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { formatCount, formatDate, formatDateTime, formatEgp, formatPercent } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';
import { can } from './roles.js';
import '../components/ad-data-table.js';
import '../components/ad-stat-card.js';
import {
  el,
  icon,
  kitButton,
  backGlyph,
  forwardGlyph,
  ltr,
  money,
  typeLabel,
  payoutTypeLabel,
  lamp,
  subjectLink,
  who,
  returnTarget,
  alertBox,
  kvList,
  diffList,
  COUNT_KEYS,
  MONEY_KEYS,
} from './approval-review.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const view = {
  loading: qs('#req-loading'),
  missing: qs('#req-missing'),
  error: qs('#req-error'),
  body: qs('#req-body'),
};

COUNT_KEYS.add('linesSent');
COUNT_KEYS.add('linesPaid');
COUNT_KEYS.add('linesBackToDue');
MONEY_KEYS.add('owedTotal');

let request = null;

// ── Small builders ────────────────────────────────────

const egp = (value) => ltr(`${money(Math.abs(Number(value) || 0))} ${t('common.egp')}`);
const link = (href, text, ltrText = false) => {
  const a = el('a', ltrText ? 'ad-ltr' : null, text);
  a.href = href;
  return a;
};

/** Kit `standard-card-theme2` with the h5 + icon header (the page's top row). */
function topCard(titleText, iconName, body) {
  const wrap = el('div', 'standard-card-theme2 white-bg req-card');
  const header = el('div', 'card-header');
  const title = el('div', 'card-title');
  title.append(el('h5', null, titleText), el('span'));
  const iconBox = el('div', 'icon');
  const img = el('img');
  img.src = iconUrl(iconName);
  img.alt = '';
  iconBox.appendChild(img);
  header.append(title, iconBox);
  const cardBody = el('div', 'card-body pb-0');
  cardBody.appendChild(body);
  wrap.append(header, cardBody);
  return wrap;
}

/** Kit `standard-card light-medium-bg` with the icon + h4 header (a type's section). */
function sectionCard(titleText, iconName, ...children) {
  const wrap = el('section', 'standard-card light-medium-bg req-section');
  const header = el('div', 'card-header mb-3');
  const title = el('div', 'card-title');
  const img = el('img', 'icon');
  img.src = iconUrl(iconName);
  img.alt = '';
  const h = el('h4', null, titleText);
  title.append(img, h);
  header.appendChild(title);
  const body = el('div', 'card-body');
  body.append(...children.filter(Boolean));
  wrap.append(header, body);
  return wrap;
}

/** Kit KPI tiles. tiles: [{tone, icon, value, label, meta}] */
function tiles(list) {
  const row = el('div', 'ad-stats req-tiles');
  list.forEach((tile) => {
    const card = document.createElement('ad-stat-card');
    card.setAttribute('label', tile.label);
    card.setAttribute('value', tile.value);
    card.setAttribute('tone', tile.tone);
    card.setAttribute('icon', tile.icon);
    if (tile.meta) card.setAttribute('meta', tile.meta);
    row.appendChild(card);
  });
  return row;
}

/** A bulleted note — what deciding this request does. */
function effectList(items) {
  const ul = el('ul', 'req-effects');
  items.forEach((text) => ul.appendChild(el('li', null, text)));
  return ul;
}

function proofValue(proof) {
  if (!proof) return t('approvalPage.noProof');
  const name = typeof proof === 'string' ? proof : proof.name ?? t('approvalPage.proofFile');
  return ltr(name);
}

/**
 * A searchable, filterable, paged list (kit filter row + custom-grid-list),
 * the lines of a result file or the rows of a settlement sheet.
 * spec: { rows, columns, searchIn(row), placeholder, filter?: { label, options:[[value,label]], match(row,value) } }
 */
function pagedList(spec) {
  const wrap = el('div', 'req-list');
  const bar = el('div', 'filter-container white-bg req-filter');
  bar.appendChild(icon('fa-solid fa-sliders'));
  const searchId = `req-search-${Math.random().toString(36).slice(2, 7)}`;
  const searchLabel = el('label', 'visually-hidden', spec.placeholder);
  searchLabel.htmlFor = searchId;
  const search = el('input', 'form-control');
  search.type = 'search';
  search.id = searchId;
  search.placeholder = spec.placeholder;
  search.autocomplete = 'off';
  bar.append(searchLabel, search);
  let select = null;
  if (spec.filter) {
    select = el('select', 'form-select');
    select.setAttribute('aria-label', spec.filter.label);
    spec.filter.options.forEach(([value, label]) => {
      const option = el('option', null, label);
      option.value = value;
      select.appendChild(option);
    });
    bar.appendChild(select);
  }
  const end = el('div', 'end-side ms-auto');
  const reset = kitButton(t('approvalPage.reset'), 'btn-tertiary', 'fa-solid fa-arrows-rotate');
  end.appendChild(reset);
  bar.appendChild(end);

  const table = document.createElement('ad-data-table');
  wrap.append(bar, table);

  let page = 1;
  let pageSize = 10;
  const matching = () => {
    const needle = search.value.trim().toLowerCase();
    const value = select?.value ?? 'all';
    return spec.rows.filter((r) => (value === 'all' || spec.filter.match(r, value))
      && (!needle || spec.searchIn(r).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(needle))));
  };
  const draw = () => {
    const rows = matching();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, totalPages);
    table.setData({ rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, totalPages });
  };

  return {
    node: wrap,
    start() {
      table.pageSize = pageSize;
      table.columns = spec.columns;
      table.emptyState = { icon: 'not-found.svg', heading: t('approvals.linesNoMatchHeading'), message: t('approvals.linesNoMatchMessage') };
      table.addEventListener('pagechange', (event) => { page = event.detail.page; draw(); });
      table.addEventListener('pagesizechange', (event) => {
        pageSize = event.detail.pageSize;
        table.pageSize = pageSize;
        page = 1;
        draw();
      });
      search.addEventListener('input', () => { page = 1; draw(); });
      select?.addEventListener('change', () => { page = 1; draw(); });
      reset.addEventListener('click', () => {
        search.value = '';
        if (select) select.value = 'all';
        page = 1;
        draw();
      });
      draw();
    },
  };
}

// ── Per-type structure ────────────────────────────────
//
// details(r, ctx)  extra rows for the Request details card
// change(r, ctx)   { before, after } for the Before → After card
// sections(r, ctx) the type's own section cards (and a start() for paged lists)
// load(r)          extra context the page fetches for the type

const POLICY_TAB = { commission: 'pricing', cancellation_policy: 'pricing', balance_limit: 'finance', payout_settings: 'finance' };

function policySections(r) {
  const tab = POLICY_TAB[r.type];
  return [sectionCard(t('approvalPage.whereTitle'), 'policies.svg', kvList([
    [t('approvalPage.kvSetting'), subjectLink(r.subject, r.type, r.status)],
    [t('approvalPage.kvTab'), link(`pricing-policies.html?tab=${tab}`, t(`approvalPage.tab_${tab}`))],
    [t('approvalPage.kvApplies'), t(`approvalPage.applies.${r.type}`), 'apr-long'],
  ]))];
}

const RESULT_FILTER = (labelKey) => ({
  label: t(labelKey),
  options: [['all', t('approvals.linesAllResults')], ['FAILED', t('approvals.resultFailed')], ['SUCCESS', t('approvals.resultSuccess')]],
  match: (row, value) => row.res?.status === value,
});

const STRUCTURE = {
  payout_result: {
    details: (r) => {
      const type = r.payload?.payoutType ?? r.batch?.lines?.[0]?.payoutType ?? null;
      return [
        [t('approvalPage.kvFileType'), payoutTypeLabel(type)],
        [t('approvalPage.kvFileName'), r.batch ? ltr(`${r.batch.ref}-result.csv`) : undefined],
      ];
    },
    change: (r) => {
      const lines = resultLines(r);
      const paid = lines.filter((l) => l.res?.status === 'SUCCESS').length;
      const failed = lines.length - paid;
      return {
        before: { linesSent: lines.length, linesPaid: 0, linesBackToDue: 0 },
        after: { linesSent: 0, linesPaid: paid, linesBackToDue: failed },
      };
    },
    sections: (r) => {
      const lines = resultLines(r);
      const ok = lines.filter((l) => l.res?.status === 'SUCCESS');
      const ko = lines.filter((l) => l.res?.status !== 'SUCCESS');
      const sum = (list) => list.reduce((s, l) => s + l.amount, 0);
      const type = r.payload?.payoutType ?? lines[0]?.payoutType;
      const list = pagedList({
        rows: lines,
        placeholder: t('approvalPage.searchLines'),
        searchIn: (l) => [l.lineRef, l.driverName, l.nationalId, l.number, l.provider, l.res?.bankReference],
        filter: RESULT_FILTER('approvals.linesResultLabel'),
        columns: [
          { key: 'lineRef', label: t('approvalPage.colLine'), render: (l) => ltr(l.lineRef) },
          { key: 'driverName', label: t('approvalPage.colDriverName'), render: (l) => {
            const node = l.known ? link(`driver-balance-details.html?id=${encodeURIComponent(l.driverId)}`, l.driverName) : el('span', null, l.driverName);
            node.classList.add('text-bold');
            return node;
          } },
          { key: 'nationalId', label: t('approvals.colNationalId'), render: (l) => ltr(l.nationalId) },
          ...(type === 'PREPAID_CARD' ? [] : [{
            key: 'provider',
            label: t(type === 'BANK_ACCOUNT' ? 'payouts.previewColBank' : 'payouts.previewColWallet'),
            render: (l) => l.provider ?? '',
          }]),
          { key: 'number', label: t(`payouts.previewColNumber_${type ?? 'BANK_ACCOUNT'}`), render: (l) => ltr(l.number) },
          { key: 'amount', label: t('approvalPage.colAmountEgp'), numeric: true, render: (l) => el('p', `text-bold ad-ltr ${l.res?.status === 'SUCCESS' ? 'success-color' : 'danger-color'}`, money(l.amount)) },
          { key: 'result', label: t('approvals.colResult'), render: (l) => (l.res?.status === 'SUCCESS'
            ? lamp('approved', t('approvals.resultSuccess'))
            : lamp('rejected', t('approvals.resultFailed'))) },
          { key: 'reason', label: t('approvalPage.colReason'), render: (l) => (l.res?.status === 'SUCCESS'
            ? el('small', 'text-bold success-color ad-ltr', l.res.bankReference ?? '')
            : el('small', 'text-bold danger-color', l.res?.failureReason ?? '')) },
        ],
      });
      const node = sectionCard(t('approvalPage.resultTitle'), 'layers.svg',
        tiles([
          { tone: 'primary', icon: 'balance.svg', value: formatEgp(sum(lines)), label: t('approvalPage.tileFileTotal'), meta: t('approvalPage.tileLines', { n: formatCount(lines.length) }) },
          { tone: 'success', icon: 'checked-2.svg', value: formatEgp(sum(ok)), label: t('approvalPage.tileSuccess'), meta: t('approvalPage.tileLines', { n: formatCount(ok.length) }) },
          { tone: 'danger', icon: 'rejected.svg', value: formatEgp(sum(ko)), label: t('approvalPage.tileFailed'), meta: t('approvalPage.tileLines', { n: formatCount(ko.length) }) },
        ]),
        list.node);
      return { nodes: [node, effectCard([
        t('approvalPage.effect.payout_result_1'),
        t('approvalPage.effect.payout_result_2'),
        t('approvalPage.effect.payout_result_3'),
      ])], start: list.start };
    },
  },

  settlement_import: {
    details: (r) => [
      [t('approvals.kvFile'), r.import ? ltr(r.import.fileName) : undefined],
      [t('approvalPage.kvRows'), r.import ? formatCount(r.import.rows.length) : undefined],
    ],
    change: (r) => {
      const rows = r.import?.rows ?? [];
      const owed = (key) => rows.reduce((s, row) => s + Math.max(0, -(row[key] ?? 0)), 0);
      return { before: { owedTotal: owed('balanceBefore') }, after: { owedTotal: owed('balanceAfter') } };
    },
    sections: (r) => {
      const rows = r.import?.rows ?? [];
      const n = (outcome) => formatCount(rows.filter((row) => row.outcome === outcome).length);
      const list = pagedList({
        rows,
        placeholder: t('approvalPage.searchRows'),
        searchIn: (row) => [row.driverName, row.nationalId, row.phone, row.paymentRef],
        filter: {
          label: t('settlementImport.resultLabel'),
          options: [['all', t('settlementImport.allResults')], ['full', t('settlementImport.statFull')], ['partial', t('settlementImport.statPartial')], ['credit', t('settlementImport.statCredit')]],
          match: (row, value) => row.outcome === value,
        },
        columns: [
          { key: 'rowNo', label: t('approvals.colRowNo'), render: (row) => ltr(row.rowNo) },
          { key: 'driverName', label: t('approvals.colDriver'), render: (row) => (row.driverId ? link(`driver-balance-details.html?id=${encodeURIComponent(row.driverId)}`, row.driverName) : el('span', null, row.driverName)) },
          { key: 'nationalId', label: t('approvals.colNationalId'), render: (row) => ltr(row.nationalId) },
          { key: 'phone', label: t('approvalPage.colPhone'), render: (row) => ltr(row.phone ?? '') },
          { key: 'amount', label: t('approvalPage.colAmountEgp'), numeric: true, render: (row) => el('p', 'text-bold ad-ltr', money(row.amount)) },
          { key: 'balance', label: t('approvalPage.colBalance'), render: (row) => {
            const wrap = el('div', 'apr-diff');
            wrap.append(el('span', 'apr-diff__before ad-ltr', money(row.balanceBefore)), icon(`${forwardGlyph()} apr-diff__arrow`), el('span', 'apr-diff__after ad-ltr', money(row.balanceAfter)));
            return wrap;
          } },
          { key: 'payment', label: t('approvalPage.colPayment'), render: (row) => {
            const stack = el('div', 'req-stack');
            stack.append(ltr(row.paymentRef ?? ''), el('small', 'light-color', `${row.paymentDate ?? ''} · ${row.channel ?? ''}`));
            return stack;
          } },
          { key: 'outcome', label: t('approvals.colResult'), render: (row) => {
            if (row.outcome === 'full') return lamp('approved', t('settlementImports.outcomeFull'));
            if (row.outcome === 'partial') return lamp('pending', t('settlementImports.outcomePartial', { owed: formatEgp(-row.balanceAfter) }));
            return lamp('info', t('settlementImports.outcomeCredit', { extra: formatEgp(Math.min(row.amount, row.balanceAfter)) }));
          } },
        ],
      });
      const node = sectionCard(t('approvalPage.rowsTitle'), 'csv-file.svg',
        tiles([
          { tone: 'blue', icon: 'money.svg', value: formatEgp(r.import?.amount ?? 0), label: t('settlementImport.statAmount'), meta: t('approvalPage.tileRows', { n: formatCount(rows.length) }) },
          { tone: 'success', icon: 'checked-2.svg', value: n('full'), label: t('settlementImport.statFull') },
          { tone: 'warning', icon: 'money.svg', value: n('partial'), label: t('settlementImport.statPartial') },
          { tone: 'primary', icon: 'money.svg', value: n('credit'), label: t('settlementImport.statCredit') },
        ]),
        list.node);
      return { nodes: [node, effectCard([t('approvalPage.effect.settlement_import_1'), t('approvalPage.effect.settlement_import_2')])], start: list.start };
    },
  },

  settlement: {
    load: (r) => mockApi.getDriver(r.subject.id).catch(() => null),
    details: (r) => [[t('approvalPage.kvChannel'), r.payload?.method || undefined]],
    sections: (r, driver) => {
      const p = r.payload ?? {};
      return [
        sectionCard(t('approvalPage.settlementTitle'), 'transactions.svg', kvList([
          [t('approvals.colDriver'), link(`driver-balance-details.html?id=${encodeURIComponent(r.subject.id)}`, r.subject.label)],
          [t('approvalPage.kvBalanceNow'), driver ? egpSigned(driver.balance) : undefined],
          [t('approvalPage.kvChannel'), p.method || ''],
          [t('approvals.kvPaymentDate'), p.date ? formatDate(p.date) : p.at ? formatDateTime(p.at) : ''],
          [t('approvals.kvReference'), p.reference ? ltr(p.reference) : ''],
          [t('approvals.kvNote'), p.note || '', 'apr-long'],
          [t('approvalPage.kvProof'), proofValue(p.proof)],
        ])),
        effectCard([t('approvalPage.effect.settlement_1'), t('approvalPage.effect.settlement_2')]),
      ];
    },
  },

  payout: {
    load: (r) => mockApi.getDriverPayout(r.subject.id).catch(() => null),
    details: (r) => [[t('approvals.kvReference'), r.payload?.reference ? ltr(r.payload.reference) : undefined]],
    sections: (r, payout) => {
      const p = r.payload ?? {};
      const m = payout?.method;
      const pos = payout?.position;
      return [
        sectionCard(t('approvalPage.payoutTitle'), 'withdrawal-wallet.svg', kvList([
          [t('approvals.colDriver'), link(`driver-balance-details.html?id=${encodeURIComponent(r.subject.id)}`, r.subject.label)],
          [t('approvalPage.kvPaidTo'), m ? `${payoutTypeLabel(m.type)}${m.provider ? ` — ${m.provider}` : ''}` : ''],
          [t('approvalPage.kvNumber'), m ? ltr(m.number) : ''],
          [t('approvalPage.kvHolder'), m?.holderName ?? ''],
          [t('approvals.kvReference'), p.reference ? ltr(p.reference) : ''],
          [t('approvals.kvPaymentDate'), p.at ? formatDateTime(p.at) : ''],
          [t('approvalPage.kvProof'), proofValue(p.proof)],
        ])),
        pos ? sectionCard(t('approvalPage.positionTitle'), 'money.svg', tiles([
          { tone: 'primary', icon: 'wallet-plus.svg', value: formatEgp(pos.due), label: t('approvalPage.posDue') },
          { tone: 'warning', icon: 'stopwatch.svg', value: formatEgp(pos.onHold), label: t('approvalPage.posOnHold') },
          { tone: 'blue', icon: 'layers.svg', value: formatEgp(pos.inBatch + pos.sent), label: t('approvalPage.posInBatch') },
        ])) : null,
        effectCard([t('approvalPage.effect.payout_1'), t('approvalPage.effect.payout_2')]),
      ].filter(Boolean);
    },
  },

  fee_waiver: {
    load: async (r) => {
      const [rider, trip] = await Promise.all([
        mockApi.getRider(r.subject.id).catch(() => null),
        r.payload?.tripId ? mockApi.getTrip(r.payload.tripId).catch(() => null) : null,
      ]);
      return { rider, trip };
    },
    details: (r) => [[t('approvals.kvTrip'), r.payload?.tripId ? link(`trip-detail.html?id=${encodeURIComponent(r.payload.tripId)}`, r.payload.tripId, true) : undefined]],
    sections: (r, { rider, trip } = {}) => {
      const p = r.payload ?? {};
      return [
        sectionCard(t('approvalPage.feeTitle'), 'cancel-trip.svg', kvList([
          [t('approvalPage.kvRider'), link(`rider-balance-details.html?id=${encodeURIComponent(r.subject.id)}`, r.subject.label)],
          [t('approvals.kvTrip'), p.tripId ? link(`trip-detail.html?id=${encodeURIComponent(p.tripId)}`, p.tripId, true) : ''],
          [t('approvalPage.kvTripWhen'), trip?.createdAt ? formatDateTime(trip.createdAt) : undefined],
          [t('approvalPage.kvTripRoute'), trip ? `${trip.pickup?.area ?? ''} → ${trip.destination?.area ?? ''}` : undefined],
          [t('approvalPage.kvTripDriver'), trip?.driverName ?? undefined],
          [t('approvalPage.kvFee'), egp(r.amount)],
          [t('approvalPage.kvOwedNow'), rider ? egp(rider.outstanding ?? 0) : undefined],
          [t('approvals.kvReason'), p.reason ?? '', 'apr-long'],
        ])),
        effectCard([t('approvalPage.effect.fee_waiver_1'), t('approvalPage.effect.fee_waiver_2'), t('approvalPage.effect.fee_waiver_3')]),
      ];
    },
  },

  payout_method: {
    load: (r) => mockApi.getDriverPayout(r.subject.id).catch(() => null),
    sections: (r, payout) => {
      const pos = payout?.position;
      const m = payout?.method;
      return [
        sectionCard(t('approvalPage.driverTitle'), 'profile-info.svg', kvList([
          [t('approvals.colDriver'), link(`driver-profile.html?id=${encodeURIComponent(r.subject.id)}`, r.subject.label)],
          [t('approvalPage.kvMethodUpdated'), m?.updatedAt ? `${formatDateTime(m.updatedAt)}${m.updatedBy ? ` · ${m.updatedBy}` : ''}` : undefined],
          [t('approvalPage.posDue'), pos ? egp(pos.due) : undefined],
          [t('approvalPage.posInBatch'), pos ? egp(pos.inBatch + pos.sent) : undefined],
        ])),
        effectCard([t('approvalPage.effect.payout_method_1'), t('approvalPage.effect.payout_method_2'), t('approvalPage.effect.payout_method_3')]),
      ];
    },
  },

  rate_card: {
    load: (r) => mockApi.getZone(r.subject.id).catch(() => null),
    sections: (r, zone) => [
      sectionCard(t('approvalPage.whereTitle'), 'location.svg', kvList([
        [t('approvalPage.kvZone'), link('pricing-zones.html', r.subject.label)],
        [t('approvalPage.kvZoneStatus'), zone?.status ? t(`approvalPage.zoneStatus.${zone.status}`) : undefined],
        [t('approvalPage.kvApplies'), t('approvalPage.applies.rate_card'), 'apr-long'],
      ])),
    ],
  },

  commission: { sections: policySections },
  cancellation_policy: { sections: policySections },
  balance_limit: { sections: policySections },
  payout_settings: { sections: policySections },
};

function egpSigned(value) {
  const n = Number(value) || 0;
  return ltr(`${n < 0 ? '−' : ''}${money(Math.abs(n))} ${t('common.egp')}`);
}

function effectCard(items) {
  return sectionCard(t('approvalPage.effectTitle'), 'review-list.svg', effectList(items));
}

/** The lines of the one file a payout result answers, failed first. */
function resultLines(r) {
  if (!r.batch) return [];
  const results = new Map((r.batch.result ?? []).map((x) => [x.lineRef, x]));
  const type = r.payload?.payoutType ?? null;
  return r.batch.lines
    .filter((l) => !type || l.payoutType === type)
    .map((l) => ({ ...l, res: results.get(l.lineRef) ?? null }))
    .sort((a, b) => (a.res?.status === 'FAILED' ? 0 : 1) - (b.res?.status === 'FAILED' ? 0 : 1));
}

// ── Render ────────────────────────────────────────────

function setHeading(r) {
  const heading = qs('#ad-page-title');
  if (heading) {
    heading.textContent = `${typeLabel(r.type)} —`;
    const wrap = heading.parentElement;
    qs('.req-title-id', wrap)?.remove();
    wrap.appendChild(el('small', 'text-bold tertiary-color ad-ltr req-title-id', r.id));
  }
  document.title = `${t('shell.brand')} — ${r.id}`;
}

function standing(r) {
  const nodes = [];
  if (r.status === 'approved') {
    nodes.push(alertBox('success', t('approvalPage.approvedBanner', { name: r.checker ?? '', at: formatDateTime(r.decidedAt) })));
  } else if (r.status === 'rejected') {
    const text = el('p');
    text.append(document.createTextNode(t('approvalPage.rejectedBanner', { name: r.checker ?? '', at: formatDateTime(r.decidedAt) })), el('br'), el('strong', null, r.rejectReason ?? ''));
    nodes.push(alertBox('danger', text));
  } else if (!can('finance.approve')) {
    nodes.push(alertBox('info', r.waitingForLead ? t('approvalRoles.waitingForLead') : t('approvalRoles.officerReadOnly')));
  } else if (r.waitingForLead) {
    nodes.push(alertBox('warning', `${t('approvalRoles.waitingForLead')}. ${t('approvalRoles.waitingForLeadMeta')}`));
  } else if (r.madeByYou || !r.canDecide) {
    nodes.push(alertBox('info', t('approvalRoles.madeByYouLead')));
  }
  return nodes;
}

function requestCard(r, ctx) {
  const spec = STRUCTURE[r.type] ?? {};
  const pairs = [
    [t('approvalPage.kvSubject'), subjectLink(r.subject, r.type, r.status)],
    [t('approvals.kvAmount'), r.amount === null || r.amount === undefined ? undefined : egp(r.amount)],
    [t('approvalPage.kvCreatedBy'), who(r.maker, r.madeAt, r.madeByYou)],
    ...(spec.details?.(r, ctx) ?? []),
    [t('approvals.kvStatus'), r.waitingForLead ? lamp('pending', t('approvalRoles.waitingForLead')) : lamp(r.status)],
    [t('approvals.kvCheckedBy'), r.status !== 'pending' ? (r.checker ? ltr(r.checker) : '') : undefined],
    [t('approvals.kvDecidedAt'), r.status !== 'pending' ? formatDateTime(r.decidedAt) : undefined],
  ];
  return topCard(t('approvalPage.requestTitle'), 'files.svg', kvList(pairs));
}

function changeCard(r, ctx) {
  const spec = STRUCTURE[r.type] ?? {};
  const { before, after } = spec.change?.(r, ctx) ?? { before: r.before, after: r.after };
  return topCard(t('approvalPage.changeTitle'), 'transactions.svg', diffList(before, after));
}

function actionBar(r) {
  const bar = qs('#req-actions');
  bar.replaceChildren();
  bar.hidden = true;
  if (r.status !== 'pending' || !can('finance.approve')) return;
  const approve = kitButton(t('approvalPage.approve'), 'btn-success d-flex', 'fa-solid fa-check');
  const reject = kitButton(t('approvalPage.reject'), 'btn-danger d-flex', 'fa-solid fa-xmark');
  approve.id = 'req-approve';
  reject.id = 'req-reject';
  if (r.madeByYou || !r.canDecide) {
    approve.disabled = true;
    reject.disabled = true;
  } else {
    approve.addEventListener('click', () => openConfirm(r));
    reject.addEventListener('click', () => openReject(r));
  }
  bar.append(approve, reject);
  bar.hidden = false;
}

async function render(r) {
  setHeading(r);
  const spec = STRUCTURE[r.type] ?? {};
  let ctx = null;
  try {
    ctx = spec.load ? await spec.load(r) : null;
  } catch {
    ctx = null;
  }

  qs('#req-standing').replaceChildren(...standing(r));
  qs('#req-effect').textContent = r.status === 'pending' ? t(`approvals.typeEffect.${r.type}`) : '';
  const col = (node) => {
    const c = el('div', 'col');
    c.appendChild(node);
    return c;
  };
  qs('#req-top').replaceChildren(col(requestCard(r, ctx)), col(changeCard(r, ctx)));

  const out = spec.sections?.(r, ctx) ?? [];
  const nodes = Array.isArray(out) ? out : out.nodes;
  qs('#req-sections').replaceChildren(...nodes);
  if (!Array.isArray(out)) out.start?.();
  actionBar(r);
}

function show(which) {
  Object.entries(view).forEach(([key, node]) => { node.hidden = key !== which; });
}

async function load() {
  if (!request) show('loading');
  try {
    const result = id ? await mockApi.getApproval(id) : null;
    if (!result) {
      show('missing');
      return;
    }
    request = result;
    await render(request);
    show('body');
  } catch (error) {
    qs('#req-error-state').setAttribute('message', error?.message ?? '');
    show('error');
  }
}

// ── Back button: where she came from ─────────────────

(() => {
  const back = qs('#ad-page-actions a.btn-back');
  const target = returnTarget();
  if (back && target) back.href = target;
})();

// ── Approve / reject (kit popup-warning + default-modal) ──

async function bootstrapModal() {
  try {
    await loadBootstrap();
  } catch {
    /* fall back to class toggling */
  }
  return window.bootstrap?.Modal ?? null;
}

function modalShell(idName, variant) {
  const root = el('div', `modal fade ${variant} apr-modal`);
  root.id = idName;
  root.tabIndex = -1;
  root.dataset.bsBackdrop = 'static';
  root.setAttribute('aria-labelledby', `${idName}-title`);
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content">
    <div class="modal-header"><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"></div><div class="modal-footer"></div></div></div>`;
  qs('.btn-close', root).setAttribute('aria-label', t('aria.closeDialog'));
  document.body.appendChild(root);
  return {
    root,
    header: qs('.modal-header', root),
    body: qs('.modal-body', root),
    footer: qs('.modal-footer', root),
    async show() {
      const Modal = await bootstrapModal();
      if (Modal) Modal.getOrCreateInstance(root).show();
      else { root.classList.add('show'); root.style.display = 'block'; }
    },
    hide() {
      const Modal = window.bootstrap?.Modal;
      if (Modal) Modal.getOrCreateInstance(root).hide();
      else { root.classList.remove('show'); root.style.display = 'none'; }
    },
  };
}

let confirmModal = null;
let rejectModal = null;

async function decided(modal, title, body) {
  modal.hide();
  shell.showToast(body, 'success', { title });
  shell.refreshNavCounts?.();
  request = null;
  await load();
}

async function openConfirm(r) {
  confirmModal ??= modalShell('req-confirm', 'popup-warning');
  const sign = el('div', 'status-sign warning');
  sign.appendChild(icon('fa-solid fa-warning'));
  const h = el('h4', null, t('kitFinance.aprConfirmTitle', { id: r.id }));
  h.id = 'req-confirm-title';
  const error = el('div', 'apr-popup-error');
  confirmModal.body.replaceChildren(sign, h, el('p', null, t(`approvals.typeEffect.${r.type}`)), el('p', 'apr-popup-note', t('kitFinance.aprConfirmNote')), error);
  const ok = kitButton(t('approvalPage.approve'), 'btn-success', 'fa-solid fa-check');
  ok.id = 'req-confirm-btn';
  const back = kitButton(t('kitFinance.aprBackToReview'), 'btn-warning-outline', backGlyph());
  back.addEventListener('click', () => confirmModal.hide());
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    back.disabled = true;
    error.replaceChildren();
    try {
      await mockApi.approveRequest(r.id);
      await decided(confirmModal, t('kitFinance.aprApprovedTitle'), t('kitFinance.aprApprovedBody', { id: r.id }));
    } catch (err) {
      ok.disabled = false;
      back.disabled = false;
      error.replaceChildren(alertBox('danger', err?.message || t('approvals.loadFailed')));
    }
  });
  confirmModal.footer.replaceChildren(ok, back);
  await confirmModal.show();
}

async function openReject(r) {
  rejectModal ??= modalShell('req-reject-modal', 'default-modal');
  const img = el('img', 'icon');
  img.src = iconUrl('rejected-file.svg');
  img.alt = '';
  const h = el('h3', null, t('kitFinance.aprRejectTitle'));
  h.id = 'req-reject-modal-title';
  rejectModal.header.replaceChildren(img, h, rejectModal.header.querySelector('.btn-close'));

  const label = el('label', null, t('approvals.rejectReasonLabel'));
  label.htmlFor = 'req-reject-reason';
  label.append(' ', el('span', 'text-danger', '*'));
  const textarea = el('textarea', 'form-control');
  textarea.id = 'req-reject-reason';
  textarea.rows = 3;
  textarea.maxLength = 600;
  const fieldError = el('p', 'apr-field-error');
  fieldError.setAttribute('role', 'alert');
  const error = el('div', 'apr-popup-error');
  const form = el('form', 'row');
  form.noValidate = true;
  const col = el('div', 'col-12');
  col.append(label, textarea, fieldError);
  form.appendChild(col);
  rejectModal.body.replaceChildren(
    el('small', null, `${typeLabel(r.type)} — ${r.subject?.label ?? ''}`),
    form,
    el('small', 'light-color', t('approvals.rejectReasonHint')),
    error,
  );

  const validate = () => {
    const text = textarea.value.trim();
    if (!text) return t('approvals.rejectReasonEmpty');
    if (text.length < 10) return t('approvals.rejectReasonShort');
    if (text.length > 500) return t('approvals.rejectReasonLong');
    return null;
  };
  const submit = kitButton(t('approvalPage.reject'), 'btn-danger', 'fa-solid fa-xmark');
  submit.id = 'req-reject-submit';
  const back = kitButton(t('kitFinance.aprBackToReview'), 'btn-primary-outline', backGlyph());
  back.addEventListener('click', () => rejectModal.hide());
  const doReject = async () => {
    const problem = validate();
    fieldError.textContent = problem ?? '';
    textarea.classList.toggle('is-invalid', Boolean(problem));
    if (problem) { textarea.focus(); return; }
    submit.disabled = true;
    back.disabled = true;
    error.replaceChildren();
    try {
      await mockApi.rejectRequest(r.id, textarea.value.trim());
      await decided(rejectModal, t('kitFinance.aprRejectedTitle'), t('kitFinance.aprRejectedBody', { id: r.id }));
    } catch (err) {
      submit.disabled = false;
      back.disabled = false;
      error.replaceChildren(alertBox('danger', err?.message || t('approvals.loadFailed')));
    }
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); doReject(); });
  submit.addEventListener('click', doReject);
  rejectModal.footer.replaceChildren(submit, back);
  await rejectModal.show();
  textarea.focus();
}

qs('#req-retry').addEventListener('click', load);

load();
