import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

const MOVED_ATTRIBUTES = [
  'aria-label',
  'data-i18n',
  'data-i18n-aria-label',
  'data-i18n-placeholder',
  'data-i18n-value',
  'name',
  'value',
];

const SYNCED_ATTRIBUTES = [
  'aria-controls',
  'aria-expanded',
  'aria-haspopup',
  'aria-pressed',
  'disabled',
  'type',
  'variant',
  'size',
  'full',
  'icon',
];

class SdButton extends HTMLElement {
  static get observedAttributes() {
    return SYNCED_ATTRIBUTES;
  }

  connectedCallback() {
    if (!this.control) {
      this.mount();
    }

    this.sync();

    if (isI18nReady()) {
      applyTranslations();
      return;
    }

    if (!this._waitingForI18n) {
      this._waitingForI18n = true;
      document.addEventListener(
        I18N_EVENT,
        () => {
          this._waitingForI18n = false;
          applyTranslations();
        },
        { once: true },
      );
    }
  }

  attributeChangedCallback() {
    this.sync();
  }

  click() {
    this.control?.click();
  }

  focus(options) {
    this.control?.focus(options);
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    if (value) {
      this.setAttribute('disabled', '');
      return;
    }

    this.removeAttribute('disabled');
  }

  mount() {
    const control = document.createElement('button');
    control.className = 'sd-button__control btn';

    Array.from(this.childNodes).forEach((node) => control.appendChild(node));

    MOVED_ATTRIBUTES.forEach((attributeName) => {
      if (!this.hasAttribute(attributeName)) return;

      control.setAttribute(attributeName, this.getAttribute(attributeName));
      this.removeAttribute(attributeName);
    });

    this.classList.add('sd-button');
    this.replaceChildren(control);
    this.control = control;
  }

  sync() {
    if (!this.control) return;

    const classes = ['sd-button__control', 'btn'];
    const variant = this.getAttribute('variant');
    const size = this.getAttribute('size');

    if (variant) {
      classes.push(`btn--${variant}`);
    }

    if (size) {
      classes.push(`btn--${size}`);
    }

    if (this.hasAttribute('full')) {
      classes.push('btn--full');
    }

    if (this.hasAttribute('icon')) {
      classes.push('btn--icon');
    }

    Array.from(this.classList)
      .filter((className) => className !== 'sd-button')
      .forEach((className) => classes.push(className));

    this.control.className = classes.join(' ');
    this.control.type = this.getAttribute('type') || 'button';
    this.control.disabled = this.hasAttribute('disabled');

    ['aria-controls', 'aria-expanded', 'aria-haspopup', 'aria-pressed'].forEach((attributeName) => {
      if (this.hasAttribute(attributeName)) {
        this.control.setAttribute(attributeName, this.getAttribute(attributeName));
        return;
      }

      this.control.removeAttribute(attributeName);
    });
  }
}

if (!customElements.get('sd-button')) {
  customElements.define('sd-button', SdButton);
}