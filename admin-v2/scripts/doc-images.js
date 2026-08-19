/**
 * doc-images.js — SheDrive admin portal (v2) document artwork
 *
 * The mock data layer points every uploaded document at a flat SVG placeholder
 * in `assets/`. The delivered design kit ships photographic samples for exactly
 * the same six documents, and the whole point of the kit's lightbox gallery is
 * that a reviewer sees a real-looking scan.
 *
 * This is a presentation-only swap: the seed keeps its placeholder paths (it is
 * the frozen data layer), and screens run their doc list through `withKitArt()`
 * on the way into <ad-doc-viewer>. Anything unmapped passes through unchanged.
 */

import { assetUrl } from '../components/ad-styles.js';
import { t } from './admin-i18n.js';

/** placeholder file name → design-kit photograph. */
const KIT_ART = {
  'national-id.svg': 'vendor/img/id-card-front.jpg',
  'driving-licence.svg': 'vendor/img/driving-license.jpg',
  'vehicle-registration.svg': 'vendor/img/vehicle-registration.jpg',
  'criminal-record.svg': 'vendor/img/criminal-record.jpg',
  'profile-photo.svg': 'vendor/img/driver-selfie.jpg',
  'vehicle-photo.svg': 'vendor/img/vehicle-front-photo.jpg',
};

/**
 * Extra vehicle angles the kit ships, used to flesh out the photo gallery.
 * Labels are translation keys — the gallery is bilingual like the rest of the
 * detail screens, so the English caption is resolved at render time.
 */
export const KIT_VEHICLE_PHOTOS = [
  { labelKey: 'docs.vehicleFront', file: 'vendor/img/vehicle-front-photo.jpg' },
  { labelKey: 'docs.vehicleLeft', file: 'vendor/img/vehicle-leftside-photo.jpg' },
  { labelKey: 'docs.vehicleRear', file: 'vendor/img/vehicle-rear-photo.jpg' },
  { labelKey: 'docs.vehicleInterior', file: 'vendor/img/vehicle-inside-photo.jpg' },
];

/** Resolve one placeholder path to kit artwork, or return it untouched. */
export function kitArt(src) {
  const name = String(src ?? '').split('/').pop();
  const mapped = KIT_ART[name];
  return mapped ? assetUrl(mapped) : src;
}

/**
 * Map a list of <ad-doc-viewer> documents onto kit artwork.
 * @param {Array<{label: string, src: string}>} docs
 */
export function withKitArt(docs) {
  return (docs ?? []).map((doc) => ({ ...doc, src: kitArt(doc.src) }));
}

/** The kit's vehicle gallery, as <ad-doc-viewer> documents. */
export function kitVehiclePhotos(meta) {
  return KIT_VEHICLE_PHOTOS.map((photo) => ({
    label: t(photo.labelKey),
    src: assetUrl(photo.file),
    meta,
  }));
}
