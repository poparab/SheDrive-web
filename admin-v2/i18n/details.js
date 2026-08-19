/**
 * i18n/details.js — strings for the detail screens — trip detail, driver application, driver profile, rider profile, safety report.
 *
 * Same shape as core.js: export `en` and `ar` objects of namespaces.
 * Namespaces merge across area files, so extending an existing namespace here
 * is fine — just do not restate a key core.js already owns.
 *
 * Namespaces owned here:
 *   field.*        key/value labels shared by more than one detail screen
 *   docs.*         uploaded-document labels and their "Uploaded {date}" meta
 *   reason.*       the predefined reason lists from seed.js, keyed by a slug of
 *                  the stored English value (see `reasonKey()` below). The
 *                  stored value stays English — only the label is translated —
 *                  so `values.reason === 'Other'` and the audit trail are
 *                  unaffected by the display language.
 *   tripDetail.* application.* driverProfile.* riderProfile.* safetyReport.*
 *
 * English wording is the ADO stories' own wording, verbatim. Arabic follows the
 * delivered kit's `driver-profile_ar.html`, `driver-application-view_ar.html`,
 * `trip-completed_ar.html`, `trip-in-progress_ar.html`, `trip-expired_ar.html`
 * and `rider-profile_ar.html`.
 */

/**
 * Slugify a stored reason string into a `reason.*` key.
 * "Policy violation — unauthorised passenger" → "policy_violation_unauthorised_passenger"
 * Pure — no imports — so screens can call it before the locale is resolved.
 * @param {string} text
 * @returns {string}
 */
