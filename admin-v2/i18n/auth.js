/**
 * i18n/auth.js — strings for the sign-in screen and the six standalone kit auth pages.
 *
 * Same shape as core.js: export `en` and `ar` objects of namespaces.
 * Namespaces merge across area files, so extending an existing namespace here
 * is fine — just do not restate a key core.js already owns.
 *
 * Arabic follows the kit's own Arabic auth pages (login_ar.html, 2fa_ar.html,
 * 2fa-frist-time_ar.html, otp_ar.html, recovery-code_ar.html,
 * password-forgot_ar.html, password-new_ar.html) wherever they name a thing:
 * تسجيل الدخول، المصادقة الثنائية، رمز الاسترداد، إعادة تعيين كلمة المرور …
 *
 * `auth.validation.*` and `auth.error.*` are deliberately namespaced under
 * `auth` rather than a top-level `validation`, so this file can never collide
 * with i18n/components.js.
 *
 * The English half of every `auth.validation.*` and `auth.error.*` string is
 * verbatim from the Field Validation tables of #1656 / #1806 / #1822 — do not
 * reword it. The Arabic half is a faithful equivalent.
 */

export const en = {
  auth: {
    // ── Document titles ──────────────────────────────
    docTitle: {
      signIn: 'SheDrive Admin — Sign in',
      twoFactor: 'SheDrive Admin — Two-factor authentication',
      enrol: 'SheDrive Admin — Set up two-factor authentication',
      recovery: 'SheDrive Admin — Recovery code',
      forgot: 'SheDrive Admin — Reset your password',
      change: 'SheDrive Admin — Choose a new password',
      otp: 'SheDrive Admin — Email verification code',
    },

    // ── Step 1 — credentials (#1656) ─────────────────
    signIn: 'Sign in',
    signInIntro: 'Operations staff only. Two-factor authentication is required.',
    emailLabel: 'Email',
    emailPlaceholder: 'Email',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    showHidePassword: 'Show or hide password',
    showHideNewPassword: 'Show or hide new password',
    showHideConfirmPassword: 'Show or hide confirmed password',
    continue: 'Continue',
    checking: 'Checking…',
    forgotPassword: 'Forgot your password?',

    // ── Step 2 — second factor (#1806) ───────────────
    tfaTitle: 'Two-factor authentication',
    tfaHint: 'Enter the 6-digit code from your authenticator app.',
    tfaHintEnrolled:
      'Enrolment saved. Enter a code from your authenticator app to finish signing in.',
    verify: 'Verify',
    verifying: 'Verifying…',
    codeDigit: 'Authentication code digit {n}',
    verifyDigit: 'Verification code digit {n}',
    mockTotp: 'Mockup code: 123456',
    mockRecovery: 'Mockup code: SD-RECOVERY-01',
    recoveryLabel: 'Recovery code',
    recoveryPlaceholder: 'Exp. SD-RECOVERY-01',
    useRecovery: 'Lost your device? Use a recovery code',
    useAuthenticator: 'Use your authenticator app instead',
    backToSignIn: 'Back to sign in',

    // ── First-time enrolment (#1806 Scenario 1) ──────
    enrolTitle: 'Set up two-factor authentication',
    enrolStep1: 'Scan QR code',
    enrolStep1Body:
      'Scan the QR code with your authenticator app, or copy the setup key below and enter it manually if you cannot scan it.',
    qrAlt: 'Authenticator setup QR code — mockup placeholder',
    copySetupKey: 'Copy setup key',
    qrStub: 'Mockup placeholder — the QR code is decorative and not scannable.',
    recoveryCodesLabel: 'Recovery codes — shown once',
    enrolStep2: 'Verify code',
    enrolStep2Body:
      'Enter the 6-digit verification code from your authenticator app to finish enrolment.',
    enrolContinue: 'I have saved my recovery codes',

    // ── Forced first-login password change (#1822) ───
    changeTitle: 'Choose a new password',
    changeIntro:
      'This is your first sign-in, so you must set your own password before continuing.',
    newPasswordLabel: 'New password',
    newPasswordPlaceholder: 'Type the new password',
    confirmPasswordLabel: 'Confirm new password',
    confirmPasswordPlaceholder: 'Re-type the new password',
    requirementLength: 'Must be at least 8 characters long.',
    requirementMatch: 'Both entries must match.',
    setPassword: 'Set password and continue',

    // ── Password reset request (#1822) ───────────────
    forgotTitle: 'Reset your password',
    forgotIntro:
      'Enter your registered email address. We will email a reset link to your SheDrive admin address.',
    forgotSuccess: 'If that email belongs to an admin account, a reset link is on its way.',
    forgotEmailPlaceholder: 'Enter registered email',
    sendResetLink: 'Send reset link',

    // ── Email one-time code screen (otp.html) ────────
    otpTitle: 'Email verification code',
    otpIntro:
      'Enter the code sent to your SheDrive admin email address to verify your account.',
    otpSubmit: 'Confirm & send code',
    resendCode: 'Resend code',
    seconds: 'seconds',
    otpFooter:
      'Mockup screen — the email one-time code is not wired to a real mailbox. Any code other than the seeded demo code is rejected.',

    // ── Mockup footer ────────────────────────────────
    footerCredentials:
      'Mockup credentials — any admin email in the seed data with password',
    footerTry: 'Try',
    screenIndex: 'Screen index',

    // ── Standalone kit pages that hand over to index.html ──
    redirect: {
      continue: 'Continue to the sign-in screen',
      twoFactor:
        'Opening the two-factor step of the sign-in screen — the 6-digit authenticator code (#1806).',
      enrol:
        'Opening the first-time enrolment step of the sign-in screen — QR code, setup key and recovery codes (#1806 Scenario 1).',
      recovery:
        'Opening the two-factor step of the sign-in screen with the recovery-code field showing (#1806).',
      forgot: 'Opening the password reset request step of the sign-in screen (#1822).',
      change:
        'Opening the forced first-login password change step of the sign-in screen (#1822).',
    },

    // ── Validation (#1656 / #1806 / #1822 tables) ────
    validation: {
      emailRequired: 'Enter your email address',
      emailTooLong: 'Email must be ≤ 254 characters',
      emailInvalid: 'Invalid email address',
      passwordRequired: 'Enter your password',
      passwordTooShort: 'Password must be at least 8 characters',
      newPasswordRequired: 'Enter a new password',
      passwordsMismatch: 'Passwords do not match',
      codeRequired: 'Enter the authentication code',
      codeLength: 'Code must be exactly 6 digits',
      codeInvalid: 'Invalid or expired code',
      recoveryRequired: 'Enter a recovery code',
      recoveryInvalid: 'Invalid or already-used recovery code',
      attemptsRemainingOne: '1 attempt remaining.',
      attemptsRemainingMany: '{count} attempts remaining.',
      lockedNow: 'Too many incorrect codes. This sign-in attempt is locked for 30 seconds.',
      lockedRetry: 'Too many incorrect codes. Try again in {seconds}s.',
    },

    // ── Errors raised by mock-api's mockAuth ─────────
    error: {
      invalidCredentials: 'Email or password is incorrect.',
      accountDisabled: 'This admin account is disabled.',
      invalidCode: 'Invalid or expired code.',
    },

    // ── Toasts ───────────────────────────────────────
    toast: {
      recoveryUsed: 'Recovery code accepted and consumed.',
      setupKeyCopied: 'Setup key copied.',
      copyUnavailable: 'Copying is unavailable here — select the key manually.',
      codeResent: 'A new code has been sent to your admin email address.',
    },
  },
};

