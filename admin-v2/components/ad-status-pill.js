/**
 * ad-status-pill.js — SheDrive admin status badge (v2 design)
 * Maps every status value used across the portal onto the delivered design
 * kit's status vocabulary so a status reads identically on every screen.
 *
 * Two renders, chosen with the `variant` attribute:
 *
 *   default (lamp)  — the kit's inline dot + label, used inside data grids:
 *     <div class="status-active-lamp"><div class="lamp"></div>Approved</div>
 *
 *   variant="chip"  — the kit's solid pill with a round icon, used on detail
 *     screens where the status is a headline, not a cell:
 *     <div class="status-approved"><div class="icon"><i class="fa-solid fa-check"></i></div>Approved</div>
 *
 * Usage: <ad-status-pill status="pending_review"></ad-status-pill>
 *        <ad-status-pill status="approved" variant="chip"></ad-status-pill>
 *        pill.status = 'approved';
 *
 * `label` overrides the mapped label; an unknown status falls back to `info`.
 */

import { t } from '../scripts/admin-i18n.js';

const STATUS_MAP = {
  // Accounts
  active: { key: 'status.active', tone: 'success' },
  disabled: { key: 'status.disabled', tone: 'danger' },
  suspended: { key: 'status.suspended', tone: 'danger' },
  pending_suspension: { key: 'status.pending_suspension', tone: 'warning' },
  pending_review: { key: 'status.pending_review', tone: 'warning' },
  reinstated: { key: 'status.reinstated', tone: 'success' },

  // Driver onboarding
  pending: { key: 'status.pending', tone: 'warning' },
  submitted: { key: 'status.submitted', tone: 'info' },
  approved: { key: 'status.approved', tone: 'success' },
  rejected: { key: 'status.rejected', tone: 'danger' },

  // Trips
  searching: { key: 'status.searching', tone: 'info' },
  matched: { key: 'status.matched', tone: 'info' },
  accepted: { key: 'status.accepted', tone: 'info' },
  en_route_pickup: { key: 'status.en_route_pickup', tone: 'info' },
  arrived_pickup: { key: 'status.arrived_pickup', tone: 'info' },
  trip_started: { key: 'status.trip_started', tone: 'brand' },
  trip_ended: { key: 'status.trip_ended', tone: 'success' },
  completed: { key: 'status.completed', tone: 'success' },
  expired: { key: 'status.expired', tone: 'danger' },
  created: { key: 'status.created', tone: 'info' },
  // Admin interventions (#1808, #1809)
  cancelled: { key: 'status.cancelled', tone: 'danger' },
  cancelled_by_admin: { key: 'status.cancelled_by_admin', tone: 'danger' },
  reassigned_by_admin: { key: 'status.reassigned_by_admin', tone: 'warning' },

  // Safety reports
  open: { key: 'status.open', tone: 'warning' },
  resolved: { key: 'status.resolved', tone: 'success' },
  resolved_suspended: { key: 'status.resolved_suspended', tone: 'danger' },
  resolved_dismissed: { key: 'status.resolved_dismissed', tone: 'success' },

  // Zones
  inactive: { key: 'status.inactive', tone: 'warning' },

  // Payment
  cash: { key: 'status.cash', tone: 'info' },
  digital: { key: 'status.digital', tone: 'brand' },
};

/** tone → the kit's lamp class. */
const LAMP_CLASS = {
  success: 'status-active-lamp',
  warning: 'status-warning-lamp',
  danger: 'status-danger-lamp',
  info: 'status-blue-lamp',
  brand: 'status-primary-lamp',
  neutral: 'status-disabled-lamp',
  disabled: 'status-disabled-lamp',
};

/** tone → the kit's solid chip class plus its Font Awesome glyph. */
const CHIP_CLASS = {
  success: { className: 'status-approved', icon: 'fa-check' },
  warning: { className: 'status-pending', icon: 'fa-hourglass-half' },
  danger: { className: 'status-rejected', icon: 'fa-xmark' },
  info: { className: 'status-created', icon: 'fa-circle-dot' },
  brand: { className: 'status-created', icon: 'fa-circle-dot' },
  neutral: { className: 'status-created', icon: 'fa-circle-dot' },
  disabled: { className: 'status-created', icon: 'fa-circle-dot' },
};

/**
 * Exposed so screens can label a status in plain text (CSV export, headings).
 * Returns the label in the active language; an unmapped value is echoed back.
 */
export function statusLabel(status) {
  const entry = STATUS_MAP[status];
  return entry ? t(entry.key) : String(status ?? '—');
}

class AdStatusPill extends HTMLElement {
  static observedAttributes = ['status', 'label', 'variant'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  get status() {
    return this.getAttribute('status') ?? '';
  }

  set status(value) {
    this.setAttribute('status', value ?? '');
  }

  render() {
    const key = this.status;
    const config = STATUS_MAP[key];
    // `label` always wins, so a screen can name a status the map has no word for.
    const label = this.getAttribute('label') ?? (config ? t(config.key) : key);
    const tone = config?.tone ?? 'info';

    this.textContent = '';
    this.appendChild(
      this.getAttribute('variant') === 'chip'
        ? this.buildChip(tone, label)
        : this.buildLamp(tone, label),
    );
  }

  /** The kit's inline dot + label, for grid cells. */
  buildLamp(tone, label) {
    const wrap = document.createElement('div');
    wrap.className = LAMP_CLASS[tone] ?? LAMP_CLASS.info;
    const lamp = document.createElement('div');
    lamp.className = 'lamp';
    wrap.append(lamp, document.createTextNode(label || '—'));
    return wrap;
  }

  /** The kit's solid chip with a round icon, for detail headers. */
  buildChip(tone, label) {
    const spec = CHIP_CLASS[tone] ?? CHIP_CLASS.info;
    const wrap = document.createElement('div');
    wrap.className = spec.className;
    const icon = document.createElement('div');
    icon.className = 'icon';
    // Static markup only — the label below is always a text node.
    icon.innerHTML = `<i class="fa-solid ${spec.icon}" aria-hidden="true"></i>`;
    wrap.append(icon, document.createTextNode(label || '—'));
    return wrap;
  }
}

if (!customElements.get('ad-status-pill')) {
  customElements.define('ad-status-pill', AdStatusPill);
}
