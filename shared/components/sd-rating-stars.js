import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

const STAR_SVG = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke-width="1.5" stroke-linejoin="round"></polygon>
  </svg>
`;

class SdRatingStars extends HTMLElement {
  static get observedAttributes() {
    return ['value'];
  }

  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';
    this.classList.add('star-rating__stars');
    this.setAttribute('role', 'radiogroup');
    this.setAttribute('aria-label', 'التقييم من 5 نجوم');
    this.setAttribute('data-i18n-aria-label', this.getAttribute('aria-key') || 'complete.ratingGroup');

    this.replaceChildren();

    Array.from({ length: 5 }, (_, index) => index + 1).forEach((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'star-btn';
      button.dataset.star = String(value);
      button.setAttribute('aria-label', `${value} نجوم من 5`);
      button.setAttribute('data-i18n-aria-label', `complete.star${value}Aria`);
      button.innerHTML = STAR_SVG;
      button.addEventListener('click', () => this.commit(value));
      button.addEventListener('mouseenter', () => this.paint(value));
      button.addEventListener('mouseleave', () => this.paint(this.value));
      this.appendChild(button);
    });

    this.paint(this.value);

    if (isI18nReady()) {
      applyTranslations();
      return;
    }

    document.addEventListener(I18N_EVENT, () => applyTranslations(), { once: true });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== 'value' || oldValue === newValue) return;
    this.paint(this.value);
  }

  get value() {
    return Number(this.getAttribute('value') || 0);
  }

  set value(nextValue) {
    const normalized = Math.max(0, Math.min(5, Number(nextValue) || 0));
    this.setAttribute('value', String(normalized));
  }

  commit(value) {
    this.value = value;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      detail: { value: this.value },
    }));
  }

  paint(value) {
    Array.from(this.querySelectorAll('.star-btn')).forEach((button, index) => {
      const isActive = index < value;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }
}

if (!customElements.get('sd-rating-stars')) {
  customElements.define('sd-rating-stars', SdRatingStars);
}