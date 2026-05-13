class SdToastHost extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';

    const container = document.createElement('div');
    container.className = 'toast-container';
    container.id = this.getAttribute('container-id') || 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');

    this.appendChild(container);
    this.container = container;
  }

  showToast(message, type = 'info', duration = 3500) {
    const container = this.container || this.querySelector('.toast-container');
    if (!container) return null;

    const tone = type === 'error' ? 'danger' : type;
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;

    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
    return toast;
  }
}

if (!customElements.get('sd-toast-host')) {
  customElements.define('sd-toast-host', SdToastHost);
}