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
| Modal | Bootstrap 5 modal with `.modal.fade.popup-warning` / `.popup-success` |
| Buttons | `.btn` + `.btn-primary`, `-secondary`, `-tertiary`, `-success`, `-warning`, `-danger`, `-info`, `-light`, `-white`, each with `-outline`, `-rounded`, `-rounded-outline`; sizes `.btn-x-xs .btn-x-sm .btn-x-md .btn-x-lg`; `.btn-back.btn-back-outline` (round), `.btn-primary-gradient`, `.btn-submit` |
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
`.badge--brand|success|warning|danger|info`, `.toast*`, `.spinner`.
Keep emitting them where a screen already does; prefer kit classes for anything new.

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
