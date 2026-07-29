/**
 * ad-doc-viewer.js — SheDrive admin document thumbnails + lightbox
 * #1658 requires all four onboarding documents viewable inline, with a larger
 * view on click. Images are placeholder SVGs — never real ID scans.
 *
 * Usage: viewer.docs = [{ label: 'National ID', src: 'assets/national-id.svg',
 *                         meta: 'Uploaded 3 Jun 2026', ref: 'DOC-1042-NAT' }];
 */

class AdDocViewer extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
    this.render();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
  }

  build() {
    this._grid = document.createElement('div');
    this._grid.className = 'ad-docs';

    this._lightbox = document.createElement('div');
    this._lightbox.className = 'ad-lightbox';
    this._lightbox.setAttribute('role', 'dialog');
    this._lightbox.setAttribute('aria-modal', 'true');
    this._lightbox.hidden = true;

    const inner = document.createElement('div');
    inner.className = 'ad-lightbox__inner';

    const header = document.createElement('div');
    header.className = 'ad-lightbox__header';
    this._lightboxTitle = document.createElement('h3');
    this._lightboxTitle.className = 'ad-lightbox__title';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn--ghost btn--sm';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.closeLightbox());
    header.append(this._lightboxTitle, close);

    this._lightboxImg = document.createElement('img');
    this._lightboxImg.alt = '';
    this._lightboxMeta = document.createElement('p');
    this._lightboxMeta.className = 'ad-muted';

    inner.append(header, this._lightboxImg, this._lightboxMeta);
    this._lightbox.appendChild(inner);

    this._lightbox.addEventListener('click', (event) => {
      if (event.target === this._lightbox) this.closeLightbox();
    });

    this._onKeydown = (event) => {
      if (event.key === 'Escape' && this._lightbox.classList.contains('is-open')) {
        this.closeLightbox();
      }
    };
    document.addEventListener('keydown', this._onKeydown);

    this.textContent = '';
    this.append(this._grid, this._lightbox);
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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ad-doc';

      const frame = document.createElement('span');
      frame.className = 'ad-doc__frame';
      const img = document.createElement('img');
      img.src = doc.src;
      img.alt = `${doc.label} preview`;
      img.loading = 'lazy';
      frame.appendChild(img);

      const label = document.createElement('span');
      label.className = 'ad-doc__label';
      label.textContent = doc.label;

      btn.append(frame, label);

      if (doc.meta) {
        const meta = document.createElement('span');
        meta.className = 'ad-doc__meta';
        meta.textContent = doc.meta;
        btn.appendChild(meta);
      }

      btn.addEventListener('click', () => this.openLightbox(doc));
      this._grid.appendChild(btn);
    });
  }

  openLightbox(doc) {
    this._lastFocused = document.activeElement;
    this._lightboxTitle.textContent = doc.label;
    this._lightboxImg.src = doc.src;
    this._lightboxImg.alt = `${doc.label} — full view`;
    this._lightboxMeta.textContent = [doc.ref, doc.meta].filter(Boolean).join(' · ');
    this._lightbox.hidden = false;
    this._lightbox.classList.add('is-open');
    this._lightbox.querySelector('.btn')?.focus();
  }

  closeLightbox() {
    this._lightbox.classList.remove('is-open');
    this._lightbox.hidden = true;
    this._lastFocused?.focus?.();
  }
}

if (!customElements.get('ad-doc-viewer')) {
  customElements.define('ad-doc-viewer', AdDocViewer);
}
