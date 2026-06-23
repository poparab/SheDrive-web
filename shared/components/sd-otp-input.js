/**
 * sd-otp-input — 6-box numeric OTP entry component.
 *
 * Attributes:
 *   length   — number of boxes (default 6)
 *   error    — show error/expired visual state ('true'/'false')
 *
 * Events:
 *   sd-otp-complete  — fired when all digits are filled; detail.value = 6-char string
 *   sd-otp-change    — fired on each digit change; detail.value = current string (may be partial)
 */

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<div class="otp-boxes" role="group" aria-label="رمز التحقق">
</div>
`;

class SdOtpInput extends HTMLElement {
  constructor() {
    super();
    this._boxes = [];
  }

  static get observedAttributes() {
    return ['length', 'error'];
  }

  connectedCallback() {
    this.appendChild(TEMPLATE.content.cloneNode(true));
    this._container = this.querySelector('.otp-boxes');
    this._build();
  }

  attributeChangedCallback(name) {
    if (!this._container) return;
    if (name === 'length') this._build();
    if (name === 'error') this._updateErrorState();
  }

  _build() {
    const len = parseInt(this.getAttribute('length') || '6', 10);
    this._container.innerHTML = '';
    this._boxes = [];

    for (let i = 0; i < len; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.className = 'otp-box';
      input.autocomplete = i === 0 ? 'one-time-code' : 'off';
      input.setAttribute('aria-label', `الرقم ${i + 1} من ${len}`);
      input.dataset.index = String(i);

      input.addEventListener('input', (e) => this._onInput(e, i));
      input.addEventListener('keydown', (e) => this._onKeydown(e, i));
      input.addEventListener('paste', (e) => this._onPaste(e));
      input.addEventListener('focus', () => input.select());

      this._container.appendChild(input);
      this._boxes.push(input);
    }

    this._updateErrorState();
  }

  _onInput(e, index) {
    const input = this._boxes[index];
    const raw = input.value.replace(/\D/g, '');
    input.value = raw.slice(0, 1);

    if (input.value && index < this._boxes.length - 1) {
      this._boxes[index + 1].focus();
    }

    this._dispatch();
  }

  _onKeydown(e, index) {
    if (e.key === 'Backspace') {
      const input = this._boxes[index];
      if (!input.value && index > 0) {
        this._boxes[index - 1].focus();
        this._boxes[index - 1].value = '';
        this._dispatch();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      this._boxes[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < this._boxes.length - 1) {
      this._boxes[index + 1].focus();
    }
  }

  _onPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const digits = text.replace(/\D/g, '').slice(0, this._boxes.length);
    digits.split('').forEach((d, i) => {
      if (this._boxes[i]) this._boxes[i].value = d;
    });
    const nextEmpty = this._boxes.findIndex((b) => !b.value);
    const focusIndex = nextEmpty === -1 ? this._boxes.length - 1 : nextEmpty;
    this._boxes[focusIndex].focus();
    this._dispatch();
  }

  _dispatch() {
    const value = this._boxes.map((b) => b.value).join('');
    this.dispatchEvent(new CustomEvent('sd-otp-change', { bubbles: true, detail: { value } }));
    if (value.length === this._boxes.length) {
      this.dispatchEvent(new CustomEvent('sd-otp-complete', { bubbles: true, detail: { value } }));
    }
  }

  _updateErrorState() {
    const isError = this.getAttribute('error') === 'true';
    this._boxes.forEach((b) => b.classList.toggle('otp-box--error', isError));
  }

  /** Programmatically clear all boxes and focus first */
  clear() {
    this._boxes.forEach((b) => (b.value = ''));
    if (this._boxes[0]) this._boxes[0].focus();
    this._updateErrorState();
  }

  /** Return current value string */
  get value() {
    return this._boxes.map((b) => b.value).join('');
  }

  /** Focus the first empty box (or last) */
  focus() {
    const first = this._boxes.find((b) => !b.value) || this._boxes[this._boxes.length - 1];
    if (first) first.focus();
  }
}

if (!customElements.get('sd-otp-input')) {
  customElements.define('sd-otp-input', SdOtpInput);
}
