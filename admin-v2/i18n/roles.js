/**
 * i18n/roles.js — admin roles and access (#6210, #6211, #6212), 2026-10-29.
 * Role names, the no-access page, the demo role switch, the admin-users role
 * actions and the Financial-lead wording the approval screens use.
 * Exact story copy is quoted verbatim (EN + AR from the stories).
 */

export const en = {
  roles: {
    admin_it: 'Admin (users & IT)',
    ops_officer: 'Operations officer',
    ops_lead: 'Operations lead',
    fin_officer: 'Financial officer',
    fin_lead: 'Financial lead',
    none: 'No role',
  },

  access: {
    title: "You don't have access to this page",
    message: 'Your role, {role}, cannot open this page. Ask your administrator if your job needs it.',
    goStart: 'Go to {page}',
    noRoleTitle: 'Your account has no role yet. Ask your administrator.',
    noRoleMessage: 'An Admin (users & IT) gives every account its role. You can sign out until then.',
    signOut: 'Sign out',
  },

  demoRole: {
    badge: 'Demo',
    label: 'View as',
    auto: 'Automatic — a role that can open each screen',
    hint: 'Mockup only: switch the role you are signed in with. A real admin signs in as herself and has one role.',
    groupAuto: 'Demo',
    person: '{role} — {email}',
    switched: 'You are now signed in as {email} ({role}).',
  },

  adminRoles: {
    colRole: 'Role',
    filterRole: 'Role',
    allRoles: 'All roles',
    fieldRole: 'Role',
    choosePlaceholder: 'Choose a role',
    roleEmpty: 'Choose a role',
    changeRole: 'Change role',
    resetPassword: 'Reset password',
    resetTwoFactor: 'Reset two-factor',
    noActionsOnSelf: 'There are no actions on your own account',
    changeTitle: 'Change role',
    changeText: '{email} is {role} today. The new role applies from her next page load. Finance requests she already made stay pending as they are.',
    newRole: 'New role',
    sameRoleError: 'Choose a role different from the current one',
    changeConfirm: 'Confirm & change role',
    changedDone: '{email} is now {role}.',
    resetPasswordTitle: "Reset this admin's password?",
    resetPasswordText: '{email} gets an email with a link to set a new password. Her current password stops working at once.',
    resetPasswordConfirm: 'Confirm & reset password',
    resetPasswordDone: 'A password reset link was sent to {email}.',
    resetTwoFactorTitle: 'Reset two-factor for this account?',
    resetTwoFactorText:
      "This removes {email}'s authenticator and recovery codes and ends all her sessions. At her next sign-in she scans a new QR code to enrol again.",
    resetTwoFactorConfirm: 'Confirm & reset two-factor',
    resetTwoFactorDone: "{email}'s two-factor was reset. She enrols again at her next sign-in.",
    leadOne:
      "Only one Financial lead will be left. Their own finance requests can't be approved until another is added.",
    leadNone: "No Financial lead will be left. Finance requests can't be approved until one is added.",
  },

  approvalRoles: {
    waitingForLead: 'Waiting for another Financial lead',
    waitingForLeadMeta: 'No other active Financial lead can decide it, so it stays pending until one is added.',
    madeByYouLead: 'You made this request — another Financial lead must decide it.',
    officerReadOnly: 'Only a Financial lead approves or rejects requests.',
    officerQueueNote:
      'You see the requests you made. A Financial lead approves or rejects them; you can follow their status here.',
    hint:
      'Every finance request waits here until a Financial lead approves or rejects it. Nothing changes and nothing is posted to a ledger until it is approved. A lead never decides her own request.',
  },
};

