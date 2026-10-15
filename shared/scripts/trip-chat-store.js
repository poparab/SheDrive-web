/**
 * trip-chat-store.js — the rider ↔ driver trip chat, shared by both apps.
 *
 * One conversation per trip, between the rider and her assigned driver only. It
 * opens when the driver accepts and closes when the trip ends or is cancelled;
 * nothing is kept after that, so there is no chat history anywhere.
 *
 * A message is free text (up to MAX_LENGTH characters) or a quick reply. A quick
 * reply is stored as its key, so each side reads it in her own language; free text
 * is shown as written. Phone numbers are hidden before a message leaves the phone.
 *
 * `from` is 'rider' or 'driver', so one store serves both apps and both see the
 * same thread. The mock peer below stands in for the other phone.
 *
 * Storage (sessionStorage):
 *   shedrive.tripChat   {messages: [Message], read: {rider: ts, driver: ts}}
 *   Message             {id, from, at, kind: 'text'|'quick', text?, key?, masked?,
 *                        status: 'sending'|'sent'|'failed', seen?}
 */

const KEY = 'shedrive.tripChat';

export const MAX_LENGTH = 300;

/** Quick replies per role and trip phase ('pickup' until she is in the car, then 'ride'). */
export const QUICK_REPLIES = {
  rider: {
    pickup: ['comingNow', 'wait2', 'atEntrance', 'ok'],
    ride: ['ok', 'thanks'],
  },
  driver: {
    pickup: ['onMyWay', 'late5', 'arrived', 'whereAreYou', 'ok'],
    ride: ['ok', 'thanks', 'almostThere'],
  },
};

export const peerOf = (role) => (role === 'rider' ? 'driver' : 'rider');

/* ── Store ──────────────────────────────────────────────────────────────── */

function read() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.messages)) return { read: {}, ...raw };
  } catch {
    /* start empty */
  }
  return { messages: [], read: {} };
}

