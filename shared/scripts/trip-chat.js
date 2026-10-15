/**
 * trip-chat.js — the trip chat screen, and its entry points on the trip screens.
 *
 * Both apps render the same screen; each app's chat.js only calls mountChat(role).
 * The trip screens call wireChatEntry(role, getState) for the Message button, its
 * unread badge and the push shown when a message arrives outside the chat.
 *
 * Rules (the store holds the data rules, see trip-chat-store.js):
 *   - Open from the driver accepting until the trip ends. `?state=ended` shows the
 *     closed chat: read-only, no composer.
 *   - The driver sends quick replies only while the trip is under way (in-ride),
 *     so she never types while driving.
 *   - A message she sends that contained a phone number goes out with it hidden.
 *
 * Previews: ?state=<trip state>|ended  ?thread=sample  ?offline=1  ?mock=off
 *           trip screens: ?push=chat (a message has just arrived)
 */

import { translate, getLanguage, I18N_EVENT } from './i18n.js';
import { qs, qsa } from './utils.js';
import {
  CHAT_EVENT, MAX_LENGTH, QUICK_REPLIES, peerOf,
  getMessages, markRead, unreadCount, send, retry, receive, seedSample, setPeerPhase,
} from './trip-chat-store.js';

const params = new URLSearchParams(location.search);

/** Trip phase from the trip state: 'pickup' until she is in the car, then 'ride'. */
function phaseOf(role, state) {
  return (role === 'rider' ? state === 'started' : state === 'in-ride') ? 'ride' : 'pickup';
}

const isEn = () => (getLanguage?.() || document.documentElement.lang) === 'en';

/** The other person on this trip, in the current language (demo names match the trip screens). */
function peerName(role) {
  let person = {};
  try {
    person = role === 'rider'
      ? JSON.parse(sessionStorage.getItem('shedrive.activeTrip') || '{}').driver || {}
      : JSON.parse(sessionStorage.getItem('shedrive.activeDriverTrip') || '{}').rider || {};
  } catch {
    /* demo names below */
  }
  const demo = role === 'rider' ? { name: 'نورا أحمد', nameEn: 'Nora Ahmed' } : { name: 'نور', nameEn: 'Nour' };
  const name = person.name ? person : demo;
  return (isEn() ? name.nameEn : name.name) || name.name;
}

/** What a message says, in the reader's language. */
export function messageText(msg) {
  if (msg.kind === 'quick') return translate(`chat.quick.${msg.key}`);
  if (msg.text && typeof msg.text === 'object') return isEn() ? msg.text.en : msg.text.ar;
  return msg.text || '';
}

function formatTime(ts) {
  // Latin digits in both languages, like every other time in the app.
  const lang = isEn() ? 'en-GB' : 'ar-EG-u-nu-latn';
  return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(ts);
}

/* ── Chat screen ────────────────────────────────────────────────────────── */

