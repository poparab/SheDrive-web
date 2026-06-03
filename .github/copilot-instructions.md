# SheDrive Web Project Instructions

## Project Context

SheDrive is a safety-first ride-hailing web prototype for women riders in Cairo and Giza. The app is a static front-end only: vanilla HTML, CSS, and ES modules with no build step, bundler, framework, TypeScript, Node.js, or npm workflow.

Work from `shedrive-web/`. Serve locally on Windows with:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/rider/` for the rider app and `http://localhost:8000/driver/` for the driver app.

## Architecture

- `rider/` contains rider screens, screen-specific scripts, and screen-specific styles.
- `driver/` contains driver screens, screen-specific scripts, and driver styles.
- `shared/scripts/` contains reusable modules: `auth.js`, `i18n.js`, `map.js`, `storage.js`, `drawer.js`, `api.js`, `utils.js`, and `config.js`.
- `shared/styles/` contains the design system: `tokens.css`, `reset.css`, `base.css`, `components.css`, `utilities.css`, `drawer.css`, and `rtl.css`.
- `shared/i18n/ar.json` and `shared/i18n/en.json` are the only translation sources.
- `shared/scripts/config.js` is the only place for the Mapbox token and shared configuration.

Rider flow:

```text
rider/index.html -> rider/home.html -> rider/matching.html -> rider/active-trip.html -> rider/trip-complete.html
                                               active-trip SOS -> rider/emergency.html -> active-trip
```

## File Ownership

For each new rider screen, create exactly these three files:

```text
rider/<screen>.html
rider/scripts/<screen>.js
rider/styles/<screen>.css
```

For driver screens, keep the same separation under `driver/`. Put truly reusable behavior or styles in `shared/`; do not put screen-specific logic in shared files.

## HTML Conventions

- Use semantic HTML and accessible controls.
- Keep CSS in `.css` files and JS in `.js` files. Do not add inline `style` attributes or inline `<script>` blocks.
- Every page script must be loaded as `<script type="module" src="..." defer></script>`.
- Load rider page CSS in this order: `tokens.css`, `reset.css`, `base.css`, `components.css`, `utilities.css`, `rider.css`, optional shared CSS such as `drawer.css`, then the screen CSS, then `rtl.css` with `id="rtl-stylesheet"`.
- Use Mapbox GL JS from the CDN when a map is needed. Do not add another map library.

## CSS And Design System

- New CSS must use design tokens from `shared/styles/tokens.css` via `var(--token-name)` for colors, spacing, type, radius, shadows, z-index, and transitions.
- Do not hardcode hex colors, pixel sizes, font names, or arbitrary magic numbers in screen CSS.
- Reuse existing components before creating new ones: `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--danger`, `.btn--icon`, `.btn--full`, `.btn--sm`, `.btn--lg`, `.input`, `.field`, `.spinner`, `.toast`, `.toast--success`, and `.toast--danger`.
- Prefer logical CSS properties such as `margin-inline-start`, `padding-inline-end`, and `inset-inline-start`; avoid left/right-specific layout unless unavoidable.
- Keep mobile-first responsive CSS, then add `@media (min-width: ...)` enhancements using tokenized values.

## Internationalization

Every user-visible string must flow through a `data-i18n*` attribute.

- Use `data-i18n="key"` for text content.
- Use `data-i18n-placeholder="key"` for input placeholders.
- Use `data-i18n-aria-label="key"` for `aria-label` values.
- Use `data-i18n-value="key"` for readonly input values.
- Always include Arabic fallback text directly in the HTML element.
- Add every new key to both `shared/i18n/ar.json` and `shared/i18n/en.json` in the same change.
- Do not mix Arabic and English in a single text node.
- Do not hardcode `aria-label`; pair it with `data-i18n-aria-label`.
- Use the existing key namespaces: `login.*`, `home.*`, `verify.*`, `matching.*`, `trip.*`, `emergency.*`, `complete.*`, `menu.*`, `aria.*`, `nav.*`, `common.*`, and `splash.*`.

## JavaScript Conventions

- Use plain ES modules only. No TypeScript and no bundler-specific syntax.
- Use shared utilities before writing equivalents:
  - `auth` from `../../shared/scripts/auth.js`
  - `initI18n`, `setLanguage`, `translate`, `t` from `../../shared/scripts/i18n.js`
  - `MapService` from `../../shared/scripts/map.js`
  - `storage` from `../../shared/scripts/storage.js`
  - `qs`, `qsa` from `../../shared/scripts/utils.js`
  - `Drawer` from `../../shared/scripts/drawer.js`
- Rider pages that require login should call `auth.requireAuth()` before page logic.
- Call `await initI18n()` once near the top of each page script before dynamic UI text is rendered.
- Wire `[data-lang-btn]` buttons through `setLanguage(btn.getAttribute('data-lang-btn'))`.
- Keep `localStorage` access behind `storage`; use `sessionStorage` only for the existing trip handoff flags.
- Wrap network calls in `try/catch` and use `shared/scripts/api.js` for shared API access.

## Storage Keys

Use the existing keys and shapes:

- `shedrive.session` in `localStorage`: `{ role, phone, loginAt }`
- `shedrive.lang` in `localStorage`: `'ar'` or `'en'`
- `shedrive.pendingTrip` in `sessionStorage`: `{ pickup, destination }`
- `shedrive.activeTrip` in `sessionStorage`: `{ driver, trip }`
- `shedrive.completedRating` in `sessionStorage`: `'1'`

## Formatting

- Follow `.editorconfig`: UTF-8, LF, 2-space indentation, trim trailing whitespace, final newline.
- Follow `.prettierrc`: semicolons, single quotes, `printWidth` 100, trailing commas.
- Use kebab-case for file names and CSS classes. Use light BEM for component-like classes.
- Keep JS/CSS header comments short and consistent with existing files.

## Validation

Before finishing UI work, serve the app with `py -m http.server 8000` from `shedrive-web/` and verify the affected route in the browser when possible. Check both Arabic/RTL and English/LTR behavior for any changed user-facing UI.