export const ar = {
  roles: {
    admin_it: 'مسؤول النظام (المستخدمون وتقنية المعلومات)',
    ops_officer: 'موظف العمليات',
    ops_lead: 'رئيس فريق العمليات',
    fin_officer: 'موظف مالي',
    fin_lead: 'رئيس فريق مالي',
    none: 'بدون صلاحية',
  },

  access: {
    title: 'ليس لديك صلاحية لفتح هذه الصفحة',
    message: 'صلاحيتك ({role}) لا تسمح بفتح هذه الصفحة. تواصل مع مسؤول النظام إذا كان عملك يتطلبها.',
    goStart: 'الانتقال إلى {page}',
    noRoleTitle: 'لم تُحدَّد صلاحية لحسابك بعد. تواصل مع مسؤول النظام.',
    noRoleMessage: 'يحدد مسؤول النظام (المستخدمون وتقنية المعلومات) صلاحية كل حساب. يمكنك تسجيل الخروج إلى حين ذلك.',
    signOut: 'تسجيل الخروج',
  },

  demoRole: {
    badge: 'تجريبي',
    label: 'العرض بصفة',
    auto: 'تلقائي — صلاحية تفتح كل شاشة',
    hint: 'للنموذج التجريبي فقط: بدّل الصلاحية التي سجلت الدخول بها. المدير الحقيقي يسجل الدخول بحسابه وله صلاحية واحدة.',
    groupAuto: 'تجريبي',
    person: '{role} — {email}',
    switched: 'أنت الآن مسجل الدخول بحساب {email} ({role}).',
  },

  adminRoles: {
    colRole: 'الصلاحية',
    filterRole: 'الصلاحية',
    allRoles: 'كل الصلاحيات',
    fieldRole: 'الصلاحية',
    choosePlaceholder: 'اختر الصلاحية',
    roleEmpty: 'اختر الصلاحية',
    changeRole: 'تغيير الصلاحية',
    resetPassword: 'إعادة تعيين كلمة المرور',
    resetTwoFactor: 'إعادة تعيين التحقق بخطوتين',
    noActionsOnSelf: 'لا توجد إجراءات على حسابك',
    changeTitle: 'تغيير الصلاحية',
    changeText: 'صلاحية {email} حاليًا: {role}. تسري الصلاحية الجديدة من تحميل الصفحة التالي. تبقى الطلبات المالية التي قدّمتها معلّقة كما هي.',
    newRole: 'الصلاحية الجديدة',
    sameRoleError: 'اختر صلاحية مختلفة عن الحالية',
    changeConfirm: 'تأكيد وتغيير الصلاحية',
    changedDone: 'أصبحت صلاحية {email}: {role}.',
    resetPasswordTitle: 'إعادة تعيين كلمة مرور هذا المدير؟',
    resetPasswordText: 'يصل إلى {email} بريد برابط لتعيين كلمة مرور جديدة. تتوقف كلمة المرور الحالية عن العمل فورًا.',
    resetPasswordConfirm: 'تأكيد وإعادة تعيين كلمة المرور',
    resetPasswordDone: 'أُرسل رابط إعادة تعيين كلمة المرور إلى {email}.',
    resetTwoFactorTitle: 'إعادة تعيين التحقق بخطوتين لهذا الحساب؟',
    resetTwoFactorText:
      'يحذف هذا تطبيق المصادقة ورموز الاسترداد الخاصة بـ {email} وينهي كل جلساتها. عند تسجيل دخولها التالي تمسح رمز QR جديدًا للتسجيل من جديد.',
    resetTwoFactorConfirm: 'تأكيد وإعادة تعيين التحقق بخطوتين',
    resetTwoFactorDone: 'أُعيد تعيين التحقق بخطوتين لـ {email}. ستسجّل من جديد عند دخولها التالي.',
    leadOne: 'سيتبقى رئيس فريق مالي واحد فقط. لا يمكن اعتماد طلباته المالية حتى تتم إضافة آخر.',
    leadNone: 'لن يتبقى رئيس فريق مالي. لا يمكن اعتماد أي طلب مالي حتى تتم إضافة واحد.',
  },

  approvalRoles: {
    waitingForLead: 'في انتظار رئيس فريق مالي آخر',
    waitingForLeadMeta: 'لا يوجد رئيس فريق مالي نشط آخر ليقرر فيه، لذا يبقى معلّقًا حتى تتم إضافة واحد.',
    madeByYouLead: 'أنت من قدّم هذا الطلب — يجب أن يقرر فيه رئيس فريق مالي آخر.',
    officerReadOnly: 'رئيس الفريق المالي وحده يعتمد الطلبات أو يرفضها.',
    officerQueueNote: 'تظهر لك الطلبات التي قدّمتها. يعتمدها رئيس فريق مالي أو يرفضها، ويمكنك متابعة حالتها هنا.',
    hint:
      'ينتظر كل طلب مالي هنا حتى يعتمده رئيس فريق مالي أو يرفضه. لا يتغير شيء ولا يُسجَّل أي قيد قبل الاعتماد. لا يقرر رئيس الفريق في طلبه هو.',
  },
};