export function mountChat(role) {
  const state = params.get('state') || '';
  const ended = state === 'ended';
  const phase = phaseOf(role, state);
  const quickOnly = role === 'driver' && phase === 'ride';
  const offline = params.get('offline') === '1';

  if (params.get('thread') === 'sample') seedSample();
  setPeerPhase(phase);

  // Back returns to the trip screen in the same state; once the trip is over, home.
  const back = qs('#back-btn');
  const tripPage = role === 'rider' ? './active-trip.html' : './trip.html';
  if (back) back.setAttribute('data-back', ended ? './home.html' : state ? `${tripPage}?state=${state}` : tripPage);

  const thread = qs('#chat-thread');
  const empty = qs('#chat-empty');
  const quick = qs('#chat-quick');
  const form = qs('#chat-composer');
  const input = qs('#chat-input');
  const sendBtn = qs('#chat-send');
  const count = qs('#chat-count');
  const scroller = document.querySelector('sd-page');

  document.body.dataset.chat = ended ? 'ended' : quickOnly ? 'quick-only' : 'open';

  function renderPeer() {
    const name = peerName(role);
    const nameEl = qs('#chat-peer-name');
    if (nameEl) nameEl.textContent = name;
    const avatar = qs('#chat-peer-avatar');
    if (avatar) avatar.textContent = name.trim().charAt(0) || avatar.textContent;
  }

  function renderQuick() {
    if (!quick) return;
    quick.replaceChildren(...QUICK_REPLIES[role][phase].map((key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--outline chat-quick__chip';
      chip.dataset.quick = key;
      chip.textContent = translate(`chat.quick.${key}`);
      return chip;
    }));
  }

  function statusLine(msg, isLastOwn) {
    if (msg.status === 'failed') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-msg__retry';
      btn.dataset.retry = msg.id;
      btn.textContent = translate('chat.status.failed');
      return btn;
    }
    if (!isLastOwn) return null;
    const span = document.createElement('span');
    span.className = 'chat-msg__status';
    const key = msg.status === 'sending' ? 'chat.status.sending' : msg.seen ? 'chat.status.seen' : 'chat.status.sent';
    span.textContent = translate(key);
    return span;
  }

  function renderThread() {
    // The other phone only ever delivers what it managed to send.
    const messages = getMessages().filter((m) => m.from === role || m.status === 'sent');
    if (empty) empty.hidden = messages.length > 0;
    if (!thread) return;

    const lastOwn = [...messages].reverse().find((m) => m.from === role && m.status !== 'failed');
    thread.replaceChildren(...messages.map((msg) => {
      const own = msg.from === role;
      const li = document.createElement('li');
      li.className = `chat-msg ${own ? 'chat-msg--own' : 'chat-msg--peer'}${msg.kind === 'quick' ? ' chat-msg--quick' : ''}`;
      if (msg.status === 'failed') li.classList.add('chat-msg--failed');

      const bubble = document.createElement('p');
      bubble.className = 'chat-msg__bubble';
      bubble.dir = 'auto';
      bubble.textContent = messageText(msg);
      li.append(bubble);

      const meta = document.createElement('p');
      meta.className = 'chat-msg__meta';
      const time = document.createElement('time');
      time.dateTime = new Date(msg.at).toISOString();
      time.textContent = formatTime(msg.at);
      meta.append(time);
      const status = own ? statusLine(msg, msg === lastOwn) : null;
      if (status) meta.append(status);
      li.append(meta);

      if (own && msg.masked) {
        const note = document.createElement('p');
        note.className = 'chat-msg__note';
        note.textContent = translate('chat.numberHidden');
        li.append(note);
      }
      return li;
    }));
  }

  function scrollToEnd() {
    requestAnimationFrame(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
  }

  function render() {
    renderPeer();
    renderQuick();
    renderThread();
  }

  // ── Composer ──
  function syncComposer() {
    if (!input) return;
    const len = input.value.length;
    if (sendBtn) sendBtn.disabled = input.value.trim().length === 0;
    if (count) {
      count.hidden = len < MAX_LENGTH - 50;
      count.textContent = `${len}/${MAX_LENGTH}`;
    }
    input.style.blockSize = 'auto';
    input.style.blockSize = `${input.scrollHeight}px`;
  }

  input?.setAttribute('maxlength', String(MAX_LENGTH));
  input?.addEventListener('input', syncComposer);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form?.requestSubmit();
    }
  });

  function sendAndToast(payload) {
    const msg = send(role, payload, { offline: offline || navigator.onLine === false });
    if (msg.masked) showToast(translate('chat.numberHiddenToast'));
    scrollToEnd();
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (ended || quickOnly || !input || !input.value.trim()) return;
    sendAndToast({ text: input.value });
    input.value = '';
    syncComposer();
    input.focus();
  });

  quick?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-quick]');
    if (!chip || ended) return;
    sendAndToast({ key: chip.dataset.quick });
  });

  thread?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-retry]');
    if (btn) retry(btn.dataset.retry);
  });

  // ── Live updates: whatever arrives while the chat is open is read at once ──
  document.addEventListener(CHAT_EVENT, () => {
    if (!ended && unreadCount(role) > 0) { markRead(role); return; }
    const atEnd = scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    renderThread();
    if (atEnd) scrollToEnd();
  });
  document.addEventListener(I18N_EVENT, render);

  render();
  syncComposer();
  if (!ended) markRead(role);
  scrollToEnd();
}

