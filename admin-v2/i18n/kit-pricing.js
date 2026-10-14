/** i18n/kit-pricing.js — strings added in the v22-09 kit port (2026-10-14). */

export const en = {
  kitPricing: {
    // Shared by the pricing dialogs (scripts/pricing-dialogs.js)
    backToReview: 'Back to review',
    doneTitle: 'Request completed successfully',
    sentTitle: 'Sent for approval',

    // Service zones
    zoneSearchPlaceholder: 'Search by zone name…',
    allStatuses: 'All statuses',
    action: 'Action',
    setRateTitle: 'Set the rate — {zone}',
    deleteZoneTitle: 'Are you sure you want to delete {name}?',
    confirmDelete: 'Confirm & delete',

    // Global policies
    policiesIntro:
      "These policies apply across all zones. Changes take effect immediately for new trips; a trip already in progress keeps the values active when the driver accepted it. Per-zone amounts live on each zone's rate card.",
    saveChanges: 'Save changes',
    policiesLoadError: 'Could not load the policies',
    nothingChanged: 'Nothing has changed — there is nothing to save.',
    savedTitle: 'Changes have been saved successfully',
    savedBody: 'The new changes apply to new rides.',
    appliedNow: 'Applied now: {list}.',
    sentForApproval: 'Sent for approval: {list}. It applies only once another admin approves it.',
    commissionChange: 'platform commission {from} → {to}',
    listSeparator: ', ',

    // Revenue summary
    zonesMatching: 'Zones matching “{term}”',
    reconSubtitle: 'Gross fares = platform commission + net driver earnings',

    // Reconciliation
    openDriverBalance: 'Open driver balance',
    driversLoadError: 'Could not load the drivers',
  },
};

export const ar = {
  kitPricing: {
    backToReview: 'العودة للمراجعة',
    doneTitle: 'تم إتمام الطلب بنجاح',
    sentTitle: 'أُرسل للموافقة',

    zoneSearchPlaceholder: 'إبحث بإسم المنطقة ...',
    allStatuses: 'كل الحالات',
    action: 'الإجراء',
    setRateTitle: 'تحديد التعريفة — {zone}',
    deleteZoneTitle: 'هل أنت متأكد أنك تريد حذف {name}؟',
    confirmDelete: 'تأكيد وحذف',

    policiesIntro:
      'تنطبق هذه السياسات على جميع المناطق. تسري التغييرات فورًا على الرحلات الجديدة، بينما تحتفظ الرحلات الجارية بالقيم المعتمدة عند قبولها. وتُحدد مبالغ كل منطقة في بطاقة أسعارها.',
    saveChanges: 'حفظ التغييرات',
    policiesLoadError: 'تعذّر تحميل السياسات',
    nothingChanged: 'لم يتغير شيء — لا يوجد ما يُحفظ.',
    savedTitle: 'تم حفظ التغييرات بنجاح',
    savedBody: 'سيتم تطبيق التغييرات الجديدة على الرحلات الجديدة.',
    appliedNow: 'طُبّق الآن: {list}.',
    sentForApproval: 'أُرسل للموافقة: {list}. لا يُطبَّق إلا بعد موافقة مدير آخر.',
    commissionChange: 'عمولة المنصة {from} ← {to}',
    listSeparator: '، ',

    zonesMatching: 'المناطق المطابقة لـ «{term}»',
    reconSubtitle: 'إجمالي أجور الرحلات = عمولة المنصة + صافي أرباح السائقات',

    openDriverBalance: 'عرض رصيد السائقة',
    driversLoadError: 'تعذّر تحميل السائقات',
  },
};
