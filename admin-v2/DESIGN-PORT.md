# admin-v2 — SheDrive Admin Panel on the delivered design kit

`shedrive-web/admin-v2/` is a **full copy** of `shedrive-web/admin/` re-skinned onto the
delivered design kit `SheDrive.AdminPanel_v18-08-2026`. The original `admin/` is
untouched, so nothing that exists today can break.

## Ground rules

1. **Never edit `shedrive-web/admin/`.** Only `admin-v2/`.
2. **Never edit `admin-v2/vendor/**`.** That is the delivered kit, vendored verbatim
   (`css/`, `icons/`, `img/`, `fonts/`, `js/`).
3. **Never edit `admin-v2/scripts/mock-api.js`, `seed.js`, `mutations.js`,
   `format.js`, `request-guard.js`, `admin-auth.js`.** The data layer stays identical
   to `admin/` so behaviour and acceptance criteria are preserved.
4. **Screen controllers (`admin-v2/scripts/<screen>.js`) keep their public behaviour.**
   Re-skin by changing what the *components* render, not by rewriting screen logic.
   Touch a screen script only to adjust presentation (icons, labels, a `render()`
   returning kit markup) — never its data flow, filters, sorting, or story wiring.
5. **Bilingual.** English (LTR, default) and Arabic (RTL), using the kit's own
   `styles-ar.css` / `bootstrap.rtl` builds. See `I18N-PORT.md` — every
   user-visible string goes through `t()` or a `data-i18n*` attribute.
6. **Desktop-first**, verified at 1280 px and 1440 px.
7. No build step, no npm. Vanilla HTML + CSS + ES modules, light DOM only.

## The CSS stack (injected by `components/ad-styles.js`)

```
vendor/css/bootstrap/bootstrap.min.css
vendor/css/lightbox/magnific-popup.css
vendor/css/styles.css            ← the design kit
../shared/styles/tokens.css      ← variables only
styles/admin-tokens.css          ← density variables only
styles/design-tokens.css         ← re-points the shared tokens at the kit palette
styles/admin.css                 ← the portal's original stylesheet (legacy vocabulary)
styles/admin-bridge.css          ← fits the shell to the kit + re-skins legacy classes
<screen styles>                  ← e.g. styles/list.css
```

Font Awesome 7 comes from the CDN, exactly as the kit's pages load it.
`shared/styles/reset.css`, `base.css`, `components.css`, `utilities.css` are **not**
loaded any more — Bootstrap plus the kit replace them, and `admin-bridge.css` re-skins
the handful of classes (`.btn--*`, `.input`, `.field`, `.badge--*`, `.toast`,
`.spinner`) that came from `components.css`.

## Kit palette

| Role | Value |
|---|---|
| Primary | `#7323D7`, dark `#5c1cab` |
| Page background | `#f7f2fd` |
| Border | `#e9dcf9` |
| Text | `#381169` |
| Success | `#35C500` / strong `#279200` / soft `#d5ffc5` |
| Warning | `#FF9500` / strong `#c27100` / soft `#fff4e6` |
| Danger | `#E50000` / soft `#ffe5e5` |
| Info | `#00AAFF` |

Do **not** hardcode these in a screen or component stylesheet — they are already in
`styles/design-tokens.css` as `--color-*`. Use `var()`.

## Shell (`components/ad-shell.js`, done)

Renders the kit chrome:

```html
<ad-shell class="wrapper">
  <nav id="sidebar"> .top-triangle, #dismiss, .sidebar-header>.logo,
                     ul#main-menu (span.category + li>a>img), .sidebar-footer </nav>
  <div id="content" class="ad-main">
    <header> button#sidebarCollapse, .topbar-breadcrumb, .end-side>ul.topbar-menu </header>
    <main id="admin-content" class="ad-content container-fluid">
      <div class="section-title row gy-3"> h3.underline-title + .end-side#ad-page-actions </div>
      …screen content…
    </main>
  </div>
  <div class="overlay"></div>
</ad-shell>
```

Attributes: `active`, `page-title`, `breadcrumb`, `back`, `screen-styles`, `mapbox`,
`content-class`, `no-auth`.

`scripts/design-init.js` boots the kit's JS: Bootstrap bundle (dropdowns + modals),
jQuery + Magnific Popup (`bindLightbox()`), the sidebar collapse, password eyes, and
OTP box helpers (`initOtpInputs`, `readOtp`). Call `bindLightbox(root)` again after
rendering new `.photo-trigger` elements.