/* ── Trip screens: Message button, badge, push ──────────────────────────── */

/**
 * Wire every `[data-chat-link]` control on a trip screen. `getState()` returns the
 * current trip state so the chat opens in step with the trip. Each control may hold
 * a `.chat-badge` for the unread count.
 */
export function wireChatEntry(role, getState) {
  const peer = peerOf(role);
  const href = () => {
    const state = getState?.();
    return state ? `./chat.html?state=${encodeURIComponent(state)}` : './chat.html';
  };

  qsa('[data-chat-link]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.assign(href());
    })
  );

  const syncBadges = () => {
    const n = unreadCount(role);
    qsa('[data-chat-link] .chat-badge').forEach((b) => {
      b.textContent = n > 9 ? '9+' : String(n);
      b.hidden = n === 0;
    });
  };

  // A message from the other side while she is not in the chat → push.
  let lastPeerId = getMessages().filter((m) => m.from === peer).at(-1)?.id;
  document.addEventListener(CHAT_EVENT, () => {
    syncBadges();
    const latest = getMessages().filter((m) => m.from === peer).at(-1);
    if (latest && latest.id !== lastPeerId) {
      lastPeerId = latest.id;
      showChatPush(role, latest, href());
    }
  });
  document.addEventListener(I18N_EVENT, syncBadges);
  syncBadges();

  // Demo: the other side writes first a few seconds in, once per trip.
  // ?push=chat shows it straight away (design-story link for the push).
  const mockOn = params.get('mock') !== 'off';
  const phase = phaseOf(role, getState?.());
  const firstKey = role === 'rider' ? (phase === 'ride' ? 'almostThere' : 'onMyWay') : (phase === 'ride' ? 'thanks' : 'comingNow');
  if (params.get('push') === 'chat') {
    receive(peer, { key: firstKey });
  } else if (mockOn && getMessages().length === 0) {
    setTimeout(() => { if (getMessages().length === 0) receive(peer, { key: firstKey }); }, 6000);
  }
}

/**
 * The push for a new chat message: the sender's name and the message itself (phone
 * numbers already hidden). When the app is closed this is the system notification;
 * while she is on another screen of the app it drops in as a banner. Tapping it
 * opens the chat. A newer message replaces the one on screen.
 */
export function showChatPush(role, msg, href) {
  document.querySelector('.chat-push')?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'chat-push';
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-live', 'polite');

  const card = document.createElement('a');
  card.className = 'chat-push__card';
  card.href = href;

  const app = document.createElement('span');
  app.className = 'chat-push__app';
  const icon = document.createElement('img');
  icon.src = '../shared/assets/logos/shedrive-icon.svg';
  icon.alt = '';
  icon.className = 'chat-push__icon';
  const appName = document.createElement('span');
  appName.textContent = translate('chat.push.app');
  const when = document.createElement('span');
  when.className = 'chat-push__when';
  when.textContent = translate('chat.push.now');
  app.append(icon, appName, when);

  const title = document.createElement('strong');
  title.className = 'chat-push__title';
  title.textContent = peerName(role);

  const body = document.createElement('span');
  body.className = 'chat-push__body';
  body.dir = 'auto';
  body.textContent = messageText(msg);

  card.append(app, title, body);

  const more = unreadCount(role) - 1;
  if (more > 0) {
    const extra = document.createElement('span');
    extra.className = 'chat-push__more';
    extra.textContent = translate('chat.push.more', { count: String(more) });
    card.append(extra);
  }

  wrap.append(card);
  document.body.append(wrap); // fixed layers live on the body, outside the scroller
  // ?push=chat keeps it on screen for the design review.
  if (params.get('push') !== 'chat') setTimeout(() => wrap.remove(), 6000);
}

function showToast(message) {
  const host = document.querySelector('sd-toast-host');
  if (host?.showToast) host.showToast(message, 'info');
}