function write(data) {
  sessionStorage.setItem(KEY, JSON.stringify(data));
  document.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

/** Fired on the document whenever the thread changes. */
export const CHAT_EVENT = 'shedrive:chat:updated';

export function getMessages() {
  return read().messages;
}

/** The trip ended or was cancelled: the chat is gone. */
export function clearChat() {
  sessionStorage.removeItem(KEY);
}

export function unreadCount(role) {
  const data = read();
  const since = data.read[role] || 0;
  return data.messages.filter((m) => m.from !== role && m.at > since).length;
}

/** She has the chat open: everything the other side sent is read, and her side sees "Seen". */
export function markRead(role) {
  const data = read();
  const now = Date.now();
  let changed = false;
  data.messages.forEach((m) => {
    if (m.from !== role && !m.seen) { m.seen = true; changed = true; }
  });
  if ((data.read[role] || 0) < now) { data.read[role] = now; changed = true; }
  if (changed) write(data);
}

function update(id, patch) {
  const data = read();
  const msg = data.messages.find((m) => m.id === id);
  if (!msg) return null;
  Object.assign(msg, patch);
  write(data);
  return msg;
}

function append(msg) {
  const data = read();
  data.messages.push(msg);
  write(data);
  return msg;
}

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── Phone numbers ──────────────────────────────────────────────────────── */

// A run of 7+ digits (Latin or Arabic-Indic), allowing the spaces, dashes, dots,
// brackets and leading + people type inside a number.
const DIGIT = '[0-9٠-٩۰-۹]';
const NUMBER_RUN = new RegExp(`\\+?${DIGIT}(?:[\\s\\-.()]*${DIGIT}){6,}`, 'g');
export const MASK = '•••••';

/** Hide phone numbers. Returns the text to send and whether anything was hidden. */
export function maskPhoneNumbers(text) {
  let masked = false;
  const out = text.replace(NUMBER_RUN, () => { masked = true; return MASK; });
  return { text: out, masked };
}

/* ── Sending ────────────────────────────────────────────────────────────── */

/**
 * Send a message as `role`. `offline` makes it fail, as it would with no signal.
 * Returns the stored message (already masked).
 */
export function send(role, { text, key }, { offline = false } = {}) {
  const base = { id: newId(), from: role, at: Date.now(), status: 'sending' };
  const msg = key
    ? { ...base, kind: 'quick', key }
    : { ...base, kind: 'text', ...maskPhoneNumbers(text.trim().slice(0, MAX_LENGTH)) };
  append(msg);
  deliver(msg.id, offline);
  return msg;
}

/** Try again after a failed send. */
export function retry(id) {
  update(id, { status: 'sending', at: Date.now() });
  deliver(id, false);
}

function deliver(id, offline) {
  setTimeout(() => {
    if (offline) { update(id, { status: 'failed' }); return; }
    const msg = update(id, { status: 'sent' });
    if (msg) mockPeer.onDelivered(msg);
  }, 600);
}

/* ── Mock peer (the other phone) ────────────────────────────────────────── */

// Reads what she sends and answers the first couple of messages with a quick
// reply, so the demo has a conversation. Off with ?mock=off.
const PEER_ANSWERS = {
  driver: { pickup: ['onMyWay', 'arrived'], ride: ['ok'] },
  rider: { pickup: ['comingNow', 'wait2'], ride: ['thanks'] },
};

const mockPeer = {
  phase: 'pickup',
  enabled: new URLSearchParams(location.search).get('mock') !== 'off',

  onDelivered(msg) {
    if (!this.enabled) return;
    const peer = peerOf(msg.from);
    setTimeout(() => markRead(peer), 1200);

    const answers = PEER_ANSWERS[peer][this.phase] || [];
    const answered = getMessages().filter((m) => m.from === peer).length;
    if (answered >= answers.length) return;
    setTimeout(() => receive(peer, { key: answers[answered] }), 3000);
  },
};

export function setPeerPhase(phase) {
  mockPeer.phase = phase;
}

/** A message arrives from `from` (the mock peer, or a demo trigger on the trip screen). */
export function receive(from, { text, key }) {
  return append({
    id: newId(),
    from,
    at: Date.now(),
    status: 'sent',
    ...(key ? { kind: 'quick', key } : { kind: 'text', text }),
  });
}

/* ── Sample thread (?thread=sample) ─────────────────────────────────────── */

// Free text in the sample carries both languages so the design review reads it
// either way; a real message is one string, shown as written.
export function seedSample() {
  const now = Date.now();
  const min = 60_000;
  write({
    read: { rider: now, driver: now },
    messages: [
      { id: 's1', from: 'driver', at: now - 7 * min, kind: 'quick', key: 'onMyWay', status: 'sent', seen: true },
      { id: 's2', from: 'rider', at: now - 6 * min, kind: 'text', status: 'sent', seen: true,
        text: { ar: 'أنا عند بوابة عمارة 12 جنب الصيدلية', en: "I'm at the gate of building 12, next to the pharmacy" } },
      { id: 's3', from: 'driver', at: now - 5 * min, kind: 'text', status: 'sent', seen: true,
        text: { ar: 'تمام، أنا في الشارع الخلفي وجاية حالاً', en: "OK, I'm on the street behind, coming now" } },
      { id: 's4', from: 'rider', at: now - 4 * min, kind: 'text', status: 'sent', seen: true, masked: true,
        text: { ar: `لو تهتِ كلميني على ${MASK}`, en: `If you get lost call me on ${MASK}` } },
      { id: 's5', from: 'driver', at: now - 2 * min, kind: 'quick', key: 'arrived', status: 'sent', seen: true },
      { id: 's6', from: 'rider', at: now - 1 * min, kind: 'quick', key: 'comingNow', status: 'sent', seen: true },
      { id: 's7', from: 'rider', at: now - 20_000, kind: 'text', status: 'failed',
        text: { ar: 'نازلة السلم', en: 'Taking the stairs' } },
    ],
  });
}
