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
};
