/**
 * splash.js — Auto-dismiss splash overlay after 1200ms or on tap/click
 */

const overlay = document.getElementById('splash-overlay');
if (!overlay) throw new Error('No #splash-overlay');

function dismiss() {
  overlay.classList.add('is-hidden');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

setTimeout(dismiss, 1200);
overlay.addEventListener('click', dismiss, { once: true });
