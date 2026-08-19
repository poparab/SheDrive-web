/**
 * design-init.js — SheDrive admin portal (v2) design-kit chrome
 * Boots the third-party pieces the delivered design kit depends on and wires
 * the small behaviours its static pages implement with inline <script> blocks:
 *
 *   • Bootstrap 5 bundle  — dropdowns, modals, offcanvas
 *   • jQuery + Magnific Popup — the `.photo-trigger` document lightbox
 *   • sidebar collapse (#sidebarCollapse / #dismiss / .overlay)
 *   • show / hide password eyes (any `.show-hide-icon` inside an `.input-group`)
 *
 * Everything is idempotent and delegated, so screens that render markup after
 * load (every list and detail screen does) keep working without re-binding.
 */

const MODULE_URL = import.meta.url;

const SCRIPTS = {
  bootstrap: '../vendor/js/bootstrap/bootstrap.bundle.min.js',
  jquery: '../vendor/js/jquery-4.0.0.min.js',
  magnific: '../vendor/js/lightbox/jquery.magnific-popup.min.js',
};

const loaded = new Map();

function loadScript(path) {
  const src = new URL(path, MODULE_URL).toString();
  if (loaded.has(src)) return loaded.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
  loaded.set(src, promise);
  return promise;
}

/** Bootstrap's JS bundle — needed before any modal or dropdown is used. */
export function loadBootstrap() {
  return loadScript(SCRIPTS.bootstrap);
}

/** jQuery + Magnific Popup, in order. */
export async function loadLightbox() {
  await loadScript(SCRIPTS.jquery);
  await loadScript(SCRIPTS.magnific);
}

/**
 * Bind the document lightbox to every `.photo-trigger` currently in the page.
 * Safe to call repeatedly — Magnific ignores elements it already owns, and we
 * tag the ones we have bound.
 */
export async function bindLightbox(root = document) {
  await loadLightbox();
  const jq = window.jQuery;
  if (!jq?.fn?.magnificPopup) return;

  const targets = Array.from(root.querySelectorAll('.photo-trigger')).filter(
    (node) => node.dataset.mfpBound !== 'true',
  );
  if (!targets.length) return;
  targets.forEach((node) => {
    node.dataset.mfpBound = 'true';
  });

  jq(targets).magnificPopup({
    type: 'image',
    closeOnContentClick: true,
    mainClass: 'mfp-img-mobile',
    gallery: { enabled: true, navigateByImgClick: true, preload: [0, 1] },
    image: {
      verticalFit: true,
      titleSrc: (item) => item.el.attr('title') ?? '',
    },
  });
}

/** Collapse / expand the side navigation, exactly as the kit's pages do. */
function initSidebar() {
  if (document.body.dataset.adv2Sidebar === 'true') return;
  document.body.dataset.adv2Sidebar = 'true';

  document.addEventListener('click', (event) => {
    const collapse = event.target.closest('#sidebarCollapse');
    if (collapse) {
      document.getElementById('sidebar')?.classList.toggle('active');
      document.getElementById('content')?.classList.toggle('active');
      document.querySelector('.overlay')?.classList.toggle('active');
      return;
    }

    if (event.target.closest('#dismiss') || event.target.closest('.overlay')) {
      document.getElementById('sidebar')?.classList.add('active');
      document.getElementById('content')?.classList.add('active');
      document.querySelector('.overlay')?.classList.remove('active');
    }
  });
}

/** Password reveal eyes — delegated so dynamically added fields work too. */
function initPasswordEyes() {
  if (document.body.dataset.adv2Eyes === 'true') return;
  document.body.dataset.adv2Eyes = 'true';

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.show-hide-icon');
    if (!button) return;
    event.preventDefault();

    const group = button.closest('.input-group');
    const input = group?.querySelector('input[type="password"], input[type="text"].password');
    if (!input) return;

    const reveal = input.getAttribute('type') === 'password';
    input.setAttribute('type', reveal ? 'text' : 'password');

    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-eye', !reveal);
      icon.classList.toggle('fa-eye-slash', reveal);
    }
    button.setAttribute('aria-pressed', String(reveal));
  });
}

/**
 * Six-box OTP inputs: auto-advance, backspace-to-previous, and paste-to-fill.
 * Used by the 2FA, enrolment and email-OTP screens.
 */
export function initOtpInputs(container = document) {
  const inputs = Array.from(container.querySelectorAll('.otp-input'));
  if (!inputs.length) return;

  inputs.forEach((input, index) => {
    if (input.dataset.otpBound === 'true') return;
    input.dataset.otpBound = 'true';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', index === 0 ? 'one-time-code' : 'off');

    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && inputs[index + 1]) inputs[index + 1].focus();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && inputs[index - 1]) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (event) => {
      const text = (event.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '');
      if (!text) return;
      event.preventDefault();
      inputs.slice(index).forEach((box, offset) => {
        box.value = text[offset] ?? box.value;
      });
      inputs[Math.min(index + text.length, inputs.length - 1)].focus();
    });
  });
}

/** Read the six OTP boxes as one string. */
export function readOtp(container = document) {
  return Array.from(container.querySelectorAll('.otp-input'))
    .map((input) => input.value.trim())
    .join('');
}

/** Boot the design-kit chrome. Idempotent; call once per page. */
export function initDesignChrome({ lightbox = true } = {}) {
  initSidebar();
  initPasswordEyes();
  loadBootstrap();
  if (lightbox) bindLightbox();
}