Helpers in `components/ad-styles.js`: `assetUrl('vendor/img/logo.png')` and
`iconUrl('shield.svg')` resolve kit assets from any screen depth.

## Kit markup vocabulary — use these, not new CSS

| Need | Kit markup |
|---|---|
| Page section | `<section class="sm-padding"><div class="container-fluid">…` (the shell already provides `.container-fluid`, so screens just use `.ad-section` or a card) |
| Card | `<div class="standard-card-theme2 white-bg"><div class="card-header"><div class="card-title"><h5>…</h5></div><div class="icon"><img …></div></div><div class="card-body">…</div></div>` |
| Key/value list | `.list-multi-column.no-border.p-0 > .row.gx-4 > .col > .row.gx-0.list-row > .list-item.col.text-bold` + `.list-item.col-auto.justify-content-md-end` |
| KPI tile | `.neutral-widjet.{primary,blue,success,danger,warning} > .widjet-body > .icon > img` + `.content > p.number` + `p` |
| Filter row | `<form><div class="filter-container white-bg"><i class="fa-solid fa-sliders"></i> …controls… <div class="end-side ms-auto">buttons</div></div></form>` |
| Date range | `.date-inputs-container > input.form-control[type=date] + span + input` |
| Data grid | `<div class="table-responsive"><table class="table custom-grid-list"><thead>…<tbody>…<tfoot>` |
| Pagination | `<ul class="pagination"><li class="page-item [active|disabled]"><a class="page-link">…` inside `tfoot` |
| Status lamp | `<div class="status-active-lamp"><div class="lamp"></div>Approved</div>` — also `status-warning-lamp`, `status-danger-lamp`, `status-blue-lamp`, `status-primary-lamp`, `status-disabled-lamp`, and `-solid` variants |
| Status chip | `.status-approved`, `.status-pending`, `.status-rejected`, `.status-created` (each with `<div class="icon"><i …></div>` inside) |
| Empty / error / not-found | `<div class="result-message primary"><span class="icon"><img src="…"></span><h3>…</h3><p>…</p><button class="btn btn-primary-rounded-outline">…</button></div>` — tones: `primary info success warning danger` |
| Timeline | `<ol class="timeline-vertical"><li[.success|.danger]><lable>Label</lable><span>meta</span></li>` |
| Document thumbnails | `.lightbox-container > a.photo-trigger[href=full][title] > .thumb-item > .thumb-img > .photo[style=background-image] > i.fa-expand` + `.thumb-details > h6 + p` |
| Modal | Bootstrap 5 modal with `.modal.fade.popup-warning` (confirm). The kit's `.popup-success` result is not used — results are toasts, see below |
| Banner | `<div class="alert info"><i class="fa-solid …"></i><div class="details"><h6>…</h6><p>…</p></div></div>` — tones `info success warning danger`; rendered by `<ad-banner>` |
| Buttons | `.btn` + `.btn-primary`, `-secondary`, `-tertiary`, `-success`, `-warning`, `-danger`, `-info`, `-light`, `-white`, each with `-outline`, `-rounded`, `-rounded-outline`; `.btn-back.btn-back-outline` (round), `.btn-primary-gradient`, `.btn-submit`. **The kit has no size modifier** — `.btn-x-*` is a rotated `+` glyph used as a close/remove control, not a small button. For a compact button add `.btn--sm` from `admin-bridge.css`. |
| Inputs | `.form-control`, `.form-select`, `.input-group` + `img.input-icon`, `.show-hide-icon` |
| Section heading | `.section-title.row > .title.col-auto > h3.underline-title` |

Kit icons live in `vendor/icons/` (144 SVGs). Names are case-sensitive on a real host —
`Dashboard-2.svg` really is capitalised. Useful ones: `Dashboard-2, trips, shield,
applications, steering-wheel, user-star, prices, policies, reports, handshake,
file-checked, users, profile-info, user-2, vehicle, driving-license, chart, timeline,
upload-file, image, not-found, cloud-connection-off, approved-application,
signal-waves, checked-2, stop-hand, mail, lock2, gps, wallet, money-bag`.

## Legacy vocabulary still emitted by screen scripts

`admin-bridge.css` re-skins these so untouched screens still look right:
`.ad-section*`, `.ad-stack`, `.ad-row`, `.ad-split`, `.ad-detail-*`, `.ad-tabs*`,
`.ad-modal*`, `.ad-map*`, `.ad-stub`, `.ad-form-error`, `.ad-skeleton`,
`.btn--primary|secondary|ghost|danger|sm|lg|full|icon`, `.input`, `.field*`,
`.badge--brand|success|warning|danger|info`, `.spinner`.
Keep emitting them where a screen already does; prefer kit classes for anything new.

