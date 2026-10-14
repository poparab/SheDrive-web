/**
 * i18n/finance-edits.js — strings for this area (2026-10-14 finance screens).
 *
 * The maker-checker edits to the two existing balance screens (spec
 * 2026-10-14 §1, §3, §5). `balances.*` and `riderBalances.*` in lists.js stay
 * as they are; anything that changed meaning lives here under its own key.
 */

export const en = {
  balancesFinance: {
    lead:
      'On cash trips the driver keeps the fare and owes the platform its commission. ' +
      'Record what she hands in to clear it. When her balance is positive, SheDrive owes ' +
      'her — her earnings are paid in batches once their 7-day hold ends. A settlement or ' +
      'a manual payout is a request: nothing posts to her ledger until another admin approves it.',
    needsApproval: "Needs another admin's approval — her balance does not change until then.",
    payoutDescription:
      'SheDrive owes her {amount}. Use this only for a one-off transfer Finance has already ' +
      'sent outside a batch.',
    sentForApproval: 'Sent for approval — another admin must approve it.',
    openRequest: 'Open the request',
    pendingSettlement: 'Settlement awaiting approval (by {maker}, {time})',
    pendingPayout: 'Payout awaiting approval (by {maker}, {time})',
    chipAwaitingApproval: 'Awaiting approval',
    payoutsLink: 'Payouts are paid in batches',
    payoutMethodLabel: 'Payout method',
    noPayoutMethod: 'No payout method',
    typeMOBILE_WALLET: 'Mobile wallet',
    typeBANK_ACCOUNT: 'Bank account',
    typePREPAID_CARD: 'Prepaid card',
    lastPayoutFailed: 'Last payout failed: {reason} — batch {batchId}',
    viewBatch: 'View batch',
    statOnHold: 'On hold',
    statDue: 'Due',
    statInBatch: 'In a batch',
    statSent: 'Sent to bank',
    colPayout: 'Payout',
    statusOnHold: 'On hold until {date}',
    statusReversed: 'Reversed — fee waived',
    statusDue: 'Due',
    statusInBatch: 'In a batch',
    statusSent: 'Sent to bank',
    statusPaid: 'Paid',
    entryFeeCreditReversed: 'Rider fee waived — share reversed',
  },

  riderBalancesFinance: {
    lead:
      'A rider who cancels after the grace period owes a fee. It is recovered as a surcharge ' +
      'on her next cash trip. An admin can waive one fee with a reason — the waiver needs ' +
      "another admin's approval, and the driver's share of the fee is removed with it. " +
      'Persistent abuse is a human decision, handled from her profile.',
    filterCredit: 'Has a credit',
    colCredit: 'Credit (EGP)',
    statCredit: 'Credit',
    creditNote: 'Credit {amount} — shown on her account, not used this phase',
    colAction: 'Action',
    waive: 'Waive fee',
    waived: 'Waived',
    waiverPending: 'Waiver awaiting approval',
    entryFeeWaived: 'Fee waived',
    waiveTitle: 'Waive fee — {name}',
    waiveDescription:
      "The driver's share of this fee is removed too. Needs another admin's approval.",
    waiveAmount: 'Fee amount',
    waiveTrip: 'Trip',
    waiveReason: 'Reason',
    waiveReasonHint: '10–500 characters. The approving admin reads this.',
    errReasonEmpty: 'Enter a reason',
    errReasonLength: 'Reason must be 10–500 characters',
    waiveConfirm: 'Send for approval',
    sentForApproval: 'Sent for approval — another admin must approve it.',
    openRequest: 'Open the request',
  },
};

