/**
 * navigation.js — SheDrive in-app back navigation
 *
 * A bare history.back() does nothing when a screen was opened directly: an ADO
 * preview link, a new tab, a reload. A hard-coded href goes to the same parent
 * wherever she came from (Safety opened from a live trip dropped her on Home),
 * and it pushes a new history entry each time, so the system back button then
 * walks her in circles.
 *
 * Every back control is marked `data-back` instead. Its value (or the href of a
 * link) is the screen's logical parent. goBack() pops history when the previous
 * entry is a screen of this same app, and otherwise replaces the current entry
 * with that parent. sd-page wires the click handling on every screen.
 *
 *   <a href="./home.html" class="btn btn--icon" data-back>…</a>
 *   <sd-button icon data-back="./home.html">…</sd-button>
 */

/** True when the previous history entry is another screen of this app (rider/ or driver/). */
export function cameFromApp() {
  if (history.length < 2 || !document.referrer) return false;

  try {
    const from = new URL(document.referrer);
    const appDir = location.pathname.replace(/[^/]*$/, '');
    return (
      from.origin === location.origin &&
      from.pathname.startsWith(appDir) &&
      from.pathname !== location.pathname
    );
  } catch {
    return false;
  }
}

/** Go back to where she came from inside the app, or to `fallback` when there is nowhere to go back to. */
export function goBack(fallback = './home.html') {
  if (cameFromApp()) {
    history.back();
    return;
  }
  window.location.replace(new URL(fallback, window.location.href).toString());
}

let wired = false;

/** Route clicks on every `[data-back]` control through goBack(). Idempotent. */
export function wireBackControls() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-back]');
    if (!control || control.matches(':disabled') || control.querySelector(':scope > :disabled')) return;

    event.preventDefault();
    goBack(control.getAttribute('data-back') || control.getAttribute('href') || undefined);
  });
}
