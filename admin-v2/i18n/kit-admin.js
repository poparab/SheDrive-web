/** i18n/kit-admin.js — strings added in the v22-09 kit port (2026-10-14). */

export const en = {
  kitAdmin: {
    // ── Admin accounts (#1820, #1807, #1821, #4121, #4122) ──
    kpiTotal: 'Total admins',
    kpiActive: 'Active admins',
    kpiSuspended: 'Suspended admins',
    createAccount: 'Add new admin',
    createTitle: 'Create new account',
    confirmSave: 'Confirm & save',
    emailDuplicateError: 'An admin with this email already exists',
    selfNote: 'This is your account',

    suspend: 'Suspend account',
    unsuspend: 'Unsuspend account',
    deleteAccount: 'Delete account',
    cannotActOnSelf: 'You cannot change your own account',

    suspendTitle: 'Are you sure you want to suspend this account?',
    suspendText:
      '{email} is signed out at once and cannot sign in until an Admin (users & IT) unsuspends the account.',
    suspendConfirm: 'Confirm & suspend',
    unsuspendTitle: 'Are you sure you want to unsuspend this account?',
    unsuspendText: '{email} can sign in again with her existing password.',
    unsuspendConfirm: 'Confirm & unsuspend',
    deleteTitle: 'Are you sure you want to delete this account?',
    deleteText:
      '{email} is removed from this list and can no longer sign in. The record and everything she did stay in the audit log.',
    deleteConfirm: 'Confirm & delete',
    backToReview: 'Back to review',

    successTitle: 'Request completed successfully',
    suspendedDone: '{email} is suspended.',
    unsuspendedDone: '{email} is active again.',
    deletedDone: '{email} is deleted.',
    createdDone: 'The account for {email} is active. A temporary password was emailed to her.',

    // ── Audit log (#1816) ──
    eventLabel: 'Event',
    eventAll: 'All event types',
    entityLabel: 'Entity',
    entityPlaceholder: 'Entity type or id',
    detailsTitle: 'Audit entry details',
    changesTitle: 'Before → after',
    colField: 'Field',
    colBefore: 'Before',
    colAfter: 'After',
    noChanges: 'No field values were recorded for this entry.',
    readOnlyNote: 'Audit entries are immutable. This view is read-only.',
  },
};

export const ar = {
  kitAdmin: {
    kpiTotal: 'إجمالي المديرين',
    kpiActive: 'مديرين نشطين',
    kpiSuspended: 'مديرين موقوفين',
    createAccount: 'إضافة مدير جديد',
    createTitle: 'إنشاء حساب جديد',
    confirmSave: 'تأكيد وحفظ',
    emailDuplicateError: 'يوجد مشرف بهذا البريد الإلكتروني بالفعل',
    selfNote: 'هذا حسابك',

    suspend: 'وقف الحساب',
    unsuspend: 'إعادة فتح الحساب',
    deleteAccount: 'حذف الحساب',
    cannotActOnSelf: 'لا يمكنكِ وقف حسابك الخاص أو حذفه',

    suspendTitle: 'هل تريد تأكيد وقف هذا الحساب؟',
    suspendText: 'يُسجَّل خروج {email} فوراً ولا يمكنه تسجيل الدخول حتى يعيد مسؤول النظام فتح الحساب.',
    suspendConfirm: 'تأكيد ووقف',
    unsuspendTitle: 'هل تريد إعادة فتح حساب المستخدم؟',
    unsuspendText: 'يستطيع {email} تسجيل الدخول مرة أخرى بكلمة المرور الحالية.',
    unsuspendConfirm: 'تأكيد فتح الحساب',
    deleteTitle: 'هل تريد تأكيد حذف الحساب؟',
    deleteText:
      'يُزال {email} من هذه القائمة ولا يمكنه تسجيل الدخول بعد ذلك. يبقى السجل وكل ما قام به في سجل التدقيق.',
    deleteConfirm: 'تأكيد وحذف',
    backToReview: 'رجوع للمراجعة',

    successTitle: 'تم تنفيذ الطلب بنجاح',
    suspendedDone: 'تم وقف {email}.',
    unsuspendedDone: 'أصبح {email} نشطاً مرة أخرى.',
    deletedDone: 'تم حذف {email}.',
    createdDone: 'حساب {email} نشط. أُرسلت كلمة مرور مؤقتة إلى بريدها الإلكتروني.',

    eventLabel: 'الحدث',
    eventAll: 'كل أنواع الأحداث',
    entityLabel: 'الكيان',
    entityPlaceholder: 'نوع الكيان أو المعرّف',
    detailsTitle: 'تفاصيل سجل التدقيق',
    changesTitle: 'قبل ← بعد',
    colField: 'الحقل',
    colBefore: 'قبل',
    colAfter: 'بعد',
    noChanges: 'لم تُسجَّل قيم حقول لهذا السجل.',
    readOnlyNote: 'سجلات التدقيق غير قابلة للتعديل. هذا العرض للقراءة فقط.',
  },
};
