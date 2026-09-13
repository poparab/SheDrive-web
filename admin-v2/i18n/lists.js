/**
 * i18n/lists.js — strings for the list screens — trips, driver applications, drivers, riders, safety reports, audit log, admin users.
 *
 * Same shape as core.js: export `en` and `ar` objects of namespaces.
 * Namespaces merge across area files, so extending an existing namespace here
 * is fine — just do not restate a key core.js already owns.
 *
 * Screen headings, statuses, "Name", "Phone number", "Status", "Email",
 * "Actions", "All", "Export CSV" and every status word come from core.js —
 * only what a list screen adds on top of that vocabulary lives here.
 *
 * Arabic follows the delivered kit's own `*_ar.html` list pages (رقم الرحلة،
 * مكان الالتقاط، الأجرة (جم)، تاريخ التقديم، تاريخ التسجيل، عدد الرحلات …) and
 * uses female forms for drivers and riders, the service being women-only.
 *
 * CSV file-name stems stay Latin in both languages: the file is opened in
 * Excel and cross-referenced against the same systems the ids come from.
 */

export const en = {
  trips: {
    heading: 'All trips',
    hint:
      'The status filter maps onto the trip state machine: Searching, Active (matched ' +
      'through trip started), Completed, and Expired. Click a row for the full state ' +
      'timeline.',
    statsLabel: 'Trips summary',

    searchLabel: 'Rider or driver — name, phone, or trip ID',
    searchPlaceholder: 'e.g. Salma, 1002, TRP-24011',

    colTripId: 'Trip ID',
    colRider: 'Rider',
    colDriver: 'Driver',
    colPickup: 'Pickup area',
    colDestination: 'Destination area',
    colFare: 'Fare (EGP)',

    notAssigned: 'Not assigned',
    estimate: '{value} est.',

    emptyHeading: 'No trips match these filters',
    emptyMessage: 'Widen the date range or clear the status filter.',

    statTotal: 'Total trips',
    statActive: 'Active now',

    csvRiderPhone: 'Rider phone',
    csvDriverPhone: 'Driver phone',
    csvDate: 'Date (UTC+2)',
    csvFile: 'shedrive-trips',
  },

  applications: {
    hint:
      'Every application — pending, approved and rejected. Sorted oldest first, because ' +
      'the pending ones are a work queue. Filter by outcome to review decisions already ' +
      'made. The badge always counts what is still awaiting review.',
    statsLabel: 'Driver applications summary',

    searchLabel: 'Driver name or phone',
    searchPlaceholder: 'e.g. Nour or 1002',
    outcomeLabel: 'Application outcome',
    optAll: 'All applications',

    colDriverName: 'Driver name',
    colSubmitted: 'Submission date',
    colView: 'View application',

    waiting: 'waiting {duration}',
    linkReview: 'Review →',
    linkView: 'View →',
    badge: '{count} awaiting review',

    emptyHeading: 'No applications match these filters',
    emptyMessage: 'Clear the outcome filter or widen the date range.',

    statTotal: 'Total applications',

    csvReason: 'Decision reason',
    csvFile: 'shedrive-driver-applications',
  },

  drivers: {
    heading: 'All drivers',
    hint:
      'Every driver account regardless of status. Approve and reject happen on the ' +
      "applications queue; suspend and reinstate happen on a driver's profile.",
    statsLabel: 'Drivers summary',

    searchLabel: 'Name or phone',
    searchPlaceholder: 'e.g. Mariam or 1102',

    colSubmitted: 'Onboarding submission date',
    colTrips: 'Total trips',

    emptyHeading: 'No drivers match these filters',
    emptyMessage: 'Clear the status filter or widen the search.',

    statTotal: 'Total drivers',
    statOnline: 'Online now',

    csvRating: 'Average rating',
    csvCash: 'Outstanding cash balance (EGP)',
    csvFile: 'shedrive-drivers',
  },

  riders: {
    heading: 'All riders',
    hint:
      'Open a rider to view her trip history and take account actions. Riders held in ' +
      'Pending review were flagged automatically by a gender-mismatch report.',
    statsLabel: 'Riders summary',

    searchLabel: 'Name or phone',
    searchPlaceholder: 'e.g. Salma or 1005',
    accountStatus: 'Account status',

    colRegistered: 'Registration date',
    colTrips: 'Total trips completed',

    emptyHeading: 'No riders match these filters',
    emptyMessage: 'Clear the status filter or widen the search.',

    statTotal: 'Total riders',
  },

  safety: {
    pageTitle: 'Gender-mismatch reports',
    heading: 'Report queue',
    hint:
      'SheDrive is women-only. When a driver reports that the rider who arrived was not ' +
      'female, the trip is expired and the rider is held in Pending review automatically. ' +
      'Oldest first — open a report to review it and resolve.',
    statsLabel: 'Safety reports summary',

    statusLabel: 'Report status',
    timeLabel: 'Report time',

    colReportedRider: 'Reported rider',
    colReportedRiderPhone: 'Reported rider phone',
    colReportingDriver: 'Reporting driver',
    colTripId: 'Trip ID',
    colRiderStatus: 'Rider account status',

    badgeOpen: '{count} open',
    badgeShown: '{count} shown',

    emptyHeading: 'No reports need triage',
    emptyMessage: 'There are no gender-mismatch reports matching these filters.',

    statTotal: 'Total reports',

    csvReportId: 'Report id',
    csvTime: 'Report time (UTC+2)',
    csvFile: 'shedrive-gender-mismatch-reports',
  },

  sos: {
    pageTitle: 'SOS requests',
    heading: 'Case queue',
    hint:
      'An SOS is raised from inside an active trip by the rider or the driver. The other ' +
      'occupant is never told, and the trip runs on and settles as normal. Open cases first ' +
      '— only an admin closes a case.',
    statsLabel: 'SOS cases summary',

    statusLabel: 'Case status',
    raisedByLabel: 'Raised by',
    timeLabel: 'Raised at',

    colRaisedBy: 'Raised by',
    colRaiserName: 'Name',
    colTripId: 'Trip ID',
    colTripState: 'Trip state at trigger',
    colLocation: 'Location',
    colContacts: 'Contacts alerted',
    colOutcome: 'Outcome',

    rider: 'Rider',
    driver: 'Driver',
    allRaisers: 'Anyone',
    contactsCount: '{count} alerted',
    contactsFailed: '{count} alerted · {failed} failed',

    badgeOpen: '{count} open',
    badgeShown: '{count} shown',

    emptyHeading: 'No SOS cases need review',
    emptyMessage: 'There are no SOS cases matching these filters.',

    statTotal: 'Total cases',

    csvCaseId: 'Case id',
    csvTime: 'Raised at (UTC+2)',
    csvFile: 'shedrive-sos-requests',
  },

  audit: {
    pageTitle: 'Admin activity audit log',
    heading: 'Audit entries',
    hint:
      'Every state-changing admin action is recorded immutably. This log is read-only. ' +
      'Pricing changes keep their dedicated log (#1760) and are cross-linked here.',

    targetLabel: 'Target entity or id',
    targetPlaceholder: 'e.g. driver, TRP-24011',
    actorLabel: 'Actor',
    actorAll: 'All actors',
    actionLabel: 'Action type',
    timestampLabel: 'Timestamp (UTC+2)',

    colTarget: 'Target entity & id',
    colDiff: 'Before / after values',
    changedTo: 'changed to',

    emptyHeading: 'No audit entries match these filters',
    emptyMessage: 'Widen the date range or clear the actor and action-type filters.',

    // Enum labels. The English side reproduces exactly what `humanize()`
    // produced before this pass, so no visible English string changed.
    action: {
      approve: 'Approve',
      reject: 'Reject',
      suspend: 'Suspend',
      reinstate: 'Reinstate',
      cancel: 'Cancel',
      reassign: 'Reassign',
      refund: 'Refund',
      settlement: 'Settlement',
      'gender-mismatch resolution': 'Gender Mismatch Resolution',
      'sos case closed': 'SOS Case Closed',
      'admin-account change': 'Admin Account Change',
    },
    target: {
      driver: 'Driver',
      rider: 'Rider',
      safety_report: 'Safety Report',
      zone: 'Zone',
      admin: 'Admin',
      trip: 'Trip',
    },
    field: {
      status: 'Status',
      reason: 'Reason',
      resolution: 'Resolution',
      baseFare: 'BaseFare',
      refunded: 'Refunded',
      exists: 'Exists',
      email: 'Email',
    },
  },

  adminUsers: {
    pageTitle: 'Admin user accounts',
    heading: 'Admin accounts',
    hint:
      'Every account has full super-admin privileges in this phase. A new account must ' +
      'enrol two-factor authentication and change its password at first sign-in.',
    addButton: 'Add admin user',

    searchPlaceholder: 'e.g. finance',

    colCreated: 'Created date',
    colLastLogin: 'Last login',

    neverSignedIn: 'Never signed in',
    noteYou: 'you',
    note2fa: '2FA not enrolled',

    disable: 'Disable',
    enable: 'Enable',
    cannotDisableSelf: 'You cannot disable your own account',

    disableTitle: 'Disable this admin account?',
    enableTitle: 'Enable this admin account?',
    disableDescription:
      '{email} will be signed out and unable to access the portal until re-enabled.',
    enableDescription: '{email} will be able to sign in again.',
    disableConfirm: 'Disable account',
    enableConfirm: 'Enable account',
    disabledToast: '{email} disabled.',
    enabledToast: '{email} enabled.',

    addTitle: 'Add an admin user',
    addDescription:
      'The account is created active. She must enrol 2FA and set her own password at first sign-in.',
    addConfirm: 'Create account',
    emailPlaceholder: 'name@shedrive.app',
    emailEmptyError: 'Enter an email address',
    emailInvalidError: 'Invalid email address',
    emailLengthError: 'Email must be ≤ 254 characters',
    roleValue: 'Super admin — the only role in this phase',
    createdToast: 'Admin account created for {email}.',

    emptyHeading: 'No admin accounts match these filters',
    emptyMessage: 'Clear the status filter or widen the search.',
  },

  balances: {
    heading: 'Driver balances',
    lead:
      'On cash trips the driver keeps the fare and owes the platform its commission. ' +
      'Record what she hands in to clear it — a settlement posts to her ledger and ' +
      'unblocks her go-online immediately. When her balance is positive, SheDrive owes ' +
      'her — record a payout once Finance has already sent it.',
    cardOwing: 'Drivers owing the platform',
    cardOutstanding: 'Total outstanding',
    cardOwed: 'Drivers we owe',
    cardBlocked: 'Blocked from going online',
    limitMeta: 'Limit {limit}',
    limitDisabled: 'Limit disabled',
    filterBalance: 'Balance',
    owing: 'Owing the platform',
    owed: 'Owed by the platform',
    settled: 'Settled (zero)',
    colOutstanding: 'Outstanding (EGP)',
    colAvailable: 'Available (EGP)',
    colLastSettlement: 'Last settlement',
    colGoOnline: 'Go-online',
    blocked: 'Blocked',
    allowed: 'Allowed',
    ledger: 'Ledger',
    ledgerFor: 'Ledger — {name}',
    emptyHeading: 'No drivers match',
    emptyMessage: 'No driver has a balance in this category right now.',
    ledgerEmptyHeading: 'No transactions',
    ledgerEmptyMessage: 'This driver has no balance movements yet.',
    statBalance: 'Balance',
    statOutstanding: 'Outstanding',
    statAvailable: 'Available',
    colDate: 'Date',
    colType: 'Type',
    colAmount: 'Amount (EGP)',
    colSource: 'Source',
    colNote: 'Note',
    recordSettlement: 'Record settlement',
    recordPayout: 'Record payout',
    close: 'Close',
    settleTitle: 'Record settlement — {name}',
    settleDescription:
      'She owes {amount}. Recording a settlement credits her ledger and reduces what she owes.',
    settleAmount: 'Settlement amount (EGP)',
    settleDate: 'Settlement date',
    settleMethod: 'Settlement method',
    settleNote: 'Note',
    settleDone: 'Settlement recorded.',
    errAmountEmpty: 'Enter a settlement amount',
    errAmountInvalid: 'Enter a valid amount',
    errAmountRange: 'Amount must be greater than 0 and not exceed {max}',
    errDateEmpty: 'Enter the settlement date',
    errDateInvalid: 'Invalid date format',
    errDateFuture: 'Date cannot be in the future',
    errMethodEmpty: 'Select a settlement method',
    errNoteLength: 'Note must be 500 characters or fewer',
    csvName: 'shedrive-driver-balances',
    csvBlockedYes: 'Yes',
    csvBlockedNo: 'No',
    exportSettlementsCsv: 'Export settlements CSV',
    settlementsCsvName: 'shedrive-settlements',
    settlementsColReference: 'Reference',
    settlementsColReceipt: 'Receipt number',
    settlementsColAdmin: 'Recorded by',
    settlementsColTime: 'Time',
    entryTripCommission: 'Trip commission',
    entryTripEarnings: 'Trip earnings',
    entryDriverCancellationFee: 'Driver cancellation fee',
    entryRiderCancellationFeeShare: 'Rider cancellation fee share',
    entrySettlement: 'Settlement received',
    entryPayout: 'Payout sent',
    payoutTitle: 'Record payout — {name}',
    payoutDescription:
      'SheDrive owes her {amount}. Recording a payout writes down a transfer Finance has ' +
      'already sent — there is nothing to approve.',
    payoutDestination: 'Destination on file',
    payoutNoDestination: 'No payout destination on file',
    payoutDestBankTransfer: 'Bank transfer',
    payoutDestMobileWallet: 'Mobile wallet',
    payoutNoDestinationHint: 'No payout destination on file.',
    payoutAmount: 'Payout amount (EGP)',
    payoutDate: 'Payout date',
    payoutReference: 'Reference',
    payoutDone: 'Payout recorded.',
    errPayoutAmountEmpty: 'Enter a payout amount',
    errPayoutAmountInvalid: 'Enter a valid amount',
    errPayoutAmountRange: 'Amount must be greater than 0 and not exceed {max}',
    errPayoutDateEmpty: 'Enter the payout date',
    errPayoutDateInvalid: 'Invalid date format',
    errPayoutDateFuture: 'Date cannot be in the future',
    errPayoutReferenceEmpty: 'Enter a payout reference',
    errPayoutReferenceLength: 'Reference must be 60 characters or fewer',
  },

  riderBalances: {
    heading: 'Rider balances',
    lead:
      'A rider who cancels after the grace period owes a fee, recovered as a surcharge on ' +
      'her next cash trip. Waive it with a reason — that posts an immutable entry, never ' +
      'edits an existing one.',
    cardOwing: 'Riders owing a fee',
    cardOutstanding: 'Total outstanding',
    cardFullRecovery: 'Riders at full recovery',
    thresholdMeta: 'Threshold {limit}',
    thresholdDisabled: 'Escalation off',
    filterBalance: 'Balance',
    owing: 'Owing a fee',
    colOutstanding: 'Outstanding (EGP)',
    colLastFee: 'Last fee',
    colRecovery: 'Next ride recovers',
    fullRecovery: 'Whole balance',
    singleFee: 'Oldest fee',
    ledger: 'Ledger',
    ledgerFor: 'Ledger — {name}',
    emptyHeading: 'No riders match',
    emptyMessage: 'No rider has an outstanding fee in this category right now.',
    ledgerEmptyHeading: 'No transactions',
    ledgerEmptyMessage: 'This rider has no fee movements yet.',
    statOutstanding: 'Outstanding',
    statRecovery: 'Next ride recovers',
    colDate: 'Date',
    colType: 'Type',
    colAmount: 'Amount (EGP)',
    colSource: 'Trip',
    colNote: 'Note',
    waiveFee: 'Waive fee',
    close: 'Close',
    waiveTitle: 'Waive fee — {name}',
    waiveDescription:
      'She owes {amount}. Waiving posts a credit for the full amount and requires a reason.',
    waiveReason: 'Reason',
    waiveDone: 'Fee waived.',
    errReasonEmpty: 'Enter a reason',
    errReasonLength: 'Reason must be between 10 and 500 characters',
    csvName: 'shedrive-rider-balances',
    csvFullYes: 'Whole balance',
    csvFullNo: 'Oldest fee',
    entryCancellationFee: 'Cancellation fee',
    entryFeeCollected: 'Fee collected',
    entryFeeWaived: 'Fee waived',
  },

};

