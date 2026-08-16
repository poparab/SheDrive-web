/**
 * ad-status-pill.js — SheDrive admin status badge
 * Maps every status value used across the portal onto the shared .badge
 * variants so a status reads identically on every screen.
 *
 * Usage: <ad-status-pill status="pending_review"></ad-status-pill>
 *        pill.status = 'approved';
 */

const STATUS_MAP = {
  // Accounts
  active: { label: 'Active', tone: 'success' },
  disabled: { label: 'Disabled', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
  pending_suspension: { label: 'Pending suspension', tone: 'warning' },
  pending_review: { label: 'Pending review', tone: 'warning' },
  reinstated: { label: 'Reinstated', tone: 'success' },

  // Driver onboarding
  pending: { label: 'Pending', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },

  // Trips
  searching: { label: 'Searching', tone: 'info' },
  matched: { label: 'Matched', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'info' },
  en_route_pickup: { label: 'En route to pickup', tone: 'info' },
  arrived_pickup: { label: 'Arrived at pickup', tone: 'info' },
  trip_started: { label: 'Trip started', tone: 'brand' },
  trip_ended: { label: 'Trip ended', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  expired: { label: 'Expired', tone: 'danger' },
  created: { label: 'Created', tone: 'info' },
  // Admin interventions (#1808, #1809)
  cancelled: { label: 'Cancelled', tone: 'danger' },
  cancelled_by_admin: { label: 'Cancelled by admin', tone: 'danger' },
  reassigned_by_admin: { label: 'Reassigned by admin', tone: 'warning' },

  // Safety reports
  open: { label: 'Open', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  resolved_suspended: { label: 'Resolved — suspended', tone: 'danger' },
  resolved_dismissed: { label: 'Resolved — dismissed', tone: 'success' },

  // Zones
  inactive: { label: 'Inactive', tone: 'warning' },

  // Payment
  cash: { label: 'Cash', tone: 'info' },
  digital: { label: 'Digital', tone: 'brand' },
};

/** Exposed so screens can label a status in plain text (CSV export, headings). */
export function statusLabel(status) {
  return STATUS_MAP[status]?.label ?? String(status ?? '—');
}

class AdStatusPill extends HTMLElement {
  static observedAttributes = ['status', 'label'];

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
    const config = STATUS_MAP[key] ?? { label: this.getAttribute('label') ?? key, tone: 'info' };
    const label = this.getAttribute('label') ?? config.label;
    this.textContent = '';
    const span = document.createElement('span');
    span.className = `badge badge--${config.tone}`;
    span.textContent = label || '—';
    this.appendChild(span);
  }
}

if (!customElements.get('ad-status-pill')) {
  customElements.define('ad-status-pill', AdStatusPill);
}
