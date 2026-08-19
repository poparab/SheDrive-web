/**
 * ad-doc-viewer.js — SheDrive admin document thumbnails + lightbox (v2 design)
 * #1658 requires all four onboarding documents viewable inline, with a larger
 * view on click. Images are placeholder SVGs — never real ID scans.
 *
 * Renders the delivered kit's gallery:
 *
 *   <div class="lightbox-container">
 *     <a class="photo-trigger" href="<full image>" title="<label>">
 *       <div class="thumb-item">
 *         <div class="thumb-img"><div class="photo"><i class="fa-solid fa-expand"></i></div></div>
 *         <div class="thumb-details"><h6>label</h6><p>meta</p></div>
 *       </div>
 *     </a>
 *   </div>
 *
 * The enlarged view is the kit's Magnific Popup, bound through
 * `bindLightbox()` from scripts/design-init.js after every render — the
 * component no longer ships a bespoke lightbox of its own.
 *
 * The legacy `ad-docs` / `ad-doc` class names ride along on the container and
 * each trigger so screen CSS written against the old markup still matches.
 *
 * Usage: viewer.docs = [{ label: 'National ID', src: 'assets/national-id.svg',
 *                         meta: 'Uploaded 3 Jun 2026', ref: 'DOC-1042-NAT' }];
 * `full` may be supplied to point the enlarged view at a higher-resolution
 * file; it defaults to `src`. `label`, `meta` and `ref` are supplied already
 * translated by the screen; the component only contributes the gallery's
 * `aria-label`, the enlarge `aria-label`/`title`, and the fallback used when a
 * document arrives without a label.
 */

import { bindLightbox } from '../scripts/design-init.js';
import { t } from '../scripts/admin-i18n.js';

class AdDocViewer extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  build() {
    this._grid = document.createElement('div');
    this._grid.className = 'lightbox-container ad-docs';
    this._grid.setAttribute('role', 'group');
    this._grid.setAttribute('aria-label', t('docs.gallery'));
    this.textContent = '';
    this.appendChild(this._grid);
    this._built = true;
  }

  set docs(docs) {
    this._docs = docs ?? [];
    if (this._built) this.render();
  }

  get docs() {
    return this._docs ?? [];
  }

  render() {
    this._grid.textContent = '';

    (this._docs ?? []).forEach((doc) => {
      const label = doc.label || t('docs.untitled');

      const trigger = document.createElement('a');
      trigger.className = 'photo-trigger ad-doc';
      trigger.href = doc.full || doc.src || '';
      trigger.title = label;
      trigger.setAttribute('aria-label', t('docs.enlarge', { label }));

      const thumb = document.createElement('div');
      thumb.className = 'thumb-item';

      const thumbImg = document.createElement('div');
      thumbImg.className = 'thumb-img ad-doc__frame';

      const photo = document.createElement('div');
      photo.className = 'photo';
      // Set through the CSSOM so a document path is never interpolated into markup.
      if (doc.src) photo.style.backgroundImage = `url("${doc.src}")`;
      photo.innerHTML = '<i class="fa-solid fa-expand" aria-hidden="true"></i>';

      thumbImg.appendChild(photo);
      thumb.appendChild(thumbImg);

      const details = document.createElement('div');
      details.className = 'thumb-details';
      const labelEl = document.createElement('h6');
      labelEl.className = 'ad-doc__label';
      labelEl.textContent = label;
      details.appendChild(labelEl);

      if (doc.meta || doc.ref) {
        const meta = document.createElement('p');
        meta.className = 'ad-doc__meta';
        if (doc.meta) meta.appendChild(document.createTextNode(doc.meta));
        if (doc.meta && doc.ref) meta.appendChild(document.createTextNode(' · '));
        if (doc.ref) {
          // A document reference (DOC-1042-NAT) is a Latin run inside an
          // otherwise Arabic caption — styles/admin-rtl.css isolates .ad-ltr.
          const ref = document.createElement('span');
          ref.className = 'ad-ltr';
          ref.textContent = doc.ref;
          meta.appendChild(ref);
        }
        details.appendChild(meta);
      }

      thumb.appendChild(details);
      trigger.appendChild(thumb);
      this._grid.appendChild(trigger);
    });

    // Fire-and-forget: the kit's popup loads jQuery + Magnific on first use.
    bindLightbox(this._grid);
  }

  /** Open one document in the kit's popup. Kept for callers of the old API. */
  openLightbox(doc) {
    const href = doc?.full || doc?.src;
    const trigger = Array.from(this._grid?.children ?? []).find(
      (node) => node.getAttribute('href') === href,
    );
    if (trigger) trigger.click();
  }

  /** Close the kit's popup, if one is open. */
  closeLightbox() {
    window.jQuery?.magnificPopup?.close?.();
  }
}

if (!customElements.get('ad-doc-viewer')) {
  customElements.define('ad-doc-viewer', AdDocViewer);
}