export const ar = {
  trips: {
    heading: 'كل الرحلات',
    hint:
      'يرتبط عامل تصفية الحالة بدورة حياة الرحلة: جارٍ البحث، ونشطة (من التطابق حتى بدء ' +
      'الرحلة)، ومكتملة، ومنتهية. اضغطي على أي صف لعرض المسار الزمني الكامل للحالة.',
    statsLabel: 'ملخص الرحلات',

    searchLabel: 'الراكبة أو السائقة — الاسم أو رقم الهاتف أو رقم الرحلة',
    searchPlaceholder: 'مثال: سلمى، 1002، TRP-24011',

    colTripId: 'رقم الرحلة',
    colRider: 'الراكبة',
    colDriver: 'السائقة',
    colPickup: 'مكان الالتقاط',
    colDestination: 'مكان الوجهة',
    colFare: 'الأجرة (جم)',

    notAssigned: 'غير مُسندة',
    estimate: '{value} تقديري',

    emptyHeading: 'لا توجد رحلات مطابقة لعوامل التصفية',
    emptyMessage: 'وسّعي النطاق الزمني أو امسحي عامل تصفية الحالة.',

    statTotal: 'إجمالي الرحلات',
    statActive: 'نشطة الآن',

    csvRiderPhone: 'هاتف الراكبة',
    csvDriverPhone: 'هاتف السائقة',
    csvDate: 'التاريخ (UTC+2)',
    csvFile: 'shedrive-trips',
  },

  applications: {
    hint:
      'كل الطلبات — قيد الانتظار والمقبولة والمرفوضة. مرتّبة من الأقدم إلى الأحدث لأن ' +
      'الطلبات المعلّقة تمثّل قائمة عمل. صفّي حسب النتيجة لمراجعة القرارات التي اتُّخذت ' +
      'بالفعل. تعرض الشارة دائمًا عدد الطلبات التي ما زالت بانتظار المراجعة.',
    statsLabel: 'ملخص طلبات السائقات',

    searchLabel: 'اسم السائقة أو رقم الهاتف',
    searchPlaceholder: 'مثال: نور أو 1002',
    outcomeLabel: 'نتيجة الطلب',
    optAll: 'كل الطلبات',

    colDriverName: 'اسم السائقة',
    colSubmitted: 'تاريخ التقديم',
    colView: 'عرض الطلب',

    waiting: 'بانتظار {duration}',
    linkReview: 'مراجعة ←',
    linkView: 'عرض ←',
    badge: '{count} بانتظار المراجعة',

    emptyHeading: 'لا توجد طلبات مطابقة لعوامل التصفية',
    emptyMessage: 'امسحي عامل تصفية النتيجة أو وسّعي النطاق الزمني.',

    statTotal: 'إجمالي الطلبات',

    csvReason: 'سبب القرار',
    csvFile: 'shedrive-driver-applications',
  },

  drivers: {
    heading: 'كل السائقات',
    hint:
      'كل حسابات السائقات على اختلاف حالاتها. يتم القبول والرفض من قائمة الطلبات، بينما ' +
      'يتم الإيقاف وإعادة التفعيل من الملف الشخصي للسائقة.',
    statsLabel: 'ملخص السائقات',

    searchLabel: 'الاسم أو رقم الهاتف',
    searchPlaceholder: 'مثال: مريم أو 1102',

    colSubmitted: 'تاريخ تقديم طلب الانضمام',
    colTrips: 'إجمالي الرحلات',

    emptyHeading: 'لا توجد سائقات مطابقات لعوامل التصفية',
    emptyMessage: 'امسحي عامل تصفية الحالة أو وسّعي نطاق البحث.',

    statTotal: 'إجمالي السائقات',
    statOnline: 'متصلات الآن',

    csvRating: 'متوسط التقييم',
    csvCash: 'الرصيد النقدي المستحق (جم)',
    csvFile: 'shedrive-drivers',
  },

  riders: {
    heading: 'كل الراكبات',
    hint:
      'افتحي ملف الراكبة لعرض سجل رحلاتها واتخاذ الإجراءات على حسابها. الراكبات ' +
      'الموضوعات قيد المراجعة تم تعليمهنّ تلقائيًا بناءً على بلاغ عدم تطابق الجنس.',
    statsLabel: 'ملخص الراكبات',

    searchLabel: 'الاسم أو رقم الهاتف',
    searchPlaceholder: 'مثال: سلمى أو 1005',
    accountStatus: 'حالة الحساب',

    colRegistered: 'تاريخ التسجيل',
    colTrips: 'إجمالي الرحلات المكتملة',

    emptyHeading: 'لا توجد راكبات مطابقات لعوامل التصفية',
    emptyMessage: 'امسحي عامل تصفية الحالة أو وسّعي نطاق البحث.',

    statTotal: 'إجمالي الراكبات',
  },

  safety: {
    pageTitle: 'بلاغات عدم تطابق الجنس',
    heading: 'قائمة البلاغات',
    hint:
      'شي درايف خدمة مخصّصة للنساء فقط. عندما تُبلّغ السائقة بأن الراكبة التي حضرت ليست ' +
      'أنثى، تُنهى الرحلة وتوضع الراكبة قيد المراجعة تلقائيًا. الترتيب من الأقدم — افتحي ' +
      'البلاغ لمراجعته ومعالجته.',
    statsLabel: 'ملخص تقارير السلامة',

    statusLabel: 'حالة البلاغ',
    timeLabel: 'وقت البلاغ',

    colReportedRider: 'الراكبة المُبلَّغ عنها',
    colReportedRiderPhone: 'هاتف الراكبة المُبلَّغ عنها',
    colReportingDriver: 'السائقة المُبلِّغة',
    colTripId: 'رقم الرحلة',
    colRiderStatus: 'حالة حساب الراكبة',

    badgeOpen: '{count} مفتوح',
    badgeShown: '{count} معروض',

    emptyHeading: 'لا توجد بلاغات تحتاج إلى مراجعة',
    emptyMessage: 'لا توجد بلاغات عدم تطابق جنس مطابقة لعوامل التصفية.',

    statTotal: 'إجمالي البلاغات',

    csvReportId: 'رقم البلاغ',
    csvTime: 'وقت البلاغ (UTC+2)',
    csvFile: 'shedrive-gender-mismatch-reports',
  },

  sos: {
    pageTitle: 'طلبات الطوارئ',
    heading: 'قائمة الحالات',
    hint:
      'يُرسل طلب الطوارئ من داخل رحلة جارية من الراكبة أو السائقة. ' +
      'لا يُبلَّغ الطرف الآخر إطلاقًا، وتستمر الرحلة وتُحتسب كالمعتاد. ' +
      'الحالات المفتوحة أولاً — ولا يغلق الحالة إلاّ المسؤول.',
    statsLabel: 'ملخص حالات الطوارئ',

    statusLabel: 'حالة الطلب',
    raisedByLabel: 'مقدّمة من',
    timeLabel: 'وقت الطلب',

    colRaisedBy: 'مقدّمة من',
    colRaiserName: 'الاسم',
    colTripId: 'رقم الرحلة',
    colTripState: 'حالة الرحلة عند الطلب',
    colLocation: 'الموقع',
    colContacts: 'جهات الاتصال المُخطَرة',
    colOutcome: 'النتيجة',

    rider: 'الراكبة',
    driver: 'السائقة',
    allRaisers: 'الجميع',
    contactsCount: '{count} مُخطَرة',
    contactsFailed: '{count} مُخطَرة · {failed} فشلت',

    badgeOpen: '{count} مفتوح',
    badgeShown: '{count} معروض',

    emptyHeading: 'لا توجد حالات طوارئ تحتاج إلى مراجعة',
    emptyMessage: 'لا توجد حالات طوارئ مطابقة لعوامل التصفية.',

    statTotal: 'إجمالي الحالات',

    csvCaseId: 'رقم الحالة',
    csvTime: 'وقت الطلب (UTC+2)',
    csvFile: 'shedrive-sos-requests-ar',
  },

  audit: {
    pageTitle: 'سجل تدقيق نشاط المديرين',
    heading: 'سجلات التدقيق',
    hint:
      'يُسجَّل كل إجراء إداري يغيّر الحالة تسجيلًا غير قابل للتعديل. هذا السجل للقراءة ' +
      'فقط. تحتفظ تغييرات الأسعار بسجلّها المخصّص (#1760) وتُربط هنا.',

    targetLabel: 'الكيان المستهدف أو المعرّف',
    targetPlaceholder: 'مثال: driver، TRP-24011',
    actorLabel: 'المنفّذ',
    actorAll: 'كل المنفّذين',
    actionLabel: 'نوع الإجراء',
    timestampLabel: 'التوقيت (UTC+2)',

    colTarget: 'الكيان المستهدف والمعرّف',
    colDiff: 'القيم قبل / بعد',
    changedTo: 'تغيّرت إلى',

    emptyHeading: 'لا توجد سجلات تدقيق مطابقة لعوامل التصفية',
    emptyMessage: 'وسّعي النطاق الزمني أو امسحي عوامل تصفية المنفّذ ونوع الإجراء.',

    action: {
      approve: 'قبول',
      reject: 'رفض',
      suspend: 'إيقاف',
      reinstate: 'إعادة تفعيل',
      cancel: 'إلغاء',
      reassign: 'إعادة إسناد',
      refund: 'استرداد',
      settlement: 'تسوية',
      'gender-mismatch resolution': 'معالجة بلاغ عدم تطابق الجنس',
      'sos case closed': 'إغلاق حالة طوارئ',
      'admin-account change': 'تغيير حساب مدير',
    },
    target: {
      driver: 'سائقة',
      rider: 'راكبة',
      safety_report: 'بلاغ سلامة',
      zone: 'منطقة',
      admin: 'مدير',
      trip: 'رحلة',
    },
    field: {
      status: 'الحالة',
      reason: 'السبب',
      resolution: 'المعالجة',
      baseFare: 'الأجرة الأساسية',
      refunded: 'المبلغ المسترد',
      exists: 'موجود',
      email: 'البريد الإلكتروني',
    },
  },

  adminUsers: {
    pageTitle: 'حسابات مديري النظام',
    heading: 'حسابات المديرين',
    hint:
      'يمتلك كل حساب صلاحيات المدير العام الكاملة في هذه المرحلة. يجب على الحساب الجديد ' +
      'تفعيل المصادقة الثنائية وتغيير كلمة المرور عند أول تسجيل دخول.',
    addButton: 'إضافة مدير',

    searchPlaceholder: 'مثال: finance',

    colCreated: 'تاريخ الإنشاء',
    colLastLogin: 'آخر تسجيل دخول',

    neverSignedIn: 'لم يسجّل الدخول مطلقًا',
    noteYou: 'أنتِ',
    note2fa: 'المصادقة الثنائية غير مفعّلة',

    disable: 'تعطيل',
    enable: 'تفعيل',
    cannotDisableSelf: 'لا يمكنكِ تعطيل حسابك الخاص',

    disableTitle: 'تعطيل حساب المدير هذا؟',
    enableTitle: 'تفعيل حساب المدير هذا؟',
    disableDescription: 'سيتم تسجيل خروج {email} ولن يمكنه الوصول إلى البوابة حتى يُعاد تفعيله.',
    enableDescription: 'سيتمكن {email} من تسجيل الدخول مرة أخرى.',
    disableConfirm: 'تعطيل الحساب',
    enableConfirm: 'تفعيل الحساب',
    disabledToast: 'تم تعطيل {email}.',
    enabledToast: 'تم تفعيل {email}.',

    addTitle: 'إضافة مدير جديد',
    addDescription:
      'يُنشأ الحساب مفعّلًا. عليها تفعيل المصادقة الثنائية وتعيين كلمة المرور الخاصة بها عند أول تسجيل دخول.',
    addConfirm: 'إنشاء الحساب',
    emailPlaceholder: 'name@shedrive.app',
    emailEmptyError: 'أدخلي عنوان بريد إلكتروني',
    emailInvalidError: 'عنوان البريد الإلكتروني غير صالح',
    emailLengthError: 'يجب ألا يتجاوز البريد الإلكتروني 254 حرفًا',
    roleValue: 'مدير عام — الصلاحية الوحيدة في هذه المرحلة',
    createdToast: 'تم إنشاء حساب مدير لـ {email}.',

    emptyHeading: 'لا توجد حسابات مديرين مطابقة لعوامل التصفية',
    emptyMessage: 'امسحي عامل تصفية الحالة أو وسّعي نطاق البحث.',
  },

  balances: {
    heading: 'أرصدة السائقات',
    lead:
      'في الرحلات النقدية تحتفظ السائقة بالأجرة وتدين للمنصة بعمولتها. ' +
      'سجّلي ما تسلّمينه منها لتسوية الرصيد — تُقيَّد التسوية في كشف حسابها ' +
      'ويُرفع الحظر عن اتصالها فوراً. وعندما يكون رصيدها موجباً، فشي درايف ' +
      'مدينة لها — سجّلي الدفعة بعد أن ترسلها إدارة المالية فعلياً.',
    cardOwing: 'سائقات مدينات للمنصة',
    cardOutstanding: 'إجمالي المستحق',
    cardOwed: 'سائقات لهن مستحقات',
    cardBlocked: 'محظورات من الاتصال',
    limitMeta: 'الحد {limit}',
    thresholdDisabled: 'التصعيد موقوف',
    filterBalance: 'الرصيد',
    owing: 'مدينة للمنصة',
    owed: 'لها مستحقات',
    settled: 'مسوّاة (صفر)',
    colOutstanding: 'المستحق عليها (جم)',
    colAvailable: 'المتاح لها (جم)',
    colLastSettlement: 'آخر تسوية',
    colGoOnline: 'الاتصال',
    blocked: 'محظورة',
    allowed: 'مسموح',
    ledger: 'كشف الحساب',
    ledgerFor: 'كشف الحساب — {name}',
    emptyHeading: 'لا توجد سائقات مطابقة',
    emptyMessage: 'لا توجد سائقة برصيد في هذه الفئة حالياً.',
    ledgerEmptyHeading: 'لا توجد معاملات',
    ledgerEmptyMessage: 'لا توجد حركات على رصيد هذه السائقة بعد.',
    statBalance: 'الرصيد',
    statOutstanding: 'المستحق عليها',
    statAvailable: 'المتاح لها',
    colDate: 'التاريخ',
    colType: 'النوع',
    colAmount: 'المبلغ (جم)',
    colSource: 'المصدر',
    colNote: 'ملاحظة',
    recordSettlement: 'تسجيل تسوية',
    recordPayout: 'تسجيل دفعة',
    close: 'إغلاق',
    settleTitle: 'تسجيل تسوية — {name}',
    settleDescription:
      'المستحق عليها {amount}. تسجيل التسوية يقيّد مبلغاً دائناً في كشف حسابها ويقلّل ما عليها.',
    settleAmount: 'مبلغ التسوية (جم)',
    settleDate: 'تاريخ التسوية',
    settleMethod: 'طريقة التسوية',
    settleNote: 'ملاحظة',
    settleDone: 'تم تسجيل التسوية.',
    errAmountEmpty: 'أدخل مبلغ التسوية',
    errAmountInvalid: 'أدخل مبلغاً صحيحاً',
    errAmountRange: 'يجب أن يكون المبلغ أكبر من 0 وألا يتجاوز {max}',
    errDateEmpty: 'أدخل تاريخ التسوية',
    errDateInvalid: 'صيغة التاريخ غير صحيحة',
    errDateFuture: 'لا يمكن أن يكون التاريخ في المستقبل',
    errMethodEmpty: 'اختر طريقة التسوية',
    errNoteLength: 'يجب ألا تزيد الملاحظة عن 500 حرف',
    csvName: 'shedrive-driver-balances',
    csvBlockedYes: 'نعم',
    csvBlockedNo: 'لا',
    exportSettlementsCsv: 'تصدير التسويات CSV',
    settlementsCsvName: 'shedrive-settlements',
    settlementsColReference: 'المرجع',
    settlementsColReceipt: 'رقم الإيصال',
    settlementsColAdmin: 'سجّلها',
    settlementsColTime: 'الوقت',
    entryTripCommission: 'عمولة رحلة',
    entryTripEarnings: 'أرباح رحلة',
    entryDriverCancellationFee: 'رسوم إلغاء السائقة',
    entryRiderCancellationFeeShare: 'حصة السائقة من رسوم إلغاء الراكبة',
    entrySettlement: 'تسوية مستلمة',
    entryPayout: 'دفعة مرسلة',
    payoutTitle: 'تسجيل دفعة — {name}',
    payoutDescription:
      'شي درايف مدينة لها بـ {amount}. تسجيل الدفعة يوثّق تحويلاً أرسلته إدارة ' +
      'المالية فعلياً — لا شيء بحاجة إلى موافقة.',
    payoutDestination: 'وجهة الدفع المسجّلة',
    payoutNoDestination: 'لا توجد وجهة دفع مسجّلة',
    payoutDestBankTransfer: 'تحويل بنكي',
    payoutDestMobileWallet: 'محفظة إلكترونية',
    payoutNoDestinationHint: 'لا توجد وجهة دفع مسجّلة لهذه السائقة.',
    payoutAmount: 'مبلغ الدفعة (جم)',
    payoutDate: 'تاريخ الدفعة',
    payoutReference: 'المرجع',
    payoutDone: 'تم تسجيل الدفعة.',
    errPayoutAmountEmpty: 'أدخل مبلغ الدفعة',
    errPayoutAmountInvalid: 'أدخل مبلغاً صحيحاً',
    errPayoutAmountRange: 'يجب أن يكون المبلغ أكبر من 0 وألا يتجاوز {max}',
    errPayoutDateEmpty: 'أدخل تاريخ الدفعة',
    errPayoutDateInvalid: 'صيغة التاريخ غير صحيحة',
    errPayoutDateFuture: 'لا يمكن أن يكون التاريخ في المستقبل',
    errPayoutReferenceEmpty: 'أدخل مرجع الدفعة',
    errPayoutReferenceLength: 'يجب ألا يزيد المرجع عن 60 حرفاً',
  },

  riderBalances: {
    heading: 'أرصدة الراكبات',
    lead:
      'الراكبة التي تُلغي بعد فترة السماح مدينة برسوم، تُسترد كرسم إضافي على رحلتها ' +
      'النقدية التالية. اشطبي الرسم بذكر سبب — يُقيَّد ذلك كحركة جديدة ثابتة، ولا ' +
      'يُعدَّل على حركة قائمة أبدًا.',
    cardOwing: 'راكبات مدينات برسوم',
    cardOutstanding: 'إجمالي المستحق',
    cardFullRecovery: 'راكبات عند التحصيل الكامل',
    thresholdMeta: 'حد التصعيد {limit}',
    thresholdDisabled: 'التصعيد موقوف',
    filterBalance: 'الرصيد',
    owing: 'مدينة برسوم',
    colOutstanding: 'المستحق (جم)',
    colLastFee: 'آخر رسم',
    colRecovery: 'تحصيل الرحلة القادمة',
    fullRecovery: 'الرصيد كامل',
    singleFee: 'أقدم رسم',
    ledger: 'كشف الحساب',
    ledgerFor: 'كشف الحساب — {name}',
    emptyHeading: 'لا توجد راكبات مطابقة',
    emptyMessage: 'لا توجد راكبة عليها رسم مستحق في هذه الفئة الآن.',
    ledgerEmptyHeading: 'لا توجد حركات',
    ledgerEmptyMessage: 'لا توجد حركات رسوم لهذه الراكبة بعد.',
    statOutstanding: 'المستحق',
    statRecovery: 'تحصيل الرحلة القادمة',
    colDate: 'التاريخ',
    colType: 'النوع',
    colAmount: 'المبلغ (جم)',
    colSource: 'الرحلة',
    colNote: 'ملاحظة',
    waiveFee: 'شطب الرسم',
    close: 'إغلاق',
    waiveTitle: 'شطب الرسم — {name}',
    waiveDescription: 'مستحق عليها {amount}. الشطب يُقيَّد كإضافة بكامل المبلغ، ويتطلب ذكر سبب.',
    waiveReason: 'السبب',
    waiveDone: 'تم شطب الرسم.',
    errReasonEmpty: 'أدخلي السبب',
    errReasonLength: 'يجب أن يكون السبب بين 10 و500 حرف',
    csvName: 'shedrive-rider-balances',
    csvFullYes: 'الرصيد كامل',
    csvFullNo: 'أقدم رسم',
    entryCancellationFee: 'رسم إلغاء',
    entryFeeCollected: 'رسم مُحصَّل',
    entryFeeWaived: 'رسم مشطوب',
  },

};
