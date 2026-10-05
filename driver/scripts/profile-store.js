/**
 * profile-store.js — Mock of the driver's verified profile (#1800).
 * Shared by the menu (driver/profile.html, hero only) and the profile screen
 * (driver/my-profile.html). Everything here was captured and verified during
 * onboarding, so the app only reads it. The phone comes from the session.
 */

export const DRIVER_PROFILE = {
  name: { ar: 'سارة محمد', en: 'Sara Mohamed' },
  rating: '4.9',
  ratingCount: 156,
  dateOfBirth: '14/03/1994',
  nationalIdLast4: '4821',
  vehicle: {
    model: { ar: 'هيونداي إلنترا', en: 'Hyundai Elantra' },
    year: '2022',
    color: { ar: 'فضي', en: 'Silver' },
    // Shown as printed on the car, in both languages.
    plate: 'ق د و ٤٥٦',
    type: { ar: 'سيدان', en: 'Sedan' },
  },
};

/** The current UI language, as the key into the bilingual fields above. */
export function profileLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ar';
}