## Feedback after an action — toast, error toast, banner (2026-10-15)

The confirmation dialog asks; what follows it tells. **Deviation from the kit:** the
kit closes every action with a `popup-success` dialog the admin must dismiss. It asks
nothing, so it is a toast instead — on every screen that had one (driver and rider
profile, driver application, trip detail, safety report, SOS case, approvals, admin
users, pricing zones and policies, driver and rider balance details).

| Kind | Component | When | Behaviour |
|---|---|---|---|
| **Toast** | `ad-toast-host` — `shell.showToast(message, tone, { title, action })` | An action finished. Tone follows the *outcome*: a delete or suspension that worked is `success`; `warning` only when it worked with a caveat (suspension pending until the trip ends). | Bottom-end, auto-dismiss (4 s+, longer for longer text), timer bar, pauses on hover/focus, close button, `role="status"`. A change that went to maker-checker keeps its "View the request" link as the toast action. |
| **Error toast** | same, tone `danger` + `{ title, action: { label, onClick } }` | An action failed **and there is no form to show it in** — an export, a template download, a boundary save, a map that cannot load, a copy. | Stays until dismissed, `role="alert"`, optional Retry. |
| **Banner** | `<ad-banner>` → `banner.show({ tone, heading, message, action })` | A state that stays true: driver/rider suspended, pending suspension, under review, application pending or rejected, cancelled or expired trip, resolved report, closed SOS case, an SOS SMS that did not reach a contact, inactive zones, map unavailable, a detail page that failed to load. | Kit `.alert` at the top of the content; gone when the state ends. |

Rules:

- A failure **inside a dialog stays inline in that dialog** — the admin's input is still
  there to correct and resend.
- An action that navigates away (approve / reject application, sign out) uses
  `queueToast()` from `components/ad-toast.js`; the next page shows it
  (sessionStorage `shedrive.adminToast`).
- `ad-filter-bar` actions get both for free: an export shows "Export ready", a rejected
  `onClick` shows an error toast with Retry. Override the success text with `toast`.
- Trip detail, safety report and SOS case load through `scripts/page-banner.js`
  (`loadWithBanner`), so `?state=error` shows a danger banner with Retry instead of a
  blank page. The two profiles keep their own load-error block.
- Every new string is in `i18n/feedback.js` (`toast.*`, `banner.*`), both languages.

## Screen inventory

Ported from `admin/` (same file names, same controllers):
`index.html` (sign-in), `dashboard.html`, `trips.html`, `trip-detail.html`,
`safety-reports.html`, `safety-report.html`, `driver-applications.html`,
`driver-application.html`, `drivers.html`, `driver-profile.html`, `riders.html`,
`rider-profile.html`, `pricing-zones.html`, `pricing-policies.html`, `reports.html`,
`reconciliation.html`, `audit-log.html`, `admin-users.html`, `screens.html`.

New in v2, from the kit (screens that did not exist as pages before):
`2fa.html`, `2fa-setup.html`, `otp.html`, `recovery-code.html`, `password-forgot.html`,
`password-new.html`, `admin-profile.html`.

The kit's state variants (`*-empty`, `*-error`, `*-not-found`) are not separate files —
every list screen already honours `?state=empty|loading|error|long`, and detail screens
honour a missing id. Those query strings are the state variants.

## Status — what the port actually changed

| Layer | File(s) | Change |
|---|---|---|
| Style stack | `components/ad-styles.js` | Bootstrap + kit + tokens + bridge; Font Awesome from CDN; kit favicon |
| Palette | `styles/design-tokens.css` | shared tokens re-pointed at the kit palette, so untouched screen CSS inherits the new look |
| Bridge | `styles/admin-bridge.css` | shell fit-up + re-skin of `.btn--*`, `.input`, `.field*`, `.badge--*`, `.toast`, `.spinner`, `.ad-*` |
| Chrome | `components/ad-shell.js`, `scripts/nav.js`, `scripts/design-init.js` | kit sidebar / topbar / section-title; Bootstrap + Magnific + sidebar + password-eye + OTP behaviours |
| Components | `ad-data-table`, `ad-filter-bar`, `ad-status-pill`, `ad-stat-card`, `ad-empty-state`, `ad-detail-section`, `ad-timeline`, `ad-doc-viewer`, `ad-form-modal`, `ad-map-panel` | render kit markup; **public APIs unchanged** |
| List screens | `drivers`, `driver-applications`, `riders`, `trips`, `safety-reports` | kit KPI widget row (`scripts/list-metrics.js`), counts derived from the same list query the grid runs |
| Detail screens | `driver-profile`, `driver-application`, `rider-profile`, `trip-detail`, `safety-report` | kit back button, kit cards, kit document lightbox with the kit's photographs (`scripts/doc-images.js`) |
| Auth | `index.html` + six new kit pages | kit split layout, six-box OTP, QR enrolment, recovery codes |
| New screens | `admin-profile.html` | the page the kit's topbar dropdown links to; it ships no such page |

