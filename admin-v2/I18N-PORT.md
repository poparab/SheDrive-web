# admin-v2 — making the portal bilingual (Arabic / English)

The v1 portal was English-only. v2 is bilingual: **English (LTR, the default)** and
**Arabic (RTL)**, using the design kit's own `styles-ar.css` / `bootstrap.rtl` builds.

## Runtime

`scripts/admin-i18n.js`:

```js
import { t, lang, isRtl, setAdminLanguage, applyAdminTranslations } from './admin-i18n.js';
// from components/: '../scripts/admin-i18n.js'

t('drivers.title');                      // → "Drivers" | "السائقات"
t('table.showing', { first, last, total });
lang();      // 'en' | 'ar'
isRtl();     // true in Arabic
```

Two deliberate design decisions:

1. **Strings are synchronous.** Locales are ES modules (`i18n/*.js`), statically
   imported, so `t()` works from the first line of a module — grid columns, filter
   specs and modal specs are all built at import time and cannot await anything.
2. **Switching language reloads the page.** Those import-time specs would otherwise go
   stale. The choice is stored in `localStorage` under `shedrive.adminLang` first, so
   the reload comes back on the same URL, with the same record id and query string.
   `?lang=ar` / `?lang=en` on any URL pins a language for that visit.

The shell calls `initAdminI18n()` before it injects styles (direction must be on
`<html>` first) and `applyAdminTranslations()` after it renders.

## Locale files — one per area, to keep parallel work conflict-free

```
i18n/index.js       merges every area, one level deep, into STRINGS.{en,ar}
i18n/core.js        nav, shell, common, status, table, filters, state, units, aria
i18n/components.js  the shared ad-* components
i18n/lists.js       list screens
i18n/details.js     detail screens
i18n/config.js      dashboard, pricing, reports, reconciliation, profile, screen index
i18n/auth.js        sign-in and the standalone auth pages
```

Each file exports `en` and `ar` objects of namespaces. Namespaces merge across files,
so an area may extend a namespace another file started — just never restate a key
`core.js` already owns. **Add the English and Arabic string in the same edit.**

## Markup

Static text in HTML keeps its English text as the element's content (that is what shows
before scripts run, and English is the default) and gains a `data-i18n*` attribute:

| Attribute | Applies to |
|---|---|
| `data-i18n` | text content |
| `data-i18n-placeholder` | `placeholder` |
| `data-i18n-aria-label` | `aria-label` |
| `data-i18n-title` | `title` |
| `data-i18n-alt` | `alt` |
| `data-i18n-value` | `value` |

Never leave a hardcoded `aria-label` — pair it with `data-i18n-aria-label`.

`<ad-shell>` takes `page-title-key` and `breadcrumb-keys` (same `"a|href > b"` shape as
`breadcrumb`, but each label is a translation key). Prefer those over the literal
`page-title` / `breadcrumb`.

## Strings generated in JS

Anything a script builds — column labels, filter labels and options, empty-state copy,
modal titles and field labels, validation messages, toasts, CSV headers — goes through
`t()`. Import it at the top of the screen script.

## Arabic wording

The delivered kit ships Arabic pages (`*_ar.html`). **They are the client's own
terminology — mine them first** and only invent a term when the kit has none:

| English | Kit's Arabic |
|---|---|
| Drivers | السائقات |
| Riders | الراكبات |
| Driver applications | طلبات السائقات |
| Safety reports | تقارير السلامة |
| Pricing & zones | الأسعار والمناطق |
| Global policies | السياسات العالمية |
| Reconciliation | المصالحات |
| Audit log | سجل التدقيق |
| Admin users | مديرو النظام |
| Approved / Suspended | مقبول / موقوف |
| Reset / Search | إعادة تعيين / بحث |
| Submission date | تاريخ التقديم |

Extract them with:

```bash
awk '/InstanceBeginEditable name="content"/,/InstanceEndEditable/' \
  SheDrive.AdminPanel_v18-08-2026/<screen>_ar.html | sed 's/<[^>]*>/|/g' | tr '|' '\n'
```

Write Modern Standard Arabic, in the register Egyptian ops staff read in a back-office
tool. Female forms for drivers and riders (the service is women-only). Keep product
names, emails, plate numbers and ids in Latin.

## Numbers, dates, direction

`scripts/format.js` is already bilingual: Arabic month names, Arabic unit suffixes, and
**Latin digits in both languages** (ops staff cross-reference ids and fares against other
systems all day). Do not add a second date formatter.

RTL is handled by `styles/admin-rtl.css`, loaded only in Arabic. Everything the portal
writes uses **logical properties** (`padding-inline`, `border-block-end`, `text-align:
start|end`) — never `left` / `right`. If a Latin run must not be re-ordered by the bidi
algorithm inside Arabic text, put `.ad-ltr` on it.

## Status

Every screen in `admin-v2/` is bilingual: 24 screen URLs plus the five detail screens,
in both languages, pass the `_verify.html` smoke test (58 checks: DOM markers, kit
chrome, `dir` matching the language, Arabic coverage of the content region, and no
horizontal overflow).

| Area | Locale file | Wired |
|---|---|---|
| Shell, nav, statuses, grid chrome, units | `i18n/core.js` | `ad-shell`, `nav.js`, `format.js` |
| Shared components | `i18n/components.js` | all 11 `ad-*` components |
| List screens | `i18n/lists.js` | trips, applications, drivers, riders, safety, audit log, admin users |
| Detail screens | `i18n/details.js` | trip detail, application, driver profile, rider profile, safety report |
| Dashboard / money / config / index | `i18n/config.js` | dashboard, zones, policies, reports, reconciliation, profile, screen index |
| Authentication | `i18n/auth.js` | sign-in (5 steps) and the six standalone kit pages |

Language switches: the topbar dropdown on every shell screen, a button pair on the
screen index and on the auth screens. `?lang=ar` / `?lang=en` pins a language for a
link; otherwise the choice is remembered in `localStorage` under `shedrive.adminLang`.

### Known gaps

- **Mock data stays in Latin.** Zone names ("Maadi & Kornish"), driver and rider names,
  emails, plate numbers and ids come from `scripts/seed.js`, which is the frozen data
  layer shared with `admin/`. In Arabic the chrome is Arabic and the records read in
  Latin — the same thing happens in the kit's own Arabic pages for Latin names. If the
  client wants Arabic seed data, that is a change to the seed, not to the i18n layer.
- `humanize()` in `format.js` still title-cases an unknown snake_case value in both
  languages; every value the screens actually show goes through `status.*` instead.
- The kit's own `*_ar.html` pages are the terminology source, but the portal has screens
  the kit never drew (reports, reconciliation, audit log, admin users, admin profile).
  Their Arabic is ours, in the same register — worth a native review pass before the
  client sees it.
