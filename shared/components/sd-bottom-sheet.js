import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

class SdBottomSheet extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';
    this.classList.add('sd-bottom-sheet', 'ride-sheet', 'sheet-modal', 'sheet-modal-bottom', 'modal-in');
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
    this.classList.remove('modal-out');
    this.classList.add('modal-in');
  }

  close() {
    this.classList.remove('modal-in');
    this.classList.add('modal-out');
  }
}

if (!customElements.get('sd-bottom-sheet')) {
  customElements.define('sd-bottom-sheet', SdBottomSheet);
}