/** i18n/kit-finance.js — strings added in the v22-09 kit port (2026-10-14). */

export const en = {
  kitFinance: {
    // Approvals — kit confirm / reject / success popups
    aprConfirmTitle: 'Approve request {id}?',
    aprConfirmNote: 'The change applies as soon as you confirm, and the decision is recorded in the audit log.',
    aprConfirmApprove: 'Confirm approval',
    aprBackToReview: 'Back to review',
    aprApprovedTitle: 'Request approved',
    aprApprovedBody: '{id} is approved and the change has been applied.',
    aprRejectTitle: 'Reject this request',
    aprRejectedTitle: 'Request rejected',
    aprRejectedBody: '{id} is rejected. Nothing was changed, and the admin who made it can see your reason.',

    // Payout batch — kit card grid
    pbSummaryTitle: 'Batch summary',
    pbTimelineTitle: 'State timeline',
    pbColMethod: 'Method',
    pbExportConfirmTitle: 'Export the bank files?',
    pbExportConfirmBody: 'One file downloads per payout method, and the batch moves to Sent to bank. You can download the same files again later.',
    pbUploadPrompt: 'Press to upload a result file, or drop it here',
    pbUploadLimits: 'CSV • one method’s file • every line once, with SUCCESS or FAILED',

    // Settlement imports — kit upload box
    siUploadPrompt: 'Press to upload the settlement sheet, or drop it here',
    siUploadLimits: 'CSV • the six template columns',
    siNameInSheet: 'In sheet: {name}',
  },
};

export const ar = {
  kitFinance: {
    aprConfirmTitle: 'هل تريد الموافقة على الطلب {id}؟',
    aprConfirmNote: 'يُطبَّق التغيير فور التأكيد، ويُسجَّل القرار في سجل التدقيق.',
    aprConfirmApprove: 'تأكيد وموافقة',
    aprBackToReview: 'العودة للمراجعة',
    aprApprovedTitle: 'تمت الموافقة على الطلب',
    aprApprovedBody: 'تمت الموافقة على {id} وتم تطبيق التغيير.',
    aprRejectTitle: 'رفض هذا الطلب',
    aprRejectedTitle: 'تم رفض الطلب',
    aprRejectedBody: 'تم رفض {id}. لم يتغير شيء، ويستطيع المدير الذي أنشأه رؤية سبب الرفض.',

    pbSummaryTitle: 'ملخص الدفعة',
    pbTimelineTitle: 'التسلسل الزمني للحالات',
    pbColMethod: 'وسيلة الصرف',
    pbExportConfirmTitle: 'هل تريد تصدير ملفات البنك؟',
    pbExportConfirmBody: 'يُنزَّل ملف لكل طريقة دفع، وتنتقل الدفعة إلى حالة «أُرسلت إلى البنك». يمكنك تنزيل الملفات نفسها مرة أخرى لاحقًا.',
    pbUploadPrompt: 'إضغط لرفع ملف نتيجة، أو اسحبه هنا',
    pbUploadLimits: 'CSV • ملف طريقة دفع واحدة • كل سطر مرة واحدة، بحالة SUCCESS أو FAILED',

    siUploadPrompt: 'إضغط لرفع كشف التسويات، أو اسحبه هنا',
    siUploadLimits: 'CSV • أعمدة القالب الستة',
    siNameInSheet: 'في الكشف: {name}',
  },
};
