/**
 * i18n/components.js — strings for the shared ad-* components (grid, filters, cards, modal, doc viewer, timeline, map).
 *
 * Same shape as core.js: export `en` and `ar` objects of namespaces.
 * Namespaces merge across area files, so extending an existing namespace here
 * is fine — just do not restate a key core.js already owns.
 *
 * `table.*`, `filters.*`, `state.*`, `status.*` and `common.*` are core's — the
 * components reuse them and only add what core has no word for.
 *
 * The `validation.*` messages are the fallbacks <ad-form-modal> uses when a
 * field spec does not carry its own `emptyError` / `invalidError` / `lengthError`
 * / `rangeError`. Those per-field messages come verbatim from the [Admin] story
 * Field Validation tables, so the English wording below is deliberately left
 * exactly as it was before the portal became bilingual — only an Arabic
 * equivalent was added beside it.
 *
 * Arabic follows the delivered kit's own `*_ar.html` pages: «إعادة المحاولة»,
 * «إغلاق», «إلى», «المستندات المرفوعة», «العودة للمراجعة».
 */

export const en = {
  /** Grid chrome core.js does not already name. */
  table: {
    previousPage: 'Previous page',
    nextPage: 'Next page',
    morePages: 'More pages',
    goToPage: 'Go to page {page}',
  },

  /** <ad-tabs> */
  tabs: {
    label: 'Sections',
  },

  /** <ad-form-modal> chrome. Confirm/cancel default to common.save / common.cancel. */
  modal: {
    selectPlaceholder: 'Select…',
    working: 'Working…',
    saveFailed: 'Could not save. Try again.',
  },

  /**
   * <ad-form-modal> built-in validation fallbacks. English wording is frozen —
   * it is quoted in the ADO story acceptance criteria.
   */
  validation: {
    required: '{label} is required',
    invalid: 'Enter a valid {label}',
    invalidNumber: 'Enter a valid number',
    maxLength: 'Must be {max} characters or fewer',
    minLength: 'Must be at least {min} characters',
    min: 'Must be at least {min}',
    max: 'Must be at most {max}',
  },

  /** <ad-map-panel> overlays, toolbar and boundary-draw errors. */
  map: {
    region: 'Map',
    toolbar: 'Map tools',
    legend: 'Map legend',
    libraryMissing: 'Map library did not load. Check the Mapbox script tag on this page.',
    webglUnavailable: 'This browser cannot display the map (WebGL unavailable).',
    noToken:
      'Map could not start — no Mapbox token available. Set localStorage "shedrive.mapboxToken" and reload.',
    tilesFailed: 'Map tiles did not load. Check the network connection and Mapbox token.',
    drawTooFewPoints: 'Draw the zone boundary on the map',
    drawSelfIntersects: 'Boundary must not self-intersect',
  },

  /** <ad-doc-viewer> */
  docs: {
    gallery: 'Uploaded documents',
    untitled: 'Document',
    enlarge: 'Enlarge {label}',
  },
};

export const ar = {
  table: {
    previousPage: 'الصفحة السابقة',
    nextPage: 'الصفحة التالية',
    morePages: 'صفحات أخرى',
    goToPage: 'الانتقال إلى صفحة {page}',
  },

  tabs: {
    label: 'الأقسام',
  },

  modal: {
    selectPlaceholder: 'اختر…',
    working: 'جارٍ التنفيذ…',
    saveFailed: 'تعذّر الحفظ. حاول مرة أخرى.',
  },

  validation: {
    required: '{label} مطلوب',
    invalid: 'أدخل {label} صحيحًا',
    invalidNumber: 'أدخل رقمًا صحيحًا',
    maxLength: 'يجب ألا يزيد عن {max} حرفًا',
    minLength: 'يجب ألا يقل عن {min} حرفًا',
    min: 'يجب ألا يقل عن {min}',
    max: 'يجب ألا يزيد عن {max}',
  },

  map: {
    region: 'الخريطة',
    toolbar: 'أدوات الخريطة',
    legend: 'مفتاح الخريطة',
    libraryMissing: 'تعذّر تحميل مكتبة الخرائط. تحقّق من وسم سكربت Mapbox في هذه الصفحة.',
    webglUnavailable: 'هذا المتصفح لا يستطيع عرض الخريطة (WebGL غير متاح).',
    noToken:
      'تعذّر تشغيل الخريطة — لا يوجد رمز Mapbox. اضبط "shedrive.mapboxToken" في localStorage ثم أعد التحميل.',
    tilesFailed: 'تعذّر تحميل بلاطات الخريطة. تحقّق من الاتصال بالشبكة ومن رمز Mapbox.',
    drawTooFewPoints: 'ارسم حدود المنطقة على الخريطة',
    drawSelfIntersects: 'يجب ألا تتقاطع حدود المنطقة مع نفسها',
  },

  docs: {
    gallery: 'المستندات المرفوعة',
    untitled: 'مستند',
    enlarge: 'تكبير {label}',
  },
};
