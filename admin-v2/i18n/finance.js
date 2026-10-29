/**
 * i18n/finance.js — sidebar and screen-index strings for the 2026-10-14
 * payouts / settlement-import / maker-checker screens. Each screen's own
 * strings live in its own area module (approvals.js, payouts.js,
 * settlement-imports.js, finance-edits.js) so screens can be built apart.
 */

export const en = {
  nav: {
    finance: 'Finance',
    pricing: 'Pricing',
    reporting: 'Reporting',
    approvals: 'Approvals',
    approvalsPendingCount: '{n} requests awaiting approval',
    payouts: 'Payouts',
    settlementImports: 'Settlement imports',
  },
  screens: {
    titleApprovals: 'Approvals',
    notesApprovals:
      'Maker-checker queue. Every finance request waits here until a Financial lead approves or rejects it; an officer sees only her own requests. Try ?as=fin_officer and ?as=fin_lead.',
    titlePayouts: 'Payouts',
    notesPayouts:
      'Payout batches. Generate a batch from earnings past their 7-day hold — ready to export at once, one bank file per payout method — then import each file’s result.',
    titlePayoutBatch: 'Payout batch',
    notesPayoutBatch:
      'One batch: its lines, one bank file per payout method, and each file’s result. Open it from Payouts.',
    titleSettlementImports: 'Settlement imports',
    titleDriverLedger: 'Driver ledger',
    notesDriverLedger: "One driver's ledger, opened from Driver balances: balance and payout position, record payout or settlement (sent for approval), and every entry with its payout status.",
    titleRiderLedger: 'Rider fee ledger',
    notesRiderLedger: "One rider's fees, opened from Rider balances: outstanding and credit, and Waive fee on each cancellation fee (sent for approval).",
    notesSettlementImports:
      'Import history, then a three-step wizard: template, upload (template and format check — ?step=2&sample=format), review (business check; one failed row rejects the whole file — ?step=3&sample=business, ?step=3&sample=clean).',
  },
};

export const ar = {
  nav: {
    finance: 'المالية',
    pricing: 'التسعير',
    reporting: 'التقارير والمصالحات',
    approvals: 'الموافقات',
    approvalsPendingCount: '{n} طلبات بانتظار الموافقة',
    payouts: 'المدفوعات',
    settlementImports: 'استيراد التسويات',
  },
  screens: {
    titleApprovals: 'الموافقات',
    notesApprovals:
      'قائمة الموافقات (منشئ ومراجع). ينتظر كل طلب مالي هنا حتى يعتمده رئيس فريق مالي أو يرفضه؛ ويرى الموظف المالي طلباته فقط. جرّب ?as=fin_officer و?as=fin_lead.',
    titlePayouts: 'المدفوعات',
    notesPayouts:
      'دفعات المدفوعات. أنشئ دفعة من الأرباح التي تجاوزت فترة الانتظار ٧ أيام — جاهزة للتصدير فورًا، ملف بنكي لكل طريقة دفع — ثم استورد نتيجة كل ملف.',
    titlePayoutBatch: 'دفعة مدفوعات',
    notesPayoutBatch:
      'دفعة واحدة: بنودها وملف بنكي لكل طريقة دفع ونتيجة كل ملف. تُفتح من صفحة المدفوعات.',
    titleSettlementImports: 'استيراد التسويات',
    titleDriverLedger: 'دفتر حساب السائقة',
    notesDriverLedger: 'دفتر حساب سائقة واحدة، يُفتح من أرصدة السائقات: الرصيد ووضع المدفوعات، وتسجيل دفعة أو تسوية (تُرسل للموافقة)، وكل قيد مع حالة صرفه.',
    titleRiderLedger: 'دفتر رسوم الراكبة',
    notesRiderLedger: 'رسوم راكبة واحدة، تُفتح من أرصدة الراكبات: المستحق والرصيد الدائن، والإعفاء من كل رسوم إلغاء (يُرسل للموافقة).',
    notesSettlementImports:
      'سجل الاستيراد ثم معالج من ثلاث خطوات: النموذج، الرفع (فحص النموذج والصيغ — ?step=2&sample=format)، المراجعة (فحص قواعد العمل؛ صف فاشل واحد يرفض الملف كله — ?step=3&sample=business، ?step=3&sample=clean).',
  },
};
