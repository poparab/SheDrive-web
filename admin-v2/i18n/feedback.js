/**
 * i18n/feedback.js — toasts and status banners (components/ad-toast.js, ad-banner.js).
 *
 * Same shape as core.js: export `en` and `ar` objects of namespaces.
 *
 *   toast.*  — the short "it happened" (or "it failed") message after an action
 *   banner.* — the message that stays while a record is in a state
 */

export const en = {
  toast: {
    dismiss: 'Dismiss notification',
    retry: 'Retry',
    failedTitle: 'That didn’t go through',
    actionFailed: 'Something went wrong. Try again.',
    exported: 'Export ready — check your downloads.',
    signedOut: 'You have been signed out.',
    driversLookupFailed: 'Available drivers could not be loaded, so the trip was not reassigned.',
    boundaryFailedTitle: 'Boundary not saved',
  },

  banner: {
    loadFailedHeading: 'This page could not be loaded',
    loadFailedMessage: '{message} Nothing was changed.',

    driverSuspendedHeading: 'This driver is suspended',
    driverSuspendedMessage: '{reason}. She is offline and cannot go online until she is reinstated.',
    driverPendingSuspensionHeading: 'Suspension pending until her current trip ends',
    driverPendingSuspensionMessage: '{reason}.',
    driverPendingHeading: 'Application under review',
    driverPendingMessage: 'She cannot go online until her application is approved.',
    driverPendingAction: 'Review application',
    driverRejectedHeading: 'Application rejected',
    driverRejectedMessage: '{reason}. She cannot go online.',

    riderSuspendedHeading: 'This rider is suspended',
    riderSuspendedMessage: '{reason}. She cannot request trips until she is reinstated.',
    riderReviewHeading: 'Under review after a safety report',
    riderReviewMessage: 'She cannot request trips until the report is resolved.',
    riderReviewAction: 'Open report',

    tripCancelledHeading: 'This trip was cancelled',
    tripCancelledMessage: 'An admin cancelled it. It can no longer be cancelled or reassigned.',
    tripExpiredHeading: 'This trip expired',
    tripExpiredMessage: 'Reason: {reason}. It can no longer be cancelled or reassigned.',

    reportSuspendedHeading: 'Resolved — the rider was suspended',
    reportDismissedHeading: 'Resolved — the report was dismissed',
    reportResolvedMessage: 'Resolved by {who} on {when}. No further action is available.',

    sosClosedHeading: 'This SOS case is closed',
    sosClosedMessage: 'Closed as {outcome} by {who} on {when}.',
    sosAlertFailedHeading: 'The SOS alert did not reach every contact',
    sosAlertFailedMessage:
      'The SMS failed for {failed} of {total} emergency contacts. Call them directly.',

    zonesInactiveHeading: 'Some zones are inactive',
    zonesInactiveMessage:
      '{inactive} of {total} zones have no rate card. Trips cannot be requested in their area until one is set.',
    mapUnavailableHeading: 'The zone map is unavailable',
    mapUnavailableMessage:
      'Zones cannot be drawn or redrawn until it loads. The list below still works.',
  },
};

export const ar = {
  toast: {
    dismiss: 'إغلاق الإشعار',
    retry: 'إعادة المحاولة',
    failedTitle: 'لم يكتمل الإجراء',
    actionFailed: 'حدث خطأ ما. حاول مرة أخرى.',
    exported: 'الملف جاهز — تحقق من التنزيلات.',
    signedOut: 'تم تسجيل خروجك.',
    driversLookupFailed: 'تعذّر تحميل السائقات المتاحات، لذلك لم تتم إعادة تعيين الرحلة.',
    boundaryFailedTitle: 'لم يتم حفظ الحدود',
  },

  banner: {
    loadFailedHeading: 'تعذّر تحميل هذه الصفحة',
    loadFailedMessage: '{message} لم يتم تغيير أي شيء.',

    driverSuspendedHeading: 'هذه السائقة موقوفة',
    driverSuspendedMessage: '{reason}. السائقة غير متصلة ولا يمكنها الاتصال حتى يُلغى إيقافها.',
    driverPendingSuspensionHeading: 'الإيقاف معلّق حتى تنتهي رحلتها الجارية',
    driverPendingSuspensionMessage: '{reason}.',
    driverPendingHeading: 'الطلب قيد المراجعة',
    driverPendingMessage: 'لا يمكنها الاتصال بالمنصة حتى تتم الموافقة على طلبها.',
    driverPendingAction: 'مراجعة الطلب',
    driverRejectedHeading: 'تم رفض الطلب',
    driverRejectedMessage: '{reason}. لا يمكنها الاتصال بالمنصة.',

    riderSuspendedHeading: 'هذه الراكبة موقوفة',
    riderSuspendedMessage: '{reason}. لا يمكنها طلب رحلات حتى يُلغى إيقافها.',
    riderReviewHeading: 'قيد المراجعة بعد بلاغ أمان',
    riderReviewMessage: 'لا يمكنها طلب رحلات حتى يتم البت في البلاغ.',
    riderReviewAction: 'فتح البلاغ',

    tripCancelledHeading: 'تم إلغاء هذه الرحلة',
    tripCancelledMessage: 'ألغاها أحد المسؤولين. لم يعد من الممكن إلغاؤها أو إعادة تعيينها.',
    tripExpiredHeading: 'انتهت صلاحية هذه الرحلة',
    tripExpiredMessage: 'السبب: {reason}. لم يعد من الممكن إلغاؤها أو إعادة تعيينها.',

    reportSuspendedHeading: 'تم البت — تم إيقاف الراكبة',
    reportDismissedHeading: 'تم البت — تم استبعاد البلاغ',
    reportResolvedMessage: 'تم البت بواسطة {who} في {when}. لا يوجد إجراء آخر متاح.',

    sosClosedHeading: 'حالة الطوارئ هذه مغلقة',
    sosClosedMessage: 'أُغلقت بنتيجة «{outcome}» بواسطة {who} في {when}.',
    sosAlertFailedHeading: 'لم يصل تنبيه الطوارئ إلى كل جهات الاتصال',
    sosAlertFailedMessage: 'فشلت الرسالة النصية لـ {failed} من {total} جهات اتصال للطوارئ. اتصل بهم مباشرة.',

    zonesInactiveHeading: 'بعض المناطق غير مفعّلة',
    zonesInactiveMessage:
      '{inactive} من {total} مناطق بدون بطاقة أسعار، فهي غير مفعّلة. لا يمكن طلب رحلات في نطاقها حتى يتم تحديدها.',
    mapUnavailableHeading: 'خريطة المناطق غير متاحة',
    mapUnavailableMessage: 'لا يمكن رسم المناطق أو تعديل حدودها حتى يتم تحميلها. القائمة أدناه تعمل.',
  },
};
