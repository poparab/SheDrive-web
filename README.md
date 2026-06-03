# SheDrive Web

A women-only ride-hailing platform for Cairo and Giza, Egypt. This repository contains the
front-end scaffold for two separate web applications — **Rider** and **Driver** — built in
vanilla HTML/CSS/ES-module JavaScript with Mapbox GL JS, a bilingual (Arabic/English) design
system, and full RTL support.

---

## Project Structure

```
shedrive-web/
├── shared/
│   ├── assets/
│   │   ├── logos/          # SVG logo files (icon, wordmark, full lockup)
│   │   └── icons/          # Placeholder for future icon set
│   ├── styles/
│   │   ├── tokens.css      # Design tokens — single source of truth for colors, spacing, type
│   │   ├── reset.css       # Minimal modern CSS reset
│   │   ├── base.css        # html/body, links, headings, focus rings, layout defaults
│   │   ├── components.css  # Reusable UI: .btn, .input, .card, .modal, .toast, .badge
│   │   ├── utilities.css   # Utility classes: .u-flex, .u-hidden, gap helpers, etc.
│   │   └── rtl.css         # RTL-specific overrides, loaded when [dir="rtl"]
│   ├── scripts/
│   │   ├── config.js       # MAPBOX_TOKEN, API_BASE_URL, map defaults
│   │   ├── map.js          # MapService — init, addMarker, flyTo, getUserLocation
│   │   ├── auth.js         # Mock login/logout/session (localStorage-backed)
│   │   ├── api.js          # Fetch wrapper with base URL, JSON, typed error handling
│   │   ├── i18n.js         # translate(), setLanguage(), applyDirection()
│   │   ├── storage.js      # Safe localStorage wrapper (handles Safari private mode)
│   │   └── utils.js        # qs, qsa, formatPhoneEg, debounce, etc.
│   └── i18n/
│       ├── en.json         # English strings
│       └── ar.json         # Arabic strings
├── rider/
│   ├── index.html          # Rider login page
│   ├── home.html           # Rider map home (full-screen map + ride request)
│   ├── styles/rider.css    # Rider-specific layout (tokens only, no hardcoded values)
│   └── scripts/
│       ├── login.js        # Login flow: phone + OTP, language switch, redirect
│       └── home.js         # Map init, location marker, bottom sheet, auth guard
└── driver/
    ├── index.html          # Driver login page
    ├── home.html           # Driver map home (online/offline toggle, earnings)
    ├── styles/driver.css   # Driver-specific layout
    └── scripts/
        ├── login.js
        └── home.js
```

---

## Getting Started

No build step required. Serve any directory with a static file server:

```bash
cd shedrive-web
python3 -m http.server 8000
```

Then open:

- **Rider app:** http://localhost:8000/rider/
- **Driver app:** http://localhost:8000/driver/

## Cloudflare Pages

This repository is deployable on Cloudflare Pages as a static site.

- The repository root is the Pages output directory.
- `wrangler.toml` sets `pages_build_output_dir = "."` so Pages deploys the full site, not only `rider/` or `driver/`.
- The root URL redirects to `/rider/` via `index.html`.

If your deployment renders HTML with no styles, the usual cause is publishing only one app folder instead of the full repository root. Redeploy from the repository root so `shared/`, `rider/`, and `driver/` are all present.

**Rider clickable flow** (5 screens):
`rider/index.html` (Splash + Login) → `rider/home.html` (Book a Ride) → `rider/matching.html` (Finding a Driver) → `rider/active-trip.html` (Live Trip + SOS)

> On Windows you can also use `npx serve .` or the VS Code Live Server extension.

---

## Mapbox Setup

The map will not render until you store a valid Mapbox public token locally:

1. Sign up at [mapbox.com](https://www.mapbox.com) → go to **Account → Tokens**
2. Copy your **public token** (starts with `pk.`)
3. In the browser console on a local SheDrive page, run:

```js
localStorage.setItem('shedrive.mapboxToken', 'pk.YOUR_PUBLIC_TOKEN');
location.reload();
```

4. To remove it later, run `localStorage.removeItem('shedrive.mapboxToken')`.

Keep real tokens out of git. `shared/scripts/config.js` now only defines the local storage key and shared map settings.

---

## Design Tokens

All design decisions live in [`shared/styles/tokens.css`](shared/styles/tokens.css) as CSS
custom properties on `:root`. The primary brand gradient is
`linear-gradient(135deg, #6B2BD9 0%, #D63AE2 100%)`.

**No component or page file may hardcode a color, font-size, spacing value, radius, or shadow.**
Every value must reference a token (e.g., `var(--color-primary-600)`, `var(--space-4)`).

---

## Internationalization

- Default language is **Arabic (ar)** with RTL layout.
- Toggle language via the `AR | EN` switcher on the login page; preference is persisted in
  `localStorage` under the key `shedrive.lang`.
- All directional CSS uses **logical properties** (`margin-inline-start`, `padding-inline-end`,
  `inset-inline-start`) — never `margin-left` / `margin-right`.
- `rtl.css` is loaded via a `<link id="rtl-stylesheet">` tag that `i18n.js` enables/disables
  dynamically.

---

## Coding Standards

1. Zero inline `style=""` or `<script>` blocks. All CSS in `.css` files, all JS in `.js` files.
2. ES modules everywhere — every `<script>` is `type="module" defer`.
3. Semantic HTML — `<header>`, `<main>`, `<nav>`, `<button>`, `<label for>`, `aria-label`.
4. WCAG 2.1 AA — visible focus rings, ≥4.5:1 contrast, 44×44px tap targets.
5. Mobile-first — base styles for mobile, `@media (min-width: 768px)` / `1024px` for larger.
6. Kebab-case files and classes; light BEM for components (`.card`, `.card__header`).
7. Every JS/CSS file starts with a 2–4 line header comment describing its purpose.
8. No magic numbers — every value from a CSS custom property.
9. Single config source — `config.js` only.
10. All `fetch` calls have try/catch; all `localStorage` access is wrapped (Safari private mode).
11. No third-party JS beyond Mapbox GL JS and Google Fonts.
12. Zero install required — open in browser or use any static server.

---

## Roadmap

This is the front-end scaffold for the **SheDrive MVP** as specified in BRD v1.2.

Future milestones:
- [ ] Migrate to **Vite** build pipeline (the token/component system is framework-agnostic)
- [ ] Adopt **Vue 3** or **React 18** — components map 1:1 to `.css` BEM blocks
- [ ] Connect to real backend API (replace `auth.js` mocks, wire `api.js` base URL)
- [ ] Integrate Mapbox Directions API for route drawing
- [ ] Push notifications via web-push / FCM
- [ ] Driver earnings and trip history screens