The data layer (`mock-api.js`, `seed.js`, `mutations.js`, `format.js`, `request-guard.js`,
`admin-auth.js`) is byte-identical to `admin/`, so every acceptance criterion the old
portal demonstrated still holds — including `?state=empty|loading|error|long` and the
`?auth=strict` production guard.

## Testing

`_verify.html` is a smoke harness: open `http://localhost:8017/admin-v2/_verify.html`
and it loads all 24 screen URLs plus the five detail screens (resolving a real record id
from each list grid) in a 1280 px iframe, asserting per-screen DOM markers, the presence
of the kit chrome, and the absence of horizontal overflow.

Last full run: **29/29 pages OK, no console errors, no failed requests.**
Also checked by hand: sign-in → 2FA → dashboard, sort, paginate, filter, the admin-user
create modal end to end (validation → toast → grid refresh), the document lightbox, the
sidebar collapse, the `?auth=strict` redirect, and layout at 1280 px and 1440 px.

Note when testing in a headless/occluded browser pane: CSS transitions do not advance
because no frames are composited, so class-driven animated states (the sidebar collapse)
read as unchanged unless you null the `transition` property before measuring.

## Known deviations from the kit

- **Bilingual, English-first.** The kit's `styles-ar.css` and `bootstrap.rtl` builds are
  wired up and the topbar language dropdown is live; a cold visit lands in English
  because the backlog and acceptance criteria are written in English. See
  `I18N-PORT.md`.
- **No SSO.** The kit's login screen offers Apple / Google buttons; the portal has no
  such flow, so they are not shown.
- The kit's `driver-unsuspend.html` / `rider-reinstate.html` are modal states of the
  profile screens, not separate pages — they are reached from the profile's account
  actions.
- The kit's `*-empty` / `*-error` / `*-not-found` pages are the `?state=` variants.
- **No `popup-success` result dialogs.** An action's result is a toast, not a dialog to
  close — see *Feedback after an action* above.

## Intentional divergence from `admin/` — SOS cases (2026-09-07)

This document states that the data layer (`mock-api.js`, `seed.js`, `mutations.js`,
`format.js`, `request-guard.js`, `admin-auth.js`) is identical across `admin/` and
`admin-v2/` and must not be forked.

**The SOS incident lifecycle breaks that rule, deliberately.** The two SOS screens
(`sos-requests.html`, `sos-request.html`), together with everything they need, exist in
`admin-v2/` only:

| File | What was added |
|---|---|
| `scripts/seed.js` | `SOS_CASES`, `SOS_CASES_BY_ID` |
| `scripts/mock-api.js` | `listSosCases`, `getSosCase`, `actionSosCase` |
| `scripts/mutations.js` | a `sosCases` patch collection, replayed onto `SOS_CASES` |
| `scripts/nav.js` | the `sos` entry, in Operations above Safety reports |
| `i18n/core.js`, `lists.js`, `details.js`, `config.js` | EN + AR strings |
| `scripts/screens.js`, `_verify.html` | designer index cards, verify manifest rows |

`admin/` (v1) is **not** changed and has no SOS screens.

This is recorded here rather than left to be discovered as drift. v2 is the direction of
travel; back-porting to v1 is not planned. Anyone diffing the two data layers should
expect the SOS additions and nothing else.

Design: `docs/superpowers/specs/2026-09-03-sos-incident-lifecycle-design.md` §5.
Stories: `#3945` / `#3946` (dev), `#3947` / `#3948` (design).

## Intentional divergence from `admin/` — financial core (2026-09-08)

Same rule, same deliberate exception, for the rider-fee half of the financial core
ledger model. `admin/` (v1) has none of this — its driver-balance ledger stops at
`#TBD-A`/`#1813` and never grows a rider side.

