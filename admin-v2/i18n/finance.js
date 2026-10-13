/**
 * i18n/finance.js — sidebar and screen-index strings for the 2026-10-14
 * payouts / settlement-import / maker-checker screens. Each screen's own
 * strings live in its own area module (approvals.js, payouts.js,
 * settlement-imports.js, finance-edits.js) so screens can be built apart.
 */

export const en = {
  nav: {
    approvals: 'Approvals',
    approvalsPendingCount: '{n} requests awaiting approval',
    payouts: 'Payouts',
    settlementImports: 'Settlement imports',
  },
  screens: {
    titleApprovals: 'Approvals',
    notesApprovals:
      'Maker-checker queue. Every finance action waits here until a different admin approves or rejects it. Use "Act as another admin" to see the checker side.',
    titlePayouts: 'Payouts',
    notesPayouts:
      'Payout batches. Generate a batch from earnings past their 7-day hold, then approve, export the bank file and import the result.',
    titlePayoutBatch: 'Payout batch',
    notesPayoutBatch:
      'One batch: its lines, the bank file and the result file Finance sends back. Open it from Payouts.',
    titleSettlementImports: 'Settlement imports',
    notesSettlementImports:
      'Upload the settlement sheet from Finance. Each row is matched by national ID and checked before it is sent for approval.',
  },
};

export const ar = {
  nav: {
    approvals: 'الموافقات',
    approvalsPendingCount: '{n} طلبات بانتظار الموافقة',
    payouts: 'المدفوعات',
    settlementImports: 'استيراد التسويات',
  },
  screens: {
    titleApprovals: 'الموافقات',
    notesApprovals:
      'قائمة الموافقات (منشئ ومراجع). كل إجراء مالي ينتظر هنا حتى يوافق عليه مدير آخر أو يرفضه. استخدم "العمل كمدير آخر" لرؤية جانب المراجع.',
    titlePayouts: 'المدفوعات',
    notesPayouts:
      'دفعات المدفوعات. أنشئ دفعة من الأرباح التي تجاوزت فترة الانتظار ٧ أيام، ثم وافق عليها وصدّر ملف البنك واستورد النتيجة.',
    titlePayoutBatch: 'دفعة مدفوعات',
    notesPayoutBatch:
      'دفعة واحدة: بنودها وملف البنك وملف النتيجة الذي يعيده فريق المالية. تُفتح من صفحة المدفوعات.',
    titleSettlementImports: 'استيراد التسويات',
    notesSettlementImports:
      'ارفع ملف التسويات من فريق المالية. تتم مطابقة كل صف بالرقم القومي والتحقق منه قبل إرساله للموافقة.',
  },
};
