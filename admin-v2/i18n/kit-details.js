/** i18n/kit-details.js — strings added in the v22-09 kit port (2026-10-14).
 *  Trip detail, SOS case and gender-mismatch report, rebuilt on the kit's card grid
 *  and modals. Everything else these screens show still comes from `tripDetail.*`,
 *  `sosCase.*` and `safetyReport.*` in details.js. Arabic follows the kit's `_ar` pages. */

export const en = {
  kitDetails: {
    // Shared modal chrome
    optional: 'Optional',
    notePlaceholder: 'Type a note.',
    leaveNote: 'Leave a note …',
    backToReview: 'Back to review',
    continue: 'Continue',

    // Trip detail
    tripDetails: 'Trip details',
    actualRoute: 'Actual route',
    reassignDriver: 'Reassign driver',
    cancelTrip: 'Cancel trip',
    cancelWarnTitle: 'Are you sure you want to cancel this trip?',
    cancelWarnBody:
      'This action cannot be undone. The trip will be cancelled immediately, and the driver and rider will be notified of the cancellation.',
    cancelConfirm: 'Confirm & cancel trip',
    cancelledTitle: 'Trip has been cancelled successfully',
    cancelledBody: 'The driver and rider will be notified of the cancellation.',
    reassignedTitle: 'Trip successfully reassigned to the new driver',
    reassignedBody: '{name} has been notified and can now view and accept the trip.',

    // SOS case
    closeCase: 'Close the case',
    falseAlarm: 'False alarm',
    suspendCloseTitle: 'Suspend & close this case',
    suspendCloseBtn: 'Suspend & close case',
    falseAlarmTitle: 'Close as a false alarm?',
    resolutionPlaceholder: 'Explain the resolution.',
    closedTitle: 'The request completed successfully',
    closedBody: 'The case has been closed successfully.',
    contactsOne: '1 contact',
    contactsMany: '{count} contacts',

    // Gender-mismatch report
    reportDetails: 'Report details',
    noteLabel: 'Note',
    suspendedTitle: 'Rider suspended successfully',
    suspendedBody: 'The rider can no longer request rides.',
    dismissedTitle: 'Report dismissed successfully',
    dismissedBody: 'The rider can use the app and request rides normally again.',
  },
};

export const ar = {
  kitDetails: {
    optional: 'اختياري',
    notePlaceholder: 'اكتب ملاحظة.',
    leaveNote: 'اترك ملاحظة …',
    backToReview: 'الرجوع للمراجعة',
    continue: 'متابعة',

    tripDetails: 'تفاصيل الرحلة',
    actualRoute: 'المسار الفعلي',
    reassignDriver: 'تغيير السائقة',
    cancelTrip: 'إلغاء الرحلة',
    cancelWarnTitle: 'هل تريد بالتأكيد إلغاء هذه الرحلة؟',
    cancelWarnBody:
      'لا يمكن التراجع عن هذا الإجراء. سيتم إلغاء الرحلة فورًا، وسيتم إخطار السائقة والراكبة بالإلغاء.',
    cancelConfirm: 'تأكيد إلغاء الرحلة',
    cancelledTitle: 'تم إلغاء الرحلة بنجاح',
    cancelledBody: 'سيتم إخطار السائقة والراكبة بإلغاء الرحلة.',
    reassignedTitle: 'تمت إعادة تعيين الرحلة بنجاح إلى السائقة الجديدة',
    reassignedBody: 'تم إخطار {name}، ويمكنها الآن عرض الرحلة وقبولها.',

    closeCase: 'إغلاق الحالة',
    falseAlarm: 'إنذار كاذب',
    suspendCloseTitle: 'إيقاف وإغلاق هذه الحالة',
    suspendCloseBtn: 'إيقاف وإغلاق الحالة',
    falseAlarmTitle: 'إغلاق الحالة كإنذار كاذب؟',
    resolutionPlaceholder: 'اكتب ملاحظة الإجراء.',
    closedTitle: 'تم إتمام الطلب بنجاح',
    closedBody: 'تم إغلاق الحالة بنجاح.',
    contactsOne: 'جهة اتصال واحدة',
    contactsMany: '{count} جهات اتصال',

    reportDetails: 'تفاصيل البلاغ',
    noteLabel: 'ملاحظة',
    suspendedTitle: 'تم إيقاف الراكبة بنجاح',
    suspendedBody: 'لم يعد بإمكان الراكبة طلب رحلات.',
    dismissedTitle: 'تم رفض البلاغ بنجاح',
    dismissedBody: 'يمكن للراكبة الآن استخدام التطبيق وطلب الرحلات بشكل طبيعي.',
  },
};
