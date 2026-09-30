import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

class SdBottomSheet extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';
    // A sheet marked `closed` mounts closed. Without it, a dialog sheet would slide up on
    // every page load and slide back down once the page script closed it, catching taps
    // on whatever sits under it for the length of both animations.
    this.classList.add(
      'sd-bottom-sheet',
      'ride-sheet',
      'sheet-modal',
      'sheet-modal-bottom',
      this.hasAttribute('closed') ? 'modal-out' : 'modal-in',
      'not-animated',
    );
    this.style.setProperty('--f7-sheet-height', this.getAttribute('height') || 'auto');

    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'region');
    }

    const contentNodes = Array.from(this.childNodes).filter(
      (node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim(),
    );

    this.replaceChildren();

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar ride-sheet__toolbar';

    const handle = document.createElement('div');
    handle.className = 'ride-sheet__handle';
    handle.setAttribute('aria-hidden', 'true');
    toolbar.appendChild(handle);

    const body = document.createElement('div');
    body.className = 'sheet-modal-inner ride-sheet__body';
    contentNodes.forEach((node) => body.appendChild(node));

    this.append(toolbar, body);

    if (isI18nReady()) {
      applyTranslations();
      return;
    }

    document.addEventListener(I18N_EVENT, () => applyTranslations(), { once: true });
  }

  open() {
    this.removeAttribute('closed');
    if (this.classList.contains('modal-in')) return;
    this.enableAnimation();
    this.classList.remove('modal-out');
    this.classList.add('modal-in');
  }

  close() {
    if (this.classList.contains('modal-out')) return;
    this.enableAnimation();
    this.classList.remove('modal-in');
    this.classList.add('modal-out');
  }

  // The sheet mounts `not-animated`: screen stylesheets can land after it mounts and
  // would otherwise slide it into its start position. Animation starts with the first
  // real open() or close().
  enableAnimation() {
    if (!this.classList.contains('not-animated')) return;
    this.classList.remove('not-animated');
    void this.offsetHeight;
  }
}

if (!customElements.get('sd-bottom-sheet')) {
  customElements.define('sd-bottom-sheet', SdBottomSheet);
}