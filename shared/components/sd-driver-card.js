import { applyTranslations, I18N_EVENT, isI18nReady } from '../scripts/i18n.js';

class SdDriverCard extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';

    const variant = this.getAttribute('variant') || 'detailed';
    const avatarFallback = this.getAttribute('avatar') || 'ش';
    const nameId = this.getAttribute('name-id') || 'driver-name';
    const nameFallback = this.getAttribute('name-fallback') || 'نورا أحمد';
    const ratingId = this.getAttribute('rating-id');
    const ratingFallback = this.getAttribute('rating-fallback') || '★★★★★ 4.9';
    const vehicleId = this.getAttribute('vehicle-id');
    const vehicleFallback = this.getAttribute('vehicle-fallback') || 'تويوتا كورولا 2023 — أبيض';
    const etaId = this.getAttribute('eta-id');
    const etaFallback = this.getAttribute('eta-fallback') || 'الوصول خلال 4 دقيقة';
    const promptKey = this.getAttribute('prompt-key');
    const promptFallback = this.getAttribute('prompt-fallback') || '';

    this.classList.add('driver-card', `sd-driver-card--${variant}`);
    this.setAttribute('role', this.getAttribute('role') || 'region');
    this.setAttribute('aria-label', 'معلومات السائقة');
    this.setAttribute('data-i18n-aria-label', this.getAttribute('aria-key') || 'aria.driverInfo');

    this.replaceChildren();

    if (variant === 'compact') {
      this.append(this.buildCompactAvatar(avatarFallback), this.buildCompactInfo(nameId, nameFallback, promptKey, promptFallback));
    } else {
      this.append(
        this.buildDetailedAvatar(avatarFallback),
        this.buildDetailedInfo(nameId, nameFallback, ratingId, ratingFallback, vehicleId, vehicleFallback, etaId, etaFallback),
      );
    }

    if (isI18nReady()) {
      applyTranslations();
      return;
    }

    document.addEventListener(I18N_EVENT, () => applyTranslations(), { once: true });
  }

  buildDetailedAvatar(avatarFallback) {
    const avatar = document.createElement('div');
    avatar.className = 'driver-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = avatarFallback;
    return avatar;
  }

  buildDetailedInfo(nameId, nameFallback, ratingId, ratingFallback, vehicleId, vehicleFallback, etaId, etaFallback) {
    const info = document.createElement('div');
    info.className = 'driver-info';

    const name = document.createElement('p');
    name.className = 'driver-name';
    name.id = nameId;
    name.textContent = nameFallback;
    info.appendChild(name);

    if (ratingId) {
      const rating = document.createElement('p');
      rating.className = 'driver-rating';
      rating.id = ratingId;
      rating.setAttribute('aria-label', 'التقييم');
      rating.setAttribute('data-i18n-aria-label', 'trip.rating');
      rating.textContent = ratingFallback;
      info.appendChild(rating);
    }

    if (vehicleId) {
      const vehicle = document.createElement('p');
      vehicle.className = 'driver-vehicle';
      vehicle.id = vehicleId;
      vehicle.textContent = vehicleFallback;
      info.appendChild(vehicle);
    }

    if (etaId) {
      const eta = document.createElement('p');
      eta.className = 'driver-eta';
      eta.id = etaId;
      eta.setAttribute('aria-live', 'polite');
      eta.textContent = etaFallback;
      info.appendChild(eta);
    }

    return info;
  }

  buildCompactAvatar(avatarFallback) {
    const avatar = document.createElement('div');
    avatar.className = 'driver-card__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = avatarFallback;
    return avatar;
  }

  buildCompactInfo(nameId, nameFallback, promptKey, promptFallback) {
    const info = document.createElement('div');
    info.className = 'driver-card__info';

    const name = document.createElement('p');
    name.className = 'driver-card__name';
    name.id = nameId;
    name.textContent = nameFallback;
    info.appendChild(name);

    if (promptKey) {
      const prompt = document.createElement('p');
      prompt.className = 'driver-card__prompt';
      prompt.setAttribute('data-i18n', promptKey);
      prompt.textContent = promptFallback;
      info.appendChild(prompt);
    }

    return info;
  }
}

if (!customElements.get('sd-driver-card')) {
  customElements.define('sd-driver-card', SdDriverCard);
}