export function reasonKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const en = {
  field: {
    fullName: 'Full name',
    dob: 'Date of birth',
    nid: 'National ID',
    homeArea: 'Home area',
    licenceNumber: 'Driving licence number',
    licence: 'Driving licence',
    licenceExpiry: 'Licence expiry',
    registrationExpiry: 'Registration expiry',
    expiredSuffix: ' — expired',
    make: 'Make',
    model: 'Model',
    year: 'Year',
    plate: 'Plate number',
    colour: 'Colour',
    type: 'Type',
    vehicle: 'Vehicle',
    submitted: 'Submitted',
    onlineNow: 'Online now',
    totalTrips: 'Total trips completed',
    tripDate: 'Trip date',
    noRating: 'No rating given',
  },

  docs: {
    national_id: 'National ID',
    driving_licence: 'Driving licence',
    vehicle_registration: 'Vehicle registration',
    criminal_record: 'Criminal record certificate',
    profilePhoto: 'Profile photo',
    vehiclePhoto: 'Vehicle photo',
    vehicleFront: 'Vehicle — front',
    vehicleLeft: 'Vehicle — left side',
    vehicleRear: 'Vehicle — rear',
    vehicleInterior: 'Vehicle — interior',
    uploaded: 'Uploaded {date}',
    submitted: 'Submitted {date}',
  },

  reason: {
    other: 'Other',
    // driver suspension (#1742)
    unsafe_driving_reported_by_riders: 'Unsafe driving reported by riders',
    repeated_trip_cancellations: 'Repeated trip cancellations',
    document_expired_and_not_renewed: 'Document expired and not renewed',
    policy_violation_unauthorised_passenger: 'Policy violation — unauthorised passenger',
    unsafe_driving_reported_by_riders_applies_when_the_active_trip_ends:
      'Unsafe driving reported by riders — applies when the active trip ends',
    // rider suspension (#1740)
    gender_mismatch_report_upheld: 'Gender-mismatch report upheld',
    abusive_behaviour_towards_a_driver: 'Abusive behaviour towards a driver',
    repeated_no_shows: 'Repeated no-shows',
    fraudulent_payment_activity: 'Fraudulent payment activity',
    // application rejection (#1660)
    driving_licence_expired: 'Driving licence expired',
    vehicle_registration_does_not_match_the_applicant:
      'Vehicle registration does not match the applicant',
    national_id_document_illegible: 'National ID document illegible',
    vehicle_older_than_the_platform_minimum: 'Vehicle older than the platform minimum',
    applicant_did_not_meet_the_minimum_age_requirement:
      'Applicant did not meet the minimum age requirement',
    // trip cancellation (#1808)
    rider_requested_cancellation: 'Rider requested cancellation',
    driver_unresponsive: 'Driver unresponsive',
    safety_concern_raised: 'Safety concern raised',
    vehicle_breakdown: 'Vehicle breakdown',
    duplicate_or_test_trip: 'Duplicate or test trip',
    // trip reassignment (#1809)
    driver_too_far_from_pickup: 'Driver too far from pickup',
    driver_requested_handover: 'Driver requested handover',
    // reinstatement (#1743 / #1741)
    suspension_lifted_after_review: 'Suspension lifted after review',
    documents_renewed_and_verified: 'Documents renewed and verified',
    policy_violation_resolved: 'Policy violation resolved',
    suspended_in_error: 'Suspended in error',
    gender_mismatch_report_overturned: 'Gender-mismatch report overturned',
    payment_issue_resolved: 'Payment issue resolved',
  },

  tripDetail: {
    title: 'Trip detail',
    crumb: 'Trip',
    notFoundHeading: 'Trip not found',
    notFoundMessage: 'This trip record does not exist.',
    backToTrips: 'Back to trips',

    parties: 'Rider & driver',
    route: 'Pickup & destination',
    timelineHeading: 'State timeline',
    timelineHint: 'Every transition this trip passed through, with timestamps in UTC+2.',
    mapHeading: 'Actual route travelled',
    summary: 'Trip',
    estimate: 'Original fare estimate',
    fareHeading: 'Fare breakdown',
    ratingHeading: 'Rider rating',
    actionsHeading: 'Admin intervention',
    cancellation: 'Cancellation',

    rider: 'Rider',
    riderPhone: 'Rider phone',
    driver: 'Driver',
    driverPhone: 'Driver phone',
    notAssigned: 'Not assigned',
    pickup: 'Pickup',
    destination: 'Destination',
    pickupArea: 'Pickup area',
    destinationArea: 'Destination area',
    serviceZone: 'Service zone',
    tripId: 'Trip ID',
    created: 'Created',
    lastUpdate: 'Last update',
    expiryReason: 'Expiry reason',
    cancelledBy: 'Cancelled by',
    cancelledAt: 'Cancelled at',
    adminActor: 'SheDrive admin',
    paymentMethod: 'Payment method',
    estimatedFare: 'Estimated fare',
    estimatedTime: 'Estimated trip time',
    estimatedDistance: 'Estimated distance',
    baseFare: 'Base fare',
    distanceCharge: 'Distance charge',
    timeCharge: 'Time charge',
    totalFare: 'Total fare',
    cashCollected: 'Cash collected',
    noRating: 'No rating given',
    starsAria: '{stars} out of 5 stars',
    reasonNote: 'Reason: {reason}',
    routeSummary:
      '{distance} travelled in {duration} — the recorded GPS path from pickup to drop-off.',

    expiry: {
      no_driver: 'No driver',
      system_timeout: 'System timeout',
      gender_mismatch_report: 'Gender mismatch report',
    },

    proposalStrong: 'Proposed behaviour — needs BA sign-off.',
    proposalBody:
      'Stories #1808 (cancel) and #1809 (reassign) have not been written, so the flows below are a proposal built to fit the rest of the backlog. Review them as design intent, not as agreed requirements.',
    interventionHint:
      'Cancelling ends the trip immediately and notifies both the rider and the driver. Reassigning hands the trip to another online driver without the rider having to re-book.',
    interventionHintNoDriver:
      'No driver is assigned yet, so this trip can only be cancelled — there is nothing to reassign from.',
    cancelBtn: 'Cancel this trip',
    reassignBtn: 'Reassign to another driver',

    cancelTitle: 'Cancel this trip?',
    cancelDescription:
      'The trip ends immediately and both the rider and the driver are notified. This cannot be undone, and it is recorded in the audit log.',
    cancelConfirm: 'Cancel trip',
    cancelKeep: 'Keep the trip',
    cancelReasonLabel: 'Cancellation reason',
    cancelReasonEmpty: 'Select a cancellation reason',
    noteLabel: 'Explanatory note',
    noteEmptyOther: 'A note is required when the reason is "Other"',
    noteTooLong: 'Too long — must be ≤ 500 characters',
    toastCancelled: 'Trip cancelled. Rider and driver have been notified.',

    noDriverTitle: 'No driver available',
    noDriverDescription:
      'No approved driver is online and free right now. Reassignment needs a driver who is online and not already on a trip. Try again shortly, or cancel the trip instead.',
    noDriverBack: 'Back',
    reassignTitle: 'Reassign to another driver',
    reassignDescription:
      'The trip stays live and moves to the new driver, so the rider does not have to book again. Only approved drivers who are online and not already on a trip are listed.',
    reassignConfirm: 'Reassign trip',
    newDriverLabel: 'New driver',
    newDriverPlaceholder: 'Select a driver…',
    newDriverEmpty: 'Select the driver taking over',
    reassignReasonLabel: 'Reason for reassignment',
    reassignReasonEmpty: 'Select a reason',
    toastReassigned: 'Trip reassigned to {name}.',
  },

  application: {
    title: 'Driver application',
    crumb: 'Application',
    notFoundHeading: 'Application not found',
    notFoundMessage: 'This application no longer exists, or it has already been reviewed.',
    backToQueue: 'Back to the queue',

    personal: 'Personal details',
    vehicle: 'Vehicle details',
    licence: 'Licence & registration',
    docsHeading: 'Uploaded documents',
    docsHint:
      'Click a document to open it larger. Images here are placeholders — the mockup never carries real ID scans.',
    photosHeading: 'Vehicle & profile photo',
    decisionHeading: 'Decision',
    decisionHint:
      'Approving lets this driver go online. Rejecting requires a reason, which the driver is notified with.',
    summary: 'Submission',

    waiting: 'Waiting',
    approveBtn: 'Approve application',
    rejectBtn: 'Reject application',

    approveTitle: 'Approve this application?',
    approveDescription:
      'The driver is notified and can go online immediately. This is recorded in the audit log.',
    toastApproved: 'Application approved. The driver can now go online.',

    rejectTitle: 'Reject this application',
    rejectDescription: 'The driver is notified with the reason you select.',
    rejectReasonLabel: 'Rejection reason',
    rejectReasonEmpty: 'Select a rejection reason',
    rejectNoteLabel: 'Note to the driver',
    rejectNoteHint: 'Optional unless the reason needs explaining.',
    noteTooLong: 'Too long — must be ≤ 500 characters',
    toastRejected: 'Application rejected. The driver has been notified.',
  },

  driverProfile: {
    title: 'Driver profile',
    crumb: 'Profile',
    notFoundHeading: 'Driver not found',
    notFoundMessage: 'This driver account does not exist.',
    backToDrivers: 'Back to drivers',

    personal: 'Personal details',
    vehicle: 'Vehicle details',
    docsHeading: 'Documents & photos',
    historyHeading: 'Decision history',
    tripsHeading: 'Completed trips',
    statusHeading: 'Account status',
    statsHeading: 'Performance',
    actionsHeading: 'Account actions',

    colDestinationArea: 'Destination area',
    colFare: 'Fare collected',
    colRating: 'Rider rating received',
    emptyTripsHeading: 'No completed trips',
    emptyTripsMessage: 'This driver has not completed a trip yet.',

    pendingSuspensionReason: 'Pending suspension reason',
    suspensionReason: 'Suspension reason',
    suspendedBy: 'Suspended by',
    suspendedAt: 'Suspended at',
    rejectionReason: 'Rejection reason',
    reinstatementReason: 'Reinstatement reason',
    reinstatedBy: 'Reinstated by',
    reinstatedAt: 'Reinstated at',
    avgRating: 'Average rider rating',
    noRatingsYet: 'No ratings yet',
    cashBalance: 'Outstanding cash balance',

    suspendBtn: 'Suspend driver',
    reinstateBtn: 'Reinstate driver',
    hintSuspend:
      'Suspending sets the driver offline and invalidates her sessions. If she is on a trip, the suspension applies as soon as that trip ends.',
    hintReinstate: 'Reinstating lets the driver log in and go online again.',
    hintPending:
      'This application is still pending — approve or reject it from the applications queue.',
    hintRejected: 'No account actions are available for a rejected driver.',

    suspendTitle: 'Suspend this driver',
    suspendDescription:
      'The driver goes offline and cannot accept trips until reinstated. Recorded in the audit log.',
    suspendConfirm: 'Suspend driver',
    suspendReasonLabel: 'Suspension reason',
    suspendReasonEmpty: 'Select a suspension reason',
    noteLabel: 'Explanatory note',
    noteEmptyOther: 'A note is required when the reason is "Other"',
    noteTooLong: 'Too long — must be ≤ 500 characters',
    toastPendingSuspension:
      'Driver marked Pending suspension — it applies when her active trip ends.',
    toastSuspended: 'Driver suspended and set offline.',

    reinstateTitle: 'Reinstate this driver?',
    reinstateDescription:
      'She will be able to log in and go online again immediately. Reinstating is as consequential as suspending, so it carries its own recorded reason and is written to the audit log.',
    reinstateConfirm: 'Reinstate driver',
    reinstateReasonLabel: 'Reinstatement reason',
    reinstateReasonEmpty: 'Select a reinstatement reason',
    toastReinstated: 'Driver reinstated — {reason}.',
  },

  riderProfile: {
    title: 'Rider profile',
    crumb: 'Profile',
    notFoundHeading: 'Rider not found',
    notFoundMessage: 'This rider account does not exist.',
    backToRiders: 'Back to riders',

    personal: 'Rider details',
    tripsHeading: 'Trip history',
    tripsHint: 'Read-only. Trip rows are deliberately not clickable in this phase.',
    statusHeading: 'Account status',
    actionsHeading: 'Account actions',

    colDestination: 'Destination address',
    colFare: 'Fare (EGP)',
    colStatus: 'Trip status',
    emptyTripsHeading: 'No trips yet',
    emptyTripsMessage: 'This rider has never completed a trip.',

    registeredAt: 'Registration date',
    lastTrip: 'Date of last trip',
    noTripsYet: 'No trips yet',
    suspensionReason: 'Suspension reason',
    suspendedBy: 'Suspended by',
    suspendedOn: 'Suspended on',
    reinstatementReason: 'Reinstatement reason',
    reinstatedBy: 'Reinstated by',
    reinstatedAt: 'Reinstated at',
    reportLabel: 'Gender-mismatch report',
    reportLink: '{id} — open report →',
    reportUnavailable: 'Flagged automatically — report record not available',

    suspendBtn: 'Suspend rider',
    reinstateBtn: 'Reinstate rider',
    hintSuspend: 'Suspending invalidates her sessions and blocks new bookings until reinstated.',
    hintReinstate: 'Reinstating lets her book rides again immediately.',
    hintUnderReview:
      'This rider is under review from a gender-mismatch report — resolve it from the linked report.',

    suspendTitle: 'Suspend this rider',
    suspendDescription: 'She will be unable to book rides until reinstated. Recorded in the audit log.',
    suspendConfirm: 'Suspend rider',
    suspendReasonLabel: 'Suspension reason',
    suspendReasonEmpty: 'Select a suspension reason',
    noteLabel: 'Explanatory note',
    noteEmptyOther: 'A note is required when the reason is "Other"',
    noteTooLong: 'Too long — must be ≤ 500 characters',
    toastSuspended: 'Rider suspended.',

    reinstateTitle: 'Reinstate this rider?',
    reinstateDescription:
      'She will be able to book rides again immediately. Reinstating is as consequential as suspending, so it carries its own recorded reason and is written to the audit log.',
    reinstateConfirm: 'Reinstate rider',
    reinstateReasonLabel: 'Reinstatement reason',
    reinstateReasonEmpty: 'Select a reinstatement reason',
    toastReinstated: 'Rider reinstated — {reason}.',
  },

  safetyReport: {
    title: 'Gender-mismatch report',
    crumb: 'Report',
    notFoundHeading: 'Report not found',
    notFoundMessage: 'This report record does not exist.',
    backToQueue: 'Back to the queue',

    statementHeading: "Reporting driver's statement",
    tripSnapshot: 'Trip snapshot',
    riderState: 'Reported rider',
    driverInfo: 'Reporting driver',
    reportMeta: 'Report',
    resolveHeading: 'Resolution',

    tripId: 'Trip ID',
    tripUnavailableLabel: 'Trip',
    tripUnavailable: 'Trip record not available',
    pickup: 'Pickup',
    destination: 'Destination',
    estimatedFare: 'Estimated fare',
    zone: 'Zone',
    expiryReason: 'Expiry reason',
    riderStatus: 'Current account status',
    recordedReason: 'Recorded reason',
    reportId: 'Report ID',
    reportedAt: 'Reported at',
    resolvedAt: 'Resolved at',
    resolvedBy: 'Resolved by',
    resolutionNote: 'Resolution note',
    openLink: '{value} →',

    suspendBtn: 'Suspend the reported rider',
    dismissBtn: 'Dismiss the report',
    hintOpen:
      'Suspending applies the same suspension as a manual rider suspension. Dismissing returns her from Pending review to Active. Either way the decision is written to the audit log.',
    hintResolvedSuspended: 'Already resolved — the rider was suspended. No further action is available.',
    hintResolvedDismissed: 'Already resolved — the report was dismissed. No further action is available.',

    suspendTitle: 'Suspend the reported rider',
    suspendDescription:
      'This upholds the report. Her sessions are invalidated and she cannot book until reinstated.',
    suspendConfirm: 'Suspend rider',
    noteLabel: 'Note (optional)',
    suspendNoteHint:
      'The gender-mismatch report is already the recorded reason, so a note is optional.',
    noteTooLong: 'Too long — must be ≤ 500 characters',
    toastUpheld: 'Report upheld. The rider has been suspended.',

    dismissTitle: 'Dismiss this report?',
    dismissDescription:
      'The report is marked unfounded and the rider returns from Pending review to Active.',
    dismissConfirm: 'Dismiss report',
    toastDismissed: 'Report dismissed. The rider is active again.',
  },
};