export const ar = {
  balancesFinance: {
    lead:
      'في الرحلات النقدية تحتفظ السائقة بالأجرة وتدين للمنصة بعمولتها. ' +
      'سجّلي ما تسلّمينه منها لتسوية الرصيد. وعندما يكون رصيدها موجباً، فشي درايف مدينة لها — ' +
      'وتُصرف أرباحها على دفعات بعد انتهاء فترة الانتظار ٧ أيام. التسوية والدفعة اليدوية طلبان: ' +
      'لا يُقيَّد شيء في كشف حسابها حتى يوافق عليه مدير آخر.',
    needsApproval: 'يحتاج إلى موافقة مدير آخر — لا يتغيّر رصيدها قبل ذلك.',
    payoutDescription:
      'شي درايف مدينة لها بـ {amount}. استخدمي هذا فقط لتحويل استثنائي أرسلته إدارة المالية ' +
      'فعلياً خارج الدفعات.',
    sentForApproval: 'أُرسل للموافقة — يجب أن يوافق عليه مدير آخر.',
    openRequest: 'فتح الطلب',
    pendingSettlement: 'تسوية بانتظار الموافقة (من {maker}، {time})',
    pendingPayout: 'دفعة بانتظار الموافقة (من {maker}، {time})',
    chipAwaitingApproval: 'بانتظار الموافقة',
    payoutsLink: 'تُصرف المستحقات على دفعات',
    payoutMethodLabel: 'وسيلة الصرف',
    noPayoutMethod: 'لا توجد وسيلة صرف',
    typeMOBILE_WALLET: 'محفظة إلكترونية',
    typeBANK_ACCOUNT: 'حساب بنكي',
    typePREPAID_CARD: 'بطاقة مسبقة الدفع',
    lastPayoutFailed: 'فشلت آخر دفعة: {reason} — الدفعة {batchId}',
    viewBatch: 'عرض الدفعة',
    statOnHold: 'قيد الانتظار',
    statDue: 'مستحقة',
    statInBatch: 'ضمن دفعة',
    statSent: 'أُرسلت إلى البنك',
    colPayout: 'الصرف',
    statusOnHold: 'قيد الانتظار حتى {date}',
    statusReversed: 'ملغاة — تم الإعفاء من الرسوم',
    statusDue: 'مستحقة',
    statusInBatch: 'ضمن دفعة',
    statusSent: 'أُرسلت إلى البنك',
    statusPaid: 'مدفوعة',
    entryFeeCreditReversed: 'إعفاء الراكبة من الرسم — عكس حصة السائقة',
  },

  riderBalancesFinance: {
    lead:
      'الراكبة التي تُلغي بعد فترة السماح مدينة برسوم، تُسترد كرسم إضافي على رحلتها النقدية ' +
      'التالية. يمكن للمدير الإعفاء من رسم واحد مع ذكر السبب — ويحتاج الإعفاء إلى موافقة مدير آخر، ' +
      'وتُلغى معه حصة السائقة من الرسم. إساءة الاستخدام المتكررة قرار بشري، يُدار من صفحة ملفها الشخصي.',
    filterCredit: 'لديها رصيد دائن',
    colCredit: 'الرصيد الدائن (جم)',
    statCredit: 'الرصيد الدائن',
    creditNote: 'رصيد دائن {amount} — يظهر في حسابها، ولا يُستخدم في هذه المرحلة',
    colAction: 'إجراء',
    waive: 'إعفاء من الرسم',
    waived: 'تم الإعفاء',
    waiverPending: 'إعفاء بانتظار الموافقة',
    entryFeeWaived: 'إعفاء من رسم',
    waiveTitle: 'إعفاء من الرسم — {name}',
    waiveDescription: 'تُلغى حصة السائقة من هذا الرسم أيضاً. يحتاج إلى موافقة مدير آخر.',
    waiveAmount: 'مبلغ الرسم',
    waiveTrip: 'الرحلة',
    waiveReason: 'السبب',
    waiveReasonHint: 'من 10 إلى 500 حرف. يقرؤه المدير الذي يوافق على الطلب.',
    errReasonEmpty: 'أدخل السبب',
    errReasonLength: 'يجب أن يكون السبب من 10 إلى 500 حرف',
    waiveConfirm: 'إرسال للموافقة',
    sentForApproval: 'أُرسل للموافقة — يجب أن يوافق عليه مدير آخر.',
    openRequest: 'فتح الطلب',
  },
};