export const ar = {
  auth: {
    // ── Document titles ──────────────────────────────
    docTitle: {
      signIn: 'إدارة شي درايف — تسجيل الدخول',
      twoFactor: 'إدارة شي درايف — المصادقة الثنائية',
      enrol: 'إدارة شي درايف — إعداد المصادقة الثنائية',
      recovery: 'إدارة شي درايف — رمز الاسترداد',
      forgot: 'إدارة شي درايف — إعادة تعيين كلمة المرور',
      change: 'إدارة شي درايف — إنشاء كلمة مرور جديدة',
      otp: 'إدارة شي درايف — رمز التحقق عبر البريد الإلكتروني',
    },

    // ── Step 1 — credentials (#1656) ─────────────────
    signIn: 'تسجيل الدخول',
    signInIntro: 'مخصص لموظفي العمليات فقط. يلزم التحقق بخطوتين للمتابعة.',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور',
    showHidePassword: 'إظهار أو إخفاء كلمة المرور',
    showHideNewPassword: 'إظهار أو إخفاء كلمة المرور الجديدة',
    showHideConfirmPassword: 'إظهار أو إخفاء تأكيد كلمة المرور',
    continue: 'متابعة',
    checking: 'جارٍ التحقق…',
    forgotPassword: 'نسيت كلمة المرور؟',

    // ── Step 2 — second factor (#1806) ───────────────
    tfaTitle: 'المصادقة الثنائية',
    tfaHint: 'أدخل الرمز المكوّن من 6 أرقام الذي يظهر في تطبيق المصادقة.',
    tfaHintEnrolled: 'تم حفظ التسجيل. أدخل رمزًا من تطبيق المصادقة لإكمال تسجيل الدخول.',
    verify: 'تأكيد وإرسال',
    verifying: 'جارٍ التحقق…',
    codeDigit: 'خانة رمز المصادقة {n}',
    verifyDigit: 'خانة رمز التحقق {n}',
    mockTotp: 'رمز العرض التجريبي: 123456',
    mockRecovery: 'رمز العرض التجريبي: SD-RECOVERY-01',
    recoveryLabel: 'رمز الاسترداد',
    recoveryPlaceholder: 'مثال: SD-RECOVERY-01',
    useRecovery: 'فقدت جهازك؟ استخدم رمز الاسترداد.',
    useAuthenticator: 'استخدم تطبيق المصادقة بدلاً من ذلك.',
    backToSignIn: 'العودة لتسجيل الدخول',

    // ── First-time enrolment (#1806 Scenario 1) ──────
    enrolTitle: 'إعداد المصادقة الثنائية',
    enrolStep1: 'مسح رمز الإستجابة',
    enrolStep1Body:
      'يرجى مسح رمز الاستجابة السريعة بتطبيق المصادقة، أو نسخ مفتاح الإعداد أدناه وإدخاله يدويًا إذا تعذر عليك مسح الرمز.',
    qrAlt: 'رمز استجابة سريعة لإعداد تطبيق المصادقة — عنصر عرض تجريبي',
    copySetupKey: 'نسخ مفتاح الإعداد',
    qrStub: 'عنصر عرض تجريبي — رمز الاستجابة السريعة للتوضيح فقط وغير قابل للمسح.',
    recoveryCodesLabel: 'رموز الاسترداد — تُعرض مرة واحدة فقط',
    enrolStep2: 'تأكيد رمز التحقق',
    enrolStep2Body:
      'أدخل رمز التحقق المكوّن من 6 أرقام الظاهر في تطبيق المصادقة لإكمال التسجيل.',
    enrolContinue: 'لقد حفظت رموز الاسترداد',

    // ── Forced first-login password change (#1822) ───
    changeTitle: 'إنشاء كلمة مرور جديدة',
    changeIntro: 'هذا هو أول تسجيل دخول لك، لذا يجب إنشاء كلمة مرور خاصة بك قبل المتابعة.',
    newPasswordLabel: 'كلمة المرور الجديدة',
    newPasswordPlaceholder: 'إكتب كلمة المرور الجديدة',
    confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'أعد كتابة كلمة المرور الجديدة',
    requirementLength: 'يجب أن تحتوي على 8 أحرف على الأقل.',
    requirementMatch: 'يجب أن يتطابق الحقلان.',
    setPassword: 'حفظ كلمة المرور والمتابعة',

    // ── Password reset request (#1822) ───────────────
    forgotTitle: 'إعادة تعيين كلمة المرور',
    forgotIntro:
      'أدخل عنوان بريدك الإلكتروني المسجل. سنرسل رابط إعادة التعيين إلى بريد الإدارة الخاص بك في شي درايف.',
    forgotSuccess: 'إذا كان هذا البريد الإلكتروني يخص حساب إدارة، فسيصلك رابط إعادة التعيين قريبًا.',
    forgotEmailPlaceholder: 'أدخل البريد الإلكتروني المسجل',
    sendResetLink: 'إرسال رابط إعادة التعيين',

    // ── Email one-time code screen (otp.html) ────────
    otpTitle: 'رمز التحقق عبر البريد الإلكتروني',
    otpIntro:
      'يرجى تأكيد حسابك عن طريق إدخال رمز التحقق المُرسل إلى بريد الإدارة الخاص بك.',
    otpSubmit: 'تأكيد وإرسال الرمز',
    resendCode: 'إعادة إرسال الرمز',
    seconds: 'ثانية',
    otpFooter:
      'شاشة عرض تجريبي — رمز البريد الإلكتروني لمرة واحدة غير مرتبط ببريد حقيقي، ويُرفض أي رمز غير رمز العرض التجريبي.',

    // ── Mockup footer ────────────────────────────────
    footerCredentials:
      'بيانات دخول تجريبية — أي بريد إلكتروني لمديرة في بيانات العرض مع كلمة المرور',
    footerTry: 'جرّب',
    screenIndex: 'دليل الشاشات',

    // ── Standalone kit pages that hand over to index.html ──
    redirect: {
      continue: 'المتابعة إلى شاشة تسجيل الدخول',
      twoFactor:
        'جارٍ فتح خطوة المصادقة الثنائية في شاشة تسجيل الدخول — الرمز المكوّن من 6 أرقام من تطبيق المصادقة (#1806).',
      enrol:
        'جارٍ فتح خطوة التسجيل لأول مرة في شاشة تسجيل الدخول — رمز الاستجابة السريعة ومفتاح الإعداد ورموز الاسترداد (#1806 السيناريو 1).',
      recovery:
        'جارٍ فتح خطوة المصادقة الثنائية في شاشة تسجيل الدخول مع إظهار حقل رمز الاسترداد (#1806).',
      forgot: 'جارٍ فتح خطوة طلب إعادة تعيين كلمة المرور في شاشة تسجيل الدخول (#1822).',
      change:
        'جارٍ فتح خطوة تغيير كلمة المرور الإلزامي عند أول تسجيل دخول في شاشة تسجيل الدخول (#1822).',
    },

    // ── Validation (#1656 / #1806 / #1822 tables) ────
    validation: {
      emailRequired: 'أدخل عنوان بريدك الإلكتروني',
      emailTooLong: 'يجب ألا يتجاوز البريد الإلكتروني 254 حرفًا',
      emailInvalid: 'عنوان بريد إلكتروني غير صالح',
      passwordRequired: 'أدخل كلمة المرور',
      passwordTooShort: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل',
      newPasswordRequired: 'أدخل كلمة مرور جديدة',
      passwordsMismatch: 'كلمتا المرور غير متطابقتين',
      codeRequired: 'أدخل رمز المصادقة',
      codeLength: 'يجب أن يتكون الرمز من 6 أرقام بالضبط',
      codeInvalid: 'رمز غير صالح أو منتهي الصلاحية',
      recoveryRequired: 'أدخل رمز الاسترداد',
      recoveryInvalid: 'رمز استرداد غير صالح أو مستخدم من قبل',
      attemptsRemainingOne: 'تبقّت محاولة واحدة.',
      attemptsRemainingMany: 'تبقّت {count} محاولات.',
      lockedNow: 'عدد كبير من الرموز الخاطئة. تم قفل محاولة تسجيل الدخول لمدة 30 ثانية.',
      lockedRetry: 'عدد كبير من الرموز الخاطئة. أعد المحاولة خلال {seconds} ثانية.',
    },

    // ── Errors raised by mock-api's mockAuth ─────────
    error: {
      invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      accountDisabled: 'حساب الإدارة هذا معطّل.',
      invalidCode: 'رمز غير صالح أو منتهي الصلاحية.',
    },

    // ── Toasts ───────────────────────────────────────
    toast: {
      recoveryUsed: 'تم قبول رمز الاسترداد واستهلاكه.',
      setupKeyCopied: 'تم نسخ مفتاح الإعداد.',
      copyUnavailable: 'النسخ غير متاح هنا — يرجى تحديد المفتاح يدويًا.',
      codeResent: 'تم إرسال رمز جديد إلى بريد الإدارة الخاص بك.',
    },
  },
};