export const ar = {
  field: {
    fullName: 'الإسم الكامل',
    dob: 'تاريخ الميلاد',
    nid: 'الرقم القومي',
    homeArea: 'منطقة السكن',
    licenceNumber: 'رقم رخصة القيادة',
    licence: 'رخصة القيادة',
    licenceExpiry: 'نهاية الرخصة',
    registrationExpiry: 'نهاية رخصة المركبة',
    expiredSuffix: ' — منتهية',
    make: 'الماركة',
    model: 'الموديل',
    year: 'سنة الصنع',
    plate: 'رقم اللوحة',
    colour: 'اللون',
    type: 'النوع',
    vehicle: 'بيانات المركبة',
    submitted: 'تاريخ التقديم',
    onlineNow: 'متصلة الآن',
    totalTrips: 'الرحلات المكتملة',
    tripDate: 'تاريخ الرحلة',
    noRating: 'لا يوجد تقييم',
  },

  docs: {
    national_id: 'صورة الهوية الوطنية',
    driving_licence: 'رخصة القيادة',
    vehicle_registration: 'تسجيل المركبة',
    criminal_record: 'شهادة الفحص الجنائي',
    profilePhoto: 'الصورة الشخصية',
    vehiclePhoto: 'صورة المركبة',
    vehicleFront: 'صورة أمامية للمركبة',
    vehicleLeft: 'الجانب الأيسر للمركبة',
    vehicleRear: 'صورة خلفية للمركبة',
    vehicleInterior: 'صورة داخلية للمركبة',
    uploaded: 'رُفع في {date}',
    submitted: 'قُدّم في {date}',
  },

  reason: {
    other: 'سبب آخر',
    // إيقاف السائقة (#1742)
    unsafe_driving_reported_by_riders: 'تم الإبلاغ عن قيادة غير آمنة من قِبل الراكبات',
    repeated_trip_cancellations: 'تكرار إلغاء الرحلات',
    document_expired_and_not_renewed: 'انتهاء صلاحية المستند وعدم تجديده',
    policy_violation_unauthorised_passenger: 'مخالفة السياسات — اصطحاب راكب غير مصرح به',
    unsafe_driving_reported_by_riders_applies_when_the_active_trip_ends:
      'تم الإبلاغ عن قيادة غير آمنة من قِبل الراكبات — يُطبّق عند انتهاء الرحلة الجارية',
    // إيقاف الراكبة (#1740)
    gender_mismatch_report_upheld: 'تأكيد بلاغ عدم تطابق النوع',
    abusive_behaviour_towards_a_driver: 'سلوك مسيء تجاه السائقة',
    repeated_no_shows: 'تكرار عدم الحضور',
    fraudulent_payment_activity: 'نشاط دفع احتيالي',
    // رفض الطلب (#1660)
    driving_licence_expired: 'رخصة القيادة منتهية',
    vehicle_registration_does_not_match_the_applicant:
      'بيانات تسجيل المركبة لا تتطابق مع بيانات المتقدمة',
    national_id_document_illegible: 'مستند بطاقة الهوية الوطنية غير واضح',
    vehicle_older_than_the_platform_minimum: 'المركبة أقدم من الحد المسموح به',
    applicant_did_not_meet_the_minimum_age_requirement:
      'المتقدمة لا تستوفي الحد الأدنى للعمر المطلوب',
    // إلغاء الرحلة (#1808)
    rider_requested_cancellation: 'الراكبة طلبت إلغاء الرحلة',
    driver_unresponsive: 'السائقة لا تستجيب',
    safety_concern_raised: 'تم الإبلاغ عن مخاوف تتعلق بالسلامة',
    vehicle_breakdown: 'تعطل المركبة',
    duplicate_or_test_trip: 'رحلة مكررة أو تجريبية',
    // إعادة تعيين الرحلة (#1809)
    driver_too_far_from_pickup: 'السائقة بعيدة جدًا عن نقطة الالتقاء',
    driver_requested_handover: 'السائقة طلبت تسليم الرحلة',
    // إلغاء الإيقاف (#1743 / #1741)
    suspension_lifted_after_review: 'رفع الإيقاف بعد المراجعة',
    documents_renewed_and_verified: 'تم تجديد المستندات والتحقق منها',
    policy_violation_resolved: 'تمت معالجة مخالفة السياسات',
    suspended_in_error: 'تم الإيقاف عن طريق الخطأ',
    gender_mismatch_report_overturned: 'إلغاء بلاغ عدم تطابق النوع',
    payment_issue_resolved: 'تمت معالجة مشكلة الدفع',
  },

  tripDetail: {
    title: 'تفاصيل الرحلة',
    crumb: 'الرحلة',
    notFoundHeading: 'لم يتم العثور على الرحلة',
    notFoundMessage: 'سجل هذه الرحلة غير موجود.',
    backToTrips: 'العودة لقائمة الرحلات',

    parties: 'الراكبة والسائقة',
    route: 'الإلتقاط والوجهة',
    timelineHeading: 'التسلسل الزمني للحالات',
    timelineHint: 'كل تحول مرّت به هذه الرحلة، بتوقيت UTC+2.',
    mapHeading: 'المسار الفعلي',
    summary: 'تفاصيل الرحلة',
    estimate: 'التقدير الأولي للأجرة',
    fareHeading: 'تفاصيل الأجرة',
    ratingHeading: 'تقييم الراكبة',
    actionsHeading: 'تدخل الإدارة',
    cancellation: 'الإلغاء',

    rider: 'إسم الراكبة',
    riderPhone: 'هاتف الراكبة',
    driver: 'إسم السائقة',
    driverPhone: 'هاتف السائقة',
    notAssigned: 'لم يتم التعيين',
    pickup: 'مكان الإلتقاط',
    destination: 'الوجهة',
    pickupArea: 'دائرة الإلتقاط',
    destinationArea: 'دائرة الوجهة',
    serviceZone: 'منطقة الخدمة',
    tripId: 'كود الرحلة',
    created: 'إنشأت في',
    lastUpdate: 'آخر تحديث',
    expiryReason: 'سبب الإنتهاء',
    cancelledBy: 'أُلغيت بواسطة',
    cancelledAt: 'تاريخ الإلغاء',
    adminActor: 'إدارة شي درايف',
    paymentMethod: 'وسيلة الدفع',
    estimatedFare: 'الأجرة التقديرية',
    estimatedTime: 'المدة التقديرية للرحلة',
    estimatedDistance: 'المسافة التقديرية',
    baseFare: 'الأجرة الأساسية',
    distanceCharge: 'رسوم المسافة',
    timeCharge: 'رسوم الوقت',
    totalFare: 'إجمالي الأجرة',
    cashCollected: 'المبلغ المحصّل',
    noRating: 'لا يوجد تقييم',
    starsAria: '{stars} من 5 نجوم',
    reasonNote: 'السبب: {reason}',
    routeSummary: '{distance} خلال {duration} — مسار GPS المسجّل من الإلتقاط حتى النزول.',

    expiry: {
      no_driver: 'لا يوجد سائقة',
      system_timeout: 'انتهاء مهلة النظام',
      gender_mismatch_report: 'بلاغ عدم تطابق النوع',
    },

    proposalStrong: 'سلوك مقترح — بانتظار اعتماد محلل الأعمال.',
    proposalBody:
      'لم تُكتب بعد القصتان #1808 (الإلغاء) و#1809 (إعادة التعيين)، لذا فإن التدفقات أدناه مجرد اقتراح صُمم ليتوافق مع باقي قائمة الأعمال. راجعها بوصفها نية تصميمية لا متطلبات معتمدة.',
    interventionHint:
      'الإلغاء ينهي الرحلة فورًا ويُخطر الراكبة والسائقة معًا. وإعادة التعيين تُسلّم الرحلة إلى سائقة أخرى متصلة دون أن تضطر الراكبة إلى الحجز من جديد.',
    interventionHintNoDriver:
      'لم يتم تعيين سائقة بعد، لذا يمكن إلغاء هذه الرحلة فقط — لا يوجد ما يُعاد تعيينه.',
    cancelBtn: 'إلغاء الرحلة',
    reassignBtn: 'إعادة تعيين لسائقة أخرى',

    cancelTitle: 'هل تريد إلغاء هذه الرحلة؟',
    cancelDescription:
      'تنتهي الرحلة فورًا ويتم إخطار الراكبة والسائقة معًا. لا يمكن التراجع عن هذا الإجراء، وسيتم تسجيله في سجل التدقيق.',
    cancelConfirm: 'تأكيد إلغاء الرحلة',
    cancelKeep: 'الإبقاء على الرحلة',
    cancelReasonLabel: 'سبب الإلغاء',
    cancelReasonEmpty: 'اختر سبب الإلغاء',
    noteLabel: 'ملحوظة توضيحية',
    noteEmptyOther: 'الملاحظة مطلوبة عندما يكون السبب «سبب آخر»',
    noteTooLong: 'النص طويل — يجب ألا يتجاوز 500 حرف',
    toastCancelled: 'تم إلغاء الرحلة. وتم إخطار الراكبة والسائقة.',

    noDriverTitle: 'لا توجد سائقة متاحة',
    noDriverDescription:
      'لا توجد حاليًا سائقة مقبولة متصلة وغير مرتبطة برحلة. تحتاج إعادة التعيين إلى سائقة متصلة وغير مشغولة برحلة. حاول بعد قليل، أو ألغِ الرحلة بدلًا من ذلك.',
    noDriverBack: 'رجوع',
    reassignTitle: 'إعادة تعيين لسائقة أخرى',
    reassignDescription:
      'تظل الرحلة قائمة وتنتقل إلى السائقة الجديدة، فلا تحتاج الراكبة إلى الحجز مرة أخرى. تُعرض فقط السائقات المقبولات المتصلات وغير المرتبطات برحلة.',
    reassignConfirm: 'إعادة تعيين الرحلة',
    newDriverLabel: 'السائقة الجديدة',
    newDriverPlaceholder: 'إختاري السائقة …',
    newDriverEmpty: 'اختر السائقة التي ستتولى الرحلة',
    reassignReasonLabel: 'سبب إعادة التعيين',
    reassignReasonEmpty: 'اختر السبب',
    toastReassigned: 'تمت إعادة تعيين الرحلة إلى {name}.',
  },

  application: {
    title: 'طلب تسجيل السائقة',
    crumb: 'الطلب',
    notFoundHeading: 'لم يتم العثور على الطلب',
    notFoundMessage: 'لم يعد هذا الطلب موجودًا أو تمت مراجعته بالفعل.',
    backToQueue: 'العودة لقائمة الطلبات',

    personal: 'البيانات الشخصية',
    vehicle: 'بيانات المركبة',
    licence: 'الرخصة وترخيص المركبة',
    docsHeading: 'المستندات المرفوعة',
    docsHint:
      'اضغط على أي مستند لعرضه بحجم أكبر. الصور هنا نائبة — لا يحمل النموذج التجريبي صورًا حقيقية للهويات.',
    photosHeading: 'صور المركبة والصورة الشخصية',
    decisionHeading: 'القرار',
    decisionHint:
      'الموافقة تتيح لهذه السائقة الاتصال بالمنصة. أما الرفض فيتطلب سببًا يتم إخطار السائقة به.',
    summary: 'التقديم والحالة',

    waiting: 'الإنتظار',
    approveBtn: 'موافقة الطلب',
    rejectBtn: 'رفض الطلب',

    approveTitle: 'هل تريد الموافقة على هذا الطلب؟',
    approveDescription:
      'سيتم إخطار السائقة، ويمكنها الاتصال بالمنصة فورًا. وسيتم تسجيل هذا الإجراء في سجل التدقيق.',
    toastApproved: 'تمت الموافقة على الطلب. يمكن للسائقة الآن الاتصال بالمنصة.',

    rejectTitle: 'رفض الطلب',
    rejectDescription: 'سيتم إخطار السائقة بالسبب الذي تختاره.',
    rejectReasonLabel: 'سبب الرفض',
    rejectReasonEmpty: 'اختر سبب الرفض',
    rejectNoteLabel: 'ملاحظة للسائقة',
    rejectNoteHint: 'اختيارية ما لم يكن السبب بحاجة إلى توضيح.',
    noteTooLong: 'النص طويل — يجب ألا يتجاوز 500 حرف',
    toastRejected: 'تم رفض الطلب. وتم إخطار السائقة.',
  },

  driverProfile: {
    title: 'ملف السائقة',
    crumb: 'الملف',
    notFoundHeading: 'لم يتم العثور على السائقة',
    notFoundMessage: 'حساب هذه السائقة غير موجود.',
    backToDrivers: 'العودة لقائمة السائقات',

    personal: 'البيانات الشخصية',
    vehicle: 'بيانات المركبة',
    docsHeading: 'المستندات والصور',
    historyHeading: 'سجل القرارات',
    tripsHeading: 'الرحلات المكتملة',
    statusHeading: 'حالة الحساب',
    statsHeading: 'الأداء',
    actionsHeading: 'إجراءات الحساب',

    colDestinationArea: 'منطقة الوجهة',
    colFare: 'الأجرة المستحقة',
    colRating: 'تقييم الراكبة',
    emptyTripsHeading: 'لا توجد رحلات مكتملة',
    emptyTripsMessage: 'لم تُكمل هذه السائقة أي رحلة حتى الآن.',

    pendingSuspensionReason: 'سبب الإيقاف المعلّق',
    suspensionReason: 'سبب الوقف',
    suspendedBy: 'أوقفها',
    suspendedAt: 'تاريخ الإيقاف',
    rejectionReason: 'سبب الرفض',
    reinstatementReason: 'سبب إلغاء الإيقاف',
    reinstatedBy: 'أعادت التفعيل',
    reinstatedAt: 'تاريخ إعادة التفعيل',
    avgRating: 'متوسط تقييم الراكبات',
    noRatingsYet: 'لا توجد تقييمات بعد',
    cashBalance: 'المبلغ المستحق',

    suspendBtn: 'إيقاف السائقة',
    reinstateBtn: 'إلغاء إيقاف السائقة',
    hintSuspend:
      'الإيقاف يجعل السائقة غير متصلة ويُلغي جلساتها. وإذا كانت في رحلة، يُطبّق الإيقاف بمجرد انتهاء تلك الرحلة.',
    hintReinstate: 'إلغاء الإيقاف يتيح للسائقة تسجيل الدخول والاتصال بالمنصة مرة أخرى.',
    hintPending: 'هذا الطلب ما زال قيد المراجعة — وافق عليه أو ارفضه من قائمة الطلبات.',
    hintRejected: 'لا تتوفر إجراءات على حساب سائقة مرفوضة.',

    suspendTitle: 'وقف هذه السائقة',
    suspendDescription:
      'تصبح السائقة غير متصلة ولا يمكنها قبول الرحلات حتى يتم إلغاء الإيقاف. ويُسجَّل ذلك في سجل التدقيق.',
    suspendConfirm: 'إيقاف السائقة',
    suspendReasonLabel: 'سبب الوقف',
    suspendReasonEmpty: 'اختر سبب الوقف',
    noteLabel: 'ملحوظة توضيحية',
    noteEmptyOther: 'الملاحظة مطلوبة عندما يكون السبب «سبب آخر»',
    noteTooLong: 'النص طويل — يجب ألا يتجاوز 500 حرف',
    toastPendingSuspension: 'تم تعليم السائقة «قيد الإيقاف» — يُطبّق عند انتهاء رحلتها الجارية.',
    toastSuspended: 'تم إيقاف السائقة وجعلها غير متصلة.',

    reinstateTitle: 'إلغاء إيقاف السائقة؟',
    reinstateDescription:
      'ستتمكن من تسجيل الدخول والاتصال بالمنصة فورًا. وإلغاء الإيقاف لا يقل أهمية عن الإيقاف، لذا يحمل سببًا مسجّلًا خاصًا به ويُكتب في سجل التدقيق.',
    reinstateConfirm: 'إلغاء إيقاف السائقة',
    reinstateReasonLabel: 'سبب إلغاء الإيقاف',
    reinstateReasonEmpty: 'اختر سبب إلغاء الإيقاف',
    toastReinstated: 'تم إلغاء إيقاف السائقة — {reason}.',
  },

  riderProfile: {
    title: 'ملف الراكبة',
    crumb: 'الملف',
    notFoundHeading: 'لم يتم العثور على الراكبة',
    notFoundMessage: 'حساب هذه الراكبة غير موجود.',
    backToRiders: 'العودة لقائمة الراكبات',

    personal: 'بيانات الراكبة',
    tripsHeading: 'سجل الرحلات',
    tripsHint: 'للعرض فقط. صفوف الرحلات غير قابلة للضغط عمدًا في هذه المرحلة.',
    statusHeading: 'حالة الحساب',
    actionsHeading: 'إجراءات الحساب',

    colDestination: 'عنوان الوجهة',
    colFare: 'الأجرة (جنيه)',
    colStatus: 'حالة الرحلة',
    emptyTripsHeading: 'لا توجد رحلات بعد',
    emptyTripsMessage: 'لم تُكمل هذه الراكبة أي رحلة من قبل.',

    registeredAt: 'تاريخ التسجيل',
    lastTrip: 'تاريخ آخر رحلة',
    noTripsYet: 'لا توجد رحلات بعد',
    suspensionReason: 'سبب الوقف',
    suspendedBy: 'أوقفها',
    suspendedOn: 'تاريخ الإيقاف',
    reinstatementReason: 'سبب إلغاء الإيقاف',
    reinstatedBy: 'أعادت التفعيل',
    reinstatedAt: 'تاريخ إعادة التفعيل',
    reportLabel: 'بلاغ عدم تطابق النوع',
    reportLink: '{id} — فتح البلاغ ←',
    reportUnavailable: 'تم التعليم تلقائيًا — سجل البلاغ غير متاح',

    suspendBtn: 'إيقاف الراكبة',
    reinstateBtn: 'إعادة تفعيل الراكبة',
    hintSuspend: 'الإيقاف يُلغي جلساتها ويمنع الحجوزات الجديدة حتى يتم إعادة التفعيل.',
    hintReinstate: 'إعادة التفعيل تتيح لها طلب الرحلات فورًا.',
    hintUnderReview:
      'هذه الراكبة قيد المراجعة بسبب بلاغ عدم تطابق النوع — عالج البلاغ من الرابط المرفق.',

    suspendTitle: 'وقف هذه الراكبة',
    suspendDescription: 'لن تتمكن من طلب الرحلات حتى يتم إعادة التفعيل. ويُسجَّل ذلك في سجل التدقيق.',
    suspendConfirm: 'إيقاف الراكبة',
    suspendReasonLabel: 'سبب الوقف',
    suspendReasonEmpty: 'اختر سبب الوقف',
    noteLabel: 'ملحوظة توضيحية',
    noteEmptyOther: 'الملاحظة مطلوبة عندما يكون السبب «سبب آخر»',
    noteTooLong: 'النص طويل — يجب ألا يتجاوز 500 حرف',
    toastSuspended: 'تم إيقاف الراكبة.',

    reinstateTitle: 'إعادة تفعيل الراكبة؟',
    reinstateDescription:
      'ستتمكن من طلب الرحلات فورًا. وإعادة التفعيل لا تقل أهمية عن الإيقاف، لذا تحمل سببًا مسجّلًا خاصًا بها وتُكتب في سجل التدقيق.',
    reinstateConfirm: 'إعادة تفعيل الراكبة',
    reinstateReasonLabel: 'سبب إعادة التفعيل',
    reinstateReasonEmpty: 'اختر سبب إعادة التفعيل',
    toastReinstated: 'تمت إعادة تفعيل الراكبة — {reason}.',
  },

  safetyReport: {
    title: 'بلاغ عدم تطابق النوع',
    crumb: 'البلاغ',
    notFoundHeading: 'لم يتم العثور على البلاغ',
    notFoundMessage: 'سجل هذا البلاغ غير موجود.',
    backToQueue: 'العودة لقائمة البلاغات',

    statementHeading: 'إفادة السائقة المُبلِّغة',
    tripSnapshot: 'بيانات الرحلة',
    riderState: 'الراكبة المُبلَّغ عنها',
    driverInfo: 'السائقة المُبلِّغة',
    reportMeta: 'البلاغ',
    resolveHeading: 'المعالجة',

    tripId: 'كود الرحلة',
    tripUnavailableLabel: 'الرحلة',
    tripUnavailable: 'سجل الرحلة غير متاح',
    pickup: 'مكان الإلتقاط',
    destination: 'الوجهة',
    estimatedFare: 'الأجرة التقديرية',
    zone: 'المنطقة',
    expiryReason: 'سبب الإنتهاء',
    riderStatus: 'حالة الحساب الحالية',
    recordedReason: 'السبب المسجّل',
    reportId: 'كود البلاغ',
    reportedAt: 'تاريخ الإبلاغ',
    resolvedAt: 'تاريخ المعالجة',
    resolvedBy: 'عالجه',
    resolutionNote: 'ملاحظة المعالجة',
    openLink: '{value} ←',

    suspendBtn: 'إيقاف الراكبة المُبلَّغ عنها',
    dismissBtn: 'استبعاد البلاغ',
    hintOpen:
      'الإيقاف يطبّق نفس إجراء إيقاف الراكبة اليدوي. والاستبعاد يعيدها من «قيد المراجعة» إلى «نشط». وفي الحالتين يُكتب القرار في سجل التدقيق.',
    hintResolvedSuspended: 'تمت المعالجة بالفعل — تم إيقاف الراكبة. لا يتوفر أي إجراء آخر.',
    hintResolvedDismissed: 'تمت المعالجة بالفعل — تم استبعاد البلاغ. لا يتوفر أي إجراء آخر.',

    suspendTitle: 'إيقاف الراكبة المُبلَّغ عنها',
    suspendDescription:
      'هذا يؤكد صحة البلاغ. تُلغى جلساتها ولا يمكنها الحجز حتى يتم إعادة التفعيل.',
    suspendConfirm: 'إيقاف الراكبة',
    noteLabel: 'ملاحظة (اختيارية)',
    suspendNoteHint: 'بلاغ عدم تطابق النوع هو السبب المسجّل بالفعل، لذا فالملاحظة اختيارية.',
    noteTooLong: 'النص طويل — يجب ألا يتجاوز 500 حرف',
    toastUpheld: 'تم تأكيد البلاغ. وتم إيقاف الراكبة.',

    dismissTitle: 'هل تريد استبعاد هذا البلاغ؟',
    dismissDescription: 'يُعلَّم البلاغ بأنه غير صحيح وتعود الراكبة من «قيد المراجعة» إلى «نشط».',
    dismissConfirm: 'استبعاد البلاغ',
    toastDismissed: 'تم استبعاد البلاغ. الراكبة نشطة مرة أخرى.',
  },
};
