/**
 * i18n/kit-balances.js — strings added in the v22-09 kit port (2026-10-14).
 *
 * The two balance lists and their new, separate ledger pages
 * (driver-balance-details.html, rider-balance-details.html). Arabic wording
 * follows the kit's own `_ar.html` pages. Anything already worded in
 * `balances.*`, `riderBalances.*`, `balancesFinance.*` or
 * `riderBalancesFinance.*` is reused from there, not copied.
 */

export const en = {
  kitBalances: {
    // Driver balances list
    kpiDebtors: 'Debtor drivers',
    kpiOutstanding: 'Total outstanding',
    kpiPayables: 'Driver payables',
    kpiBlocked: 'Online blocked',
    driverSearchPlaceholder: 'Driver name or phone',
    filterAll: 'All',
    filterDebtors: 'Debtor drivers',
    filterPayables: 'Driver payables',
    filterSettled: 'No balance due',
    goActive: 'Active',
    goBlocked: 'Blocked',
    ledgerButton: 'Ledger',

    // Driver ledger page
    ledgerCrumb: 'Ledger',
    ledgerFor: 'Ledger — {name}',
    kpiBalance: 'Total balance',
    driverNotFoundHeading: 'Driver not found',
    driverNotFoundMessage: 'There is no driver with this id. Open her ledger from Driver balances.',
    backToDriverBalances: 'Back to driver balances',
    loadErrorHeading: 'The ledger could not be loaded',
    payoutModalTitle: 'Record payout',
    settleModalTitle: 'Record settlement',
    destination: '{method} destination · {details}',
    noDestination: 'No payout method on file — she is left out of every batch until one is added.',
    uploadPrompt: 'Press to upload the receipt, or drop it here',
    uploadLimits: 'JPG or PNG • Maximum file size 5 MB',
    removeFile: 'Remove the file',
    sentTitle: 'Sent for approval',
    sentMessage: 'A Financial lead must approve it. Nothing changes on her ledger until then.',

    // Rider balances list
    kpiRiderOutstanding: 'Total outstanding',
    kpiRidersDue: 'Riders with fees due',
    riderSearchPlaceholder: 'Rider name or phone',
    filterRiderDue: 'Rider fees due',
    colPhone: 'Phone',
    colLastFeeDate: 'Last fee date',

    // Rider ledger page
    kpiOutstandingBalance: 'Outstanding balance',
    kpiCredit: 'Credit',
    creditMeta: 'Shown on her account, not used this phase',
    breakdownHeading: 'Outstanding breakdown',
    riderNotFoundHeading: 'Rider not found',
    riderNotFoundMessage: 'There is no rider with this id. Open her ledger from Rider balances.',
    backToRiderBalances: 'Back to rider balances',
    waiveModalTitle: 'Waive fee —',
    waiveIntro: 'This fee is {amount} (trip {trip}). Waiving it needs a reason.',
    waiveButton: 'Waive fee',
    waiveReasonPlaceholder: 'Type a reason ...',
    waiverSentMessage:
      "A Financial lead must approve it. The fee and the driver's share stay as they are until then.",
  },
};

export const ar = {
  kitBalances: {
    kpiDebtors: 'السائقات المدينات',
    kpiOutstanding: 'إجمالي المستحقات',
    kpiPayables: 'مستحقات السائقات',
    kpiBlocked: 'الموقوفات عن الاتصال',
    driverSearchPlaceholder: 'اسم السائقة أو رقم الهاتف',
    filterAll: 'الكل',
    filterDebtors: 'السائقات المدينات',
    filterPayables: 'مستحقات السائقات',
    filterSettled: 'لا يوجد رصيد مستحق',
    goActive: 'نشط',
    goBlocked: 'محظور',
    ledgerButton: 'السجل',

    ledgerCrumb: 'السجل',
    ledgerFor: 'سجل — {name}',
    kpiBalance: 'إجمالي الرصيد',
    driverNotFoundHeading: 'لم يتم العثور على السائقة',
    driverNotFoundMessage: 'لا توجد سائقة بهذا المعرّف. افتحي سجلها من أرصدة السائقات.',
    backToDriverBalances: 'العودة إلى أرصدة السائقات',
    loadErrorHeading: 'تعذّر تحميل السجل',
    payoutModalTitle: 'تسجيل دفعة',
    settleModalTitle: 'تسجيل تسوية',
    destination: 'وجهة {method} · {details}',
    noDestination: 'لا توجد وسيلة صرف مسجّلة — تُستبعد من كل الدفعات حتى تُضاف وسيلة.',
    uploadPrompt: 'إضغط لرفع الإيصال ، أو اسحبه هنا',
    uploadLimits: 'JPG أو PNG • الحجم الأقصى 5 ميجابايت',
    removeFile: 'إزالة الملف',
    sentTitle: 'أُرسل للموافقة',
    sentMessage: 'يجب أن يوافق عليه رئيس فريق مالي. لا يتغيّر شيء في سجلها قبل ذلك.',

    kpiRiderOutstanding: 'إجمالي المبالغ المستحقة',
    kpiRidersDue: 'رسوم الركاب المستحقة',
    riderSearchPlaceholder: 'إسم الراكبة ، رقم الهاتف ...',
    filterRiderDue: 'رسوم الراكب المستحقة',
    colPhone: 'رقم الهاتف',
    colLastFeeDate: 'تاريخ آخر رسوم',

    kpiOutstandingBalance: 'الرصيد المستحق',
    kpiCredit: 'الرصيد الدائن',
    creditMeta: 'يظهر في حسابها، ولا يُستخدم في هذه المرحلة',
    breakdownHeading: 'تفاصيل المبالغ المستحقة',
    riderNotFoundHeading: 'لم يتم العثور على الراكبة',
    riderNotFoundMessage: 'لا توجد راكبة بهذا المعرّف. افتحي سجلها من أرصدة الراكبات.',
    backToRiderBalances: 'العودة إلى أرصدة الراكبات',
    waiveModalTitle: 'إعفاء من الرسوم —',
    waiveIntro: 'قيمة هذا الرسم {amount} (الرحلة {trip}). يتطلب الإعفاء ذكر سبب.',
    waiveButton: 'إعفاء من الرسوم',
    waiveReasonPlaceholder: 'اكتبي السبب ...',
    waiverSentMessage: 'يجب أن يوافق عليه رئيس فريق مالي. يبقى الرسم وحصة السائقة كما هما حتى ذلك الحين.',
  },
};
