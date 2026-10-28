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
      'Payout batches. Generate a batch from earnings past their 7-day hold, then approve, export the bank file and import the result.',
    titlePayoutBatch: 'Payout batch',
    notesPayoutBatch:
      'One batch: its lines, the bank file and the result file Finance sends back. Open it from Payouts.',
    titleSettlementImports: 'Settlement imports',
    titleDriverLedger: 'Driver ledger',
    notesDriverLedger: "One driver's ledger, opened from Driver balances: balance and payout position, record payout or settlement (sent for approval), and every entry with its payout status.",
    titleRiderLedger: 'Rider fee ledger',
    notesRiderLedger: "One rider's fees, opened from Rider balances: outstanding and credit, and Waive fee on each cancellation fee (sent for approval).",
    notesSettlementImports:
      'Upload the settlement sheet from Finance. Each row is matched by national ID and checked before it is sent for approval.',
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
      'دفعات المدفوعات. أنشئ دفعة من الأرباح التي تجاوزت فترة الانتظار ٧ أيام، ثم وافق عليها وصدّر ملف البنك واستورد النتيجة.',
    titlePayoutBatch: 'دفعة مدفوعات',
    notesPayoutBatch:
      'دفعة واحدة: بنودها وملف البنك وملف النتيجة الذي يعيده فريق المالية. تُفتح من صفحة المدفوعات.',
    titleSettlementImports: 'استيراد التسويات',
    titleDriverLedger: 'دفتر حساب السائقة',
    notesDriverLedger: 'دفتر حساب سائقة واحدة، يُفتح من أرصدة السائقات: الرصيد ووضع المدفوعات، وتسجيل دفعة أو تسوية (تُرسل للموافقة)، وكل قيد مع حالة صرفه.',
    titleRiderLedger: 'دفتر رسوم الراكبة',
    notesRiderLedger: 'رسوم راكبة واحدة، تُفتح من أرصدة الراكبات: المستحق والرصيد الدائن، والإعفاء من كل رسوم إلغاء (يُرسل للموافقة).',
    notesSettlementImports:
      'ارفع ملف التسويات من فريق المالية. تتم مطابقة كل صف بالرقم القومي والتحقق منه قبل إرساله للموافقة.',
  },
};