| File | What was added |
|---|---|
| `scripts/seed.js` | `custody` on every trip; the rider fee ledger (`RIDER_LEDGER_ENTRIES`, `RIDER_LEDGER_BY_RIDER`, `recomputeRiderBalances`); `GLOBAL_POLICIES.riderFee` and `driverBalance.warningBandPct`/`coolingOffDays`; `nextSettlementReceipt()`; a 4th/5th settlement channel |
| `scripts/mock-api.js` | `listRiderBalances`, `getRiderLedger`, `postRiderAdjustment`, `listSettlements`; `getFinanceOptions` now also returns `riderFeePolicy`. The platform holds no payout destination and there is no waive — recording a payout or a rider fee is never gated on either. |
| `scripts/mutations.js` | a `riderLedgerAdded` patch collection, replayed onto the rider ledger the same way `ledgerAdded` replays onto the driver one |
| `scripts/nav.js` | `rider-balances` and `settlements` entries, in Money & config |
| `i18n/core.js`, `lists.js`, `config.js` | EN + AR strings (`riderBalances.*`, `settlements.*`, `nav.riderBalances`, `nav.settlements`, `screens.titleRiderBalances`/`titleSettlements`) |
| `scripts/screens.js`, `_verify.html` | designer index cards, verify manifest rows |

Two pre-existing bugs in this same file were also fixed while making this change,
because they are triggered by the pattern this work repeats:
`getFinanceOptions()` had no `?state=empty` handling (returned `null`, which crashes
any caller that dereferences it immediately — `rider-balances.js` does); and
`recordSettlement`/`postAdjustment` passed formatted strings as an audit entry's
`before`/`after` where `audit-log.js` requires plain objects (`key in before` throws
on a string), silently breaking the audit log for *any* settlement or driver
adjustment, not just the new rider ones.

Design: `docs/superpowers/specs/2026-09-08-financial-core-design.md`.

## Intentional divergence from `admin/` — financial core simplification (2026-09-13)

The spec above was rewritten on 2026-09-13 to cut three things deliberately, to keep
Phase 1 simple. `admin/` (v1) never had any of this, so there is nothing to cut there.

- **Driver-initiated payouts are gone.** There is no request, no approval queue, no
  reservation, no minimum/maximum, no cooling-off period, and no driver-facing request
  screen. `mock-api.js`'s `listWithdrawals`/`decideWithdrawal` and `driver/withdraw.html`
  are deleted. In their place, `mock-api.js` gained `recordPayout` — Finance has already
  sent the money, and this only writes it down, in the same place a settlement is
  recorded (`balances.html`). The `withdrawal` ledger entry type was renamed `payout`.
- **The settlement day book (`settlements.html`) is gone** — a report dressed as a
  screen. `mock-api.js`'s `listSettlements` (with its by-channel/by-admin totals) was
  replaced by a leaner `listSettlementEntries()` that feeds a CSV export button on
  `balances.html` instead — the one part of the day book worth keeping.
