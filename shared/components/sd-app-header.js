import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

const MENU_ICON = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
`;

class SdAppHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';
    this.classList.add('sd-app-header');

    const nodes = Array.from(this.childNodes).filter(
      (node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim(),
    );

    const startNodes = [];
    const titleNodes = [];
    const endNodes = [];

    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const slotName = node.getAttribute('data-slot');
        if (slotName === 'start') {
          startNodes.push(node);
          return;
        }
        if (slotName === 'end') {
          endNodes.push(node);
          return;
        }
      }

      titleNodes.push(node);
    });

    this.replaceChildren();

    const header = document.createElement('header');
    header.className = ['sd-app-header__bar', 'navbar', this.getAttribute('bar-class') || 'home-topbar']
      .filter(Boolean)
      .join(' ');
    header.setAttribute('role', 'banner');

    const inner = document.createElement('div');
    inner.className = ['sd-app-header__inner', 'navbar-inner', this.getAttribute('inner-class') || 'home-topbar__inner']
      .filter(Boolean)
      .join(' ');

    startNodes.forEach((node) => inner.appendChild(node));

    if (startNodes.length === 0 && this.hasAttribute('menu')) {
      inner.appendChild(this.buildMenuButton());
    }

    const title = document.createElement('div');
    title.className = ['sd-app-header__title', 'title', this.getAttribute('title-class') || 'home-topbar__title']
      .filter(Boolean)
      .join(' ');
    titleNodes.forEach((node) => title.appendChild(node));
    inner.appendChild(title);

    const actions = document.createElement('div');
    actions.className = ['sd-app-header__actions', this.getAttribute('actions-class') || 'home-topbar__actions']
      .filter(Boolean)
      .join(' ');

    if (!this.hasAttribute('hide-lang-toggle')) {
      actions.appendChild(this.buildLanguageToggle());
    }

    endNodes.forEach((node) => actions.appendChild(node));

    if (this.hasAttribute('profile')) {
      actions.appendChild(this.buildProfileButton());
    }

    if (actions.childNodes.length > 0) {
      inner.appendChild(actions);
    }

    header.appendChild(inner);
    this.appendChild(header);

    if (isI18nReady()) {
      applyTranslations();
      return;
    }

    document.addEventListener(I18N_EVENT, () => applyTranslations(), { once: true });
  }

  buildLanguageToggle() {
    const nav = document.createElement('nav');
    nav.className = 'lang-switcher';
    nav.setAttribute('aria-label', 'اللغة');
    nav.setAttribute('data-i18n-aria-label', 'aria.lang.switcher');
    nav.innerHTML = `
      <button class="lang-switcher__btn" data-lang-btn="ar" aria-pressed="true" type="button">AR</button>
      <span class="lang-switcher__sep" aria-hidden="true">|</span>
      <button class="lang-switcher__btn" data-lang-btn="en" aria-pressed="false" type="button">EN</button>
    `;
    return nav;
  }

  buildMenuButton() {
    const button = document.createElement('sd-button');
    button.id = this.getAttribute('menu-button-id') || 'menu-btn';
    button.className = this.getAttribute('menu-class') || 'home-topbar__menu';
    button.setAttribute('variant', 'ghost');
    button.setAttribute('icon', '');
    button.setAttribute('aria-label', 'القائمة');
    button.setAttribute('data-i18n-aria-label', 'nav.menu');
    button.innerHTML = MENU_ICON;
    return button;
  }

  buildProfileButton() {
    const button = document.createElement('sd-button');
    button.id = this.getAttribute('profile-button-id') || 'profile-btn';
    button.setAttribute('variant', 'ghost');
    button.setAttribute('icon', '');
    button.setAttribute('aria-label', 'الملف الشخصي');
    button.setAttribute('data-i18n-aria-label', 'nav.profile');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = this.getAttribute('profile-avatar') || 'ش';

    button.appendChild(avatar);
    return button;
  }
}

if (!customElements.get('sd-app-header')) {
  customElements.define('sd-app-header', SdAppHeader);
}