- **Post-adjustment is gone from both balance screens.** `mock-api.js`'s
  `postAdjustment` (driver) and `postRiderAdjustment` (rider) are deleted, along with
  the `adjustment` ledger entry type. **There is no waive either** — a rider's fee is
  only ever cleared by paying it, so `waiveRiderFee` and `rider-balances.html`'s waive
  action are gone too; the screen is read-only aside from the link into rider
  suspension. Neither ledger has **any correction mechanism** in Phase 1 (see the
  spec's own open item, §10).

`nav.js`, `screens.js`, `_verify.html` and every EN/AR i18n key that existed only for
the withdrawal queue, the day book or post-adjustment were removed with them.

## Intentional divergence from `admin/` — payouts, settlement import, maker-checker (2026-10-14)

Same rule, same deliberate exception. `admin/` (v1) has none of this.

| File | What was added |
|---|---|
| `scripts/finance-seed.js` (new) | Payout method per driver, paid markers on historical payable entries, `PAYOUT_BATCHES`, `SETTLEMENT_IMPORTS`, `APPROVALS`, the bank/wallet lists, a few due earnings so a demo batch has lines. Kept apart so `seed.js` is unchanged. |
| `scripts/mock-api.js` | Maker-checker (`listApprovals`, `getApproval`, `approveRequest`, `rejectRequest`, `pendingApprovalCount`, demo `setActingAdmin`), payout batches (`previewPayoutBatch`, `createPayoutBatch`, `exportPayoutBatch`, `importPayoutResult`, …), settlement import (`checkSettlementSheet`, `submitSettlementImport`, …), `requestFeeWaiver`, payout method (`getDriverPayout`, `requestPayoutMethodChange`). `recordSettlement`, `recordPayout`, `saveRateCard`, `removeRateCard` and the commission part of `savePolicies` now create a request instead of applying. |
| `scripts/mutations.js` | `approvals*`, `batches*`, `imports*`, `entryMeta` collections and `applyFinanceMutations` |
| `scripts/nav.js`, `components/ad-shell.js` | Approvals (with the `pendingApprovals` counter), Payouts, Settlement imports |
| `i18n/finance.js`, `approvals.js`, `payouts.js`, `settlement-imports.js`, `finance-edits.js`, `profile-pricing.js` | EN + AR, one area per screen group |
| New screens | `approvals.html`, `payouts.html`, `payout-batch.html`, `settlement-imports.html` |

The 2026-09-17 cuts above are partly reversed: payout details are collected, a single
rider fee can be waived (with the driver's share reversed), and payouts run in batches.
Ids (`APR-`, `IMP-`, `PB-`) are derived from the records that exist, so they stay unique
after a reload replays the session.

Spec: `docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md`.

## Port to kit v22-09 (2026-10-14)

admin-v2 now follows the designer's `SheDrive.AdminPanel_v22-09-2026` kit. The kit's
`styles.css` / `styles-ar.css` and its 15 new icons replace the v18-08 copies in `vendor/`
(additive — nothing was renamed or removed).

| Area | What changed |
|---|---|
| Lists (trips, drivers, riders, applications, SOS, safety) | Kit filter: placeholder controls, built-in Reset / Search, gradient Export; explicit Actions column (`gridAction()` in `ad-data-table`); Rows-count select in the footer (screens opt in via `pagesizechange`) |
| Detail screens (trip, SOS, safety report, application, driver, rider) | Kit card grid (`.row.g-3 > .col-lg-6.col-xl-4 > .standard-card-theme2`), actions in a bottom row, kit `default-modal` / `popup-*` dialogs |
| Balances | Ledgers moved to their own pages as in the kit: `driver-balance-details.html?id=` and `rider-balance-details.html?id=`; the lists link to them |
| Pricing, reports, reconciliation, admin users, audit log | Kit layouts; pricing policies has one global Save (commission still goes for approval); audit log modelled on the kit's `demo-snapshots/audit-log.html` |
| Our own screens (approvals, payouts, payout batch, settlement imports) | Not in the kit — built from its patterns so they read as part of it |
| Shell | Sidebar badge is the kit `.counter`; SOS uses `lifeboat.svg`; our six sidebar groups stay |

Component APIs are unchanged; additions: `ad-filter-bar` toolbar (`toolbar = {reset, search}`,
`no-reset` / `no-search`), `ad-data-table` `actions: true` column flag, `gridAction()` helper,
`pageSizeOptions` / `pagesizechange`. Several screens build kit `default-modal`s in their own
scripts because `ad-form-modal` only renders the centred `popup-*` shape.

Known gaps: SOS and safety-report lists have no search box (the mock API takes no search there);
`listAdmins` has no delete, so `admin-users.js` soft-deletes through `patch('admins', …)`.

## Approvals: one decision dialog, opened from the queue or in place (2026-10-22)

The maker-checker queue stays the one place that lists every request, but the
review → approve / reject dialog is now a shared module, `scripts/approval-review.js`
(styles: `styles/approval-review.css`), used in two ways:

| Where | How | After a decision |
|---|---|---|
| `approvals.html` | `createApprovalReview({ urlParam: 'id', returnTo })` | Toast and the queue reloads, or, with `&return=<screen>`, back to that screen with the toast held across the redirect |
| Driver balance, rider balance, driver profile, payout batch, pricing policies, pricing zones, settlement imports | `wireInPlaceApprovals({ onDecided })` — every `approvals.html?id=` link on the screen opens the dialog over the page | Toast and the screen's own reload |

Same rule ("never the admin who made it"), same audit entry, same reject reason on both
paths, since it is the same code. Links to a request are built with `approvalHref(id)`,
which adds `return=` for the current screen (used when the link is opened in a new tab);
`returnTarget()` accepts only another admin-v2 `*.html` page.

The queue gained two filters: **Made by** (anyone / other admins — mine to decide /
me — waiting for others) and **Area** (`APPROVAL_AREAS` in `finance-seed.js`: payouts &
settlements, rider fees, pricing, driver details). Area is the hook for scoping the
queue by role once Finance and Pricing approvers are split; today every admin sees all.
