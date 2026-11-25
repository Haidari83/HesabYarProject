import { useEffect, useState, useRef } from 'react';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

import './account-security-modal.css';


// مقادیر اولیه فرم‌ها
const INITIAL_FORM = {
  currentPassword: '',
  newDisplayName: '',
  newUsername: '',
  newPassword: '',
  confirmPassword: '',
  pin: '',
  confirmPin: '',
};


// عنوان هر عملیات
const ACTION_TITLES = {
  displayName: 'تغییر نام',
  username: 'تغییر نام کاربری',
  password: 'تغییر گذرواژه اصلی',
  pin: 'تنظیم یا تغییر PIN',
  removePin: 'حذف PIN',
};


// =============================================
// فیلد مشترک فرم‌های امنیتی
// برچسب، شناسه و ویژگی‌های دسترس‌پذیری را FormField مدیریت می‌کند.
// =============================================

function SecurityField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  dir = 'rtl',
  maxLength,
  inputMode,
}) {

  return (

    <FormField
      id={id}
      label={label}
      required
      className="ui-field"
    >

      <input
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        dir={dir}
        maxLength={maxLength}
        inputMode={inputMode}
      />

    </FormField>

  );

}


// پنجره مدیریت حساب و امنیت
function AccountSecurityModal({
  currentUser,
  onClose,
  onUserUpdated,
}) {

  // عملیات انتخاب‌شده
  const [activeAction, setActiveAction] = useState(null);

  // اطلاعات فرم
  const [formData, setFormData] = useState(INITIAL_FORM);

  // وضعیت ارسال فرم
  const [isSubmitting, setIsSubmitting] = useState(false);

  // پیام نتیجه عملیات
  const [feedback, setFeedback] = useState(null);

  // مرجع ورودی انتخاب تصویر
  const profileImageInputRef = useRef(null);

  // پیش‌نمایش تصویر پروفایل
  const [profileImagePreview, setProfileImagePreview] = useState(
    currentUser?.profileImage || ''
  );

  // بررسی اینکه تصویر جدیدی برای ذخیره انتخاب شده است
  const hasPendingProfileImage =
    Boolean(profileImagePreview) &&
    profileImagePreview !== (currentUser?.profileImage || '');

  // وضعیت تنظیم بودن PIN
  const hasPin = Boolean(currentUser?.hasPin);


  // نام و نقش کاربر
  const userName = currentUser?.displayName || 'کاربر';

  const userRole = currentUser?.role === 'admin'
    ? 'مدیر سیستم'
    : 'کاربر عادی';


  // پاک‌سازی فرم و ورود به عملیات انتخاب‌شده
  function openAction(action) {

    setActiveAction(action);

    setFormData({ ...INITIAL_FORM });

    setFeedback(null);

  }


  // تغییر مقدار ورودی‌ها
  function handleFieldChange(field, value) {

    // تبدیل ارقام فارسی و عربی به انگلیسی و محدود کردن PIN به هشت رقم
    if (field === 'pin' || field === 'confirmPin') {

      const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
      const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

      value = value
        .replace(/[۰-۹]/g, digit =>
          String(persianDigits.indexOf(digit))
        )
        .replace(/[٠-٩]/g, digit =>
          String(arabicDigits.indexOf(digit))
        )
        .replace(/[^0-9]/g, '')
        .slice(0, 8);
    }

    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

  }

  // انتخاب و پیش‌نمایش تصویر پروفایل
  function handleProfileImageSelection(event) {

    const file = event.target.files?.[0];

    // امکان انتخاب دوباره همان فایل
    event.target.value = '';

    if (!file) {
      return;
    }

    // فرمت‌های مجاز تصویر
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {

      setFeedback({
        type: 'error',
        message: 'فرمت عکس باید PNG، JPG یا WEBP باشد.',
      });

      return;

    }

    // محدودیت حجم تصویر به 4 مگابایت
    const maxSize = 4 * 1024 * 1024;

    if (file.size === 0 || file.size > maxSize) {

      setFeedback({
        type: 'error',
        message: 'حجم عکس باید حداکثر ۲ مگابایت باشد.',
      });

      return;

    }

    const reader = new FileReader();

    reader.onload = () => {

      if (typeof reader.result !== 'string') {

        setFeedback({
          type: 'error',
          message: 'خواندن تصویر با خطا مواجه شد.',
        });

        return;

      }

      // نمایش تصویر انتخاب‌شده پیش از ذخیره
      setProfileImagePreview(reader.result);

      setFeedback(null);

    };

    reader.onerror = () => {

      setFeedback({
        type: 'error',
        message: 'خواندن فایل تصویر ناموفق بود.',
      });

    };

    reader.readAsDataURL(file);

  }

  // ذخیره تصویر پروفایل در پایگاه داده
  async function handleSaveProfileImage() {

    if (
      !hasPendingProfileImage ||
      isSubmitting
    ) {
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {

      const auth = window.hesabyar?.auth;

      if (typeof auth?.setProfileImage !== 'function') {

        throw new Error(
          'سرویس ذخیره تصویر پروفایل در دسترس نیست.'
        );

      }

      // ارسال تصویر به Electron
      const result = await auth.setProfileImage({
        imageDataUrl: profileImagePreview,
      });

      if (!result?.success) {

        throw new Error(
          result?.message || 'ذخیره تصویر انجام نشد.'
        );

      }

      // دریافت دوباره اطلاعات کاربر همراه تصویر ذخیره‌شده
      let updatedUser = null;

      try {

        updatedUser = await auth.getCurrentSession();

      } catch {
        // در صورت شکست دریافت نشست، از نتیجه فعلی استفاده می‌کنیم
      }

      // آماده‌سازی اطلاعات جدید کاربر
      const nextUser = updatedUser || {
        ...currentUser,
        profileImage: profileImagePreview,
      };

      // انتقال تصویر جدید به App و نوار بالایی
      if (typeof onUserUpdated === 'function') {
        onUserUpdated(nextUser);
      }

      // تثبیت تصویر ذخیره‌شده در پیش‌نمایش
      setProfileImagePreview(
        nextUser.profileImage || profileImagePreview
      );

      setFeedback({
        type: 'success',
        message: 'تصویر پروفایل با موفقیت ذخیره شد.',
      });

    } catch (error) {

      setFeedback({
        type: 'error',
        message: error.message ||
          'ذخیره تصویر پروفایل با خطا مواجه شد.',
      });

    } finally {

      setIsSubmitting(false);

    }

  }

  // بستن پنجره با Escape
  useEffect(() => {

    function handleEscape(event) {

      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }

    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };

  }, [isSubmitting, onClose]);


  // دریافت اطلاعات به‌روز کاربر پس از تغییر مشخصات
  async function refreshUserData(action, result) {

    let updatedUser = null;

    try {

      updatedUser = await window.hesabyar.auth.getCurrentSession();

    } catch {
      // در صورت شکست بازیابی، از اطلاعات فعلی و نتیجه عملیات استفاده می‌کنیم
    }


    // اطلاعات جدید در صورت در دسترس نبودن بازیابی نشست
    const fallbackUser = {
      ...currentUser,

      ...(action === 'displayName' && {
        displayName: result.displayName || formData.newDisplayName,
      }),
      ...(action === 'username' && {
        username: result.username || formData.newUsername,
      }),

      ...(action === 'pin' && {
        hasPin: true,
      }),

      ...(action === 'removePin' && {
        hasPin: false,
      }),
    };


    if (typeof onUserUpdated === 'function') {
      onUserUpdated(updatedUser || fallbackUser);
    }

  }


  // ارسال عملیات به سرویس امنیتی Electron
  async function handleSubmit(event) {

    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFeedback(null);

    setIsSubmitting(true);

    try {

      const auth = window.hesabyar?.auth;

      if (!auth) {
        throw new Error(
          'ارتباط با سرویس امنیتی برقرار نیست.'
        );
      }


      let result;


      // انتخاب عملیات بر اساس فرم فعال
      switch (activeAction) {
        case 'displayName':

          result = await auth.changeDisplayName({
            currentPassword: formData.currentPassword,
            newDisplayName: formData.newDisplayName,
          });

          break;

        case 'username':

          result = await auth.changeUsername({
            currentPassword: formData.currentPassword,
            newUsername: formData.newUsername,
          });

          break;


        case 'password':

          result = await auth.changePassword({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
            confirmPassword: formData.confirmPassword,
          });

          break;


        case 'pin':

          result = await auth.setPin({
            currentPassword: formData.currentPassword,
            pin: formData.pin,
            confirmPin: formData.confirmPin,
          });

          break;


        case 'removePin':

          result = await auth.removePin({
            currentPassword: formData.currentPassword,
          });

          break;


        default:

          throw new Error(
            'عملیات انتخاب‌شده معتبر نیست.'
          );

      }


      if (!result?.success) {
        throw new Error(
          result?.message || 'عملیات انجام نشد.'
        );
      }


      // به‌روزرسانی نشست برای عملیات مؤثر بر اطلاعات نمایشی
      if (
        activeAction === 'displayName' ||
        activeAction === 'username' ||
        activeAction === 'pin' ||
        activeAction === 'removePin'
      ) {

        await refreshUserData(
          activeAction,
          result
        );

      }


      // پیام موفقیت
      const successMessages = {
        displayName: 'نام با موفقیت تغییر کرد.',
        username: 'نام کاربری با موفقیت تغییر کرد.',
        password: 'گذرواژه اصلی با موفقیت تغییر کرد.',
        pin: 'PIN با موفقیت ذخیره شد.',
        removePin: 'PIN با موفقیت حذف شد.',
      };


      setFeedback({
        type: 'success',
        message: successMessages[activeAction],
      });


      // بازگشت به نمای اصلی پنجره
      setActiveAction(null);

      setFormData({ ...INITIAL_FORM });


    } catch (error) {

      setFeedback({
        type: 'error',
        message: error.message ||
          'عملیات با خطا مواجه شد.',
      });

    } finally {

      setIsSubmitting(false);

    }

  }


  // بازگشت به نمای اصلی مدیریت امنیت
  function handleBack() {

    if (isSubmitting) {
      return;
    }

    setActiveAction(null);

    setFormData({ ...INITIAL_FORM });

    setFeedback(null);

  }


  // بستن پنجره با کلیک روی پس‌زمینه
  function handleBackdropClick(event) {

    if (
      event.target === event.currentTarget &&
      !isSubmitting
    ) {
      onClose();
    }

  }


  // نمایش گذرواژه فعلی در فرم‌ها
  function renderCurrentPasswordField() {

    return (
      <SecurityField
        id="currentPassword"
        label="گذرواژه اصلی فعلی"
        type="password"
        value={formData.currentPassword}
        onChange={(event) =>
          handleFieldChange(
            'currentPassword',
            event.target.value
          )
        }
        placeholder="گذرواژه فعلی را وارد کنید"
        autoComplete="current-password"
        dir="ltr"
      />
    );

  }


  return (

    <div
      className="account-security-overlay"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >

      <section
        className="account-security-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-security-title"
        dir="rtl"
      >

        {/* سربرگ پنجره */}
        <header className="account-security-header">

          <div>

            <span className="account-security-eyebrow">
              حساب کاربری
            </span>

            <h2 id="account-security-title">
              مدیریت حساب و امنیت
            </h2>

            <p>
              اطلاعات ورود و امنیت حساب خود را مدیریت کنید.
            </p>

          </div>

          <Button
            type="button"
            variant="ghost"
            iconOnly
            className="account-security-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="بستن پنجره"
          >
            ×
          </Button>

        </header>


        <div className="account-security-body">

          {feedback && !activeAction && (
            <Alert
              variant={feedback.type === 'error' ? 'danger' : 'success'}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.message}
            </Alert>
          )}


          {/* نمای اصلی مدیریت حساب */}
          {!activeAction ? (

            <>

              {/* مشخصات و تصویر پروفایل کاربر */}
              <section className="account-security-user">

                {/* ورودی مخفی انتخاب تصویر */}
                <input
                  ref={profileImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleProfileImageSelection}
                  hidden
                />

                {/* تصویر یا حرف اول نام کاربر */}
                <div className="account-security-avatar">

                  {profileImagePreview ? (

                    <img
                      src={profileImagePreview}
                      alt={`تصویر پروفایل ${userName}`}
                    />

                  ) : (

                    userName.trim().charAt(0) || 'ک'

                  )}

                </div>

                <div className="account-security-user-info">

                  <div className='account-user-info'>

                    <strong>{userName}</strong>

                    <span>{userRole}</span>
                  </div>


                  {/* <small dir="ltr">
                    {currentUser?.username}
                  </small> */}

                  {/* دکمه‌های مدیریت تصویر */}
                  <div className="account-security-image-actions">

                    <div
                      className='account-image-wrapper'>

                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() => profileImageInputRef.current?.click()}
                        disabled={isSubmitting}
                      >
                        {profileImagePreview
                          ? 'تغییر تصویر'
                          : 'انتخاب تصویر'}
                      </Button>

                      {hasPendingProfileImage && (

                        <Button
                          type="button"
                          variant="primary"
                          size="small"
                          loading={isSubmitting}
                          onClick={handleSaveProfileImage}
                        >
                          {isSubmitting
                            ? 'در حال ذخیره...'
                            : 'ذخیره تصویر'}
                        </Button>

                      )}

                      <small className="account-security-image-help">
                        PNG، JPG یا WEBP؛ حداکثر ۲ مگابایت
                      </small>
                    </div>

                  </div>


                </div>

              </section>


              {/* عملیات امنیتی */}
              <div className="account-security-options">
                <button
                  type="button"
                  className="account-security-option"
                  onClick={() => openAction('displayName')}
                >

                  <span className="account-security-option-icon">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {/* سر شخص */}
                      <circle cx="9.5" cy="8" r="3.5" />

                      {/* شانه‌ها و بدن شخص */}
                      <path d="M3.5 20c.4-3.7 2.7-6 6-6 1.5 0 2.8.5 3.8 1.4" />

                      {/* مداد ویرایش */}
                      <path d="m14 17.5 5.2-5.2a1.4 1.4 0 0 1 2 2L16 19.5l-3.5 1z" />

                      {/* نوک مداد */}
                      <path d="m17.8 13.7 2 2" />
                    </svg>
                  </span>

                  <span className="account-security-option-content">

                    <strong>نام</strong>

                    <small>
                      {'تغییر نام کاربر'}
                    </small>

                  </span>

                  <span className="account-security-option-arrow">
                    ←
                  </span>

                </button>

                <button
                  type="button"
                  className="account-security-option"
                  onClick={() => openAction('username')}
                >

                  <span className="account-security-option-icon">
                    Aa
                  </span>

                  <span className="account-security-option-content">

                    <strong>نام کاربری</strong>

                    <small>
                      تغییر شناسه ورود به حساب
                    </small>

                  </span>

                  <span className="account-security-option-arrow">
                    ←
                  </span>

                </button>


                <button
                  type="button"
                  className="account-security-option"
                  onClick={() => openAction('password')}
                >

                  <span className="account-security-option-icon">
                    ●●
                  </span>

                  <span className="account-security-option-content">

                    <strong>گذرواژه اصلی</strong>

                    <small>
                      تغییر گذرواژه ورود به حساب
                    </small>

                  </span>

                  <span className="account-security-option-arrow">
                    ←
                  </span>

                </button>


                <button
                  type="button"
                  className="account-security-option"
                  onClick={() => openAction('pin')}
                >

                  <span className="account-security-option-icon">
                    PIN
                  </span>

                  <span className="account-security-option-content">

                    <strong>
                      {hasPin ? 'تغییر PIN' : 'تنظیم PIN'}
                    </strong>

                    <small>
                      {hasPin
                        ? 'PIN حساب فعال است.'
                        : 'برای ورود سریع، PIN تنظیم کنید.'}
                    </small>

                  </span>

                  <span className="account-security-status">
                    {hasPin ? 'فعال' : 'تنظیم نشده'}
                  </span>

                </button>


                {hasPin && (

                  <button
                    type="button"
                    className="account-security-option danger"
                    onClick={() => openAction('removePin')}
                  >

                    <span className="account-security-option-icon">
                      ×
                    </span>

                    <span className="account-security-option-content">

                      <strong>حذف PIN</strong>

                      <small>
                        غیرفعال کردن ورود با PIN
                      </small>

                    </span>

                    <span className="account-security-option-arrow">
                      ←
                    </span>

                  </button>

                )}

              </div>


              {/* توضیح امنیتی */}
              <div className="account-security-note">

                برای تغییر اطلاعات امنیتی، گذرواژه اصلی فعلی
                حساب باید تأیید شود.

              </div>

            </>


          ) : (

            /* فرم عملیات انتخاب‌شده */
            <form
              className="account-security-form"
              onSubmit={handleSubmit}
              noValidate
            >

              <button
                type="button"
                className="account-security-back"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                ← بازگشت به مدیریت امنیت
              </button>


              <h3>
                {ACTION_TITLES[activeAction]}
              </h3>
              {activeAction === 'displayName' && (

                <>

                  {renderCurrentPasswordField()}

                  <SecurityField
                    id="newDisplayName"
                    label="نام جدید"
                    value={formData.newDisplayName}
                    onChange={(event) =>
                      handleFieldChange(
                        'newDisplayName',
                        event.target.value
                      )
                    }
                    placeholder="نام جدید را وارد کنید"
                    autoComplete="name"
                    maxLength={80}
                  />

                  <small className="account-security-help">
                    نام نمایشی باید بین ۲ تا ۸۰ نویسه باشد.
                  </small>

                </>

              )}

              {activeAction === 'username' && (

                <>

                  {renderCurrentPasswordField()}

                  <SecurityField
                    id="newUsername"
                    label="نام کاربری جدید"
                    value={formData.newUsername}
                    onChange={(event) =>
                      handleFieldChange(
                        'newUsername',
                        event.target.value
                      )
                    }
                    placeholder="نام کاربری جدید را وارد کنید"
                    autoComplete="username"
                    dir="ltr"
                    maxLength={32}
                  />

                  <small className="account-security-help">
                    نام کاربری باید بین ۲ تا ۳۲ نویسه و شامل
                    حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.
                  </small>

                </>

              )}


              {activeAction === 'password' && (

                <>

                  {renderCurrentPasswordField()}

                  <SecurityField
                    id="newPassword"
                    label="گذرواژه جدید"
                    type="password"
                    value={formData.newPassword}
                    onChange={(event) =>
                      handleFieldChange(
                        'newPassword',
                        event.target.value
                      )
                    }
                    placeholder="گذرواژه جدید را وارد کنید"
                    autoComplete="new-password"
                    dir="ltr"
                    maxLength={128}
                  />

                  <SecurityField
                    id="confirmPassword"
                    label="تکرار گذرواژه جدید"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) =>
                      handleFieldChange(
                        'confirmPassword',
                        event.target.value
                      )
                    }
                    placeholder="گذرواژه جدید را دوباره وارد کنید"
                    autoComplete="new-password"
                    dir="ltr"
                    maxLength={128}
                  />

                  <small className="account-security-help">
                    گذرواژه جدید باید حداقل ۸ و حداکثر ۱۲۸ نویسه داشته باشد.
                  </small>

                </>

              )}


              {activeAction === 'pin' && (

                <>

                  {renderCurrentPasswordField()}

                  <SecurityField
                    id="pin"
                    label="PIN جدید (۴ تا ۸ رقم)"
                    type="password"
                    value={formData.pin}
                    onChange={(event) =>
                      handleFieldChange(
                        'pin',
                        event.target.value
                      )
                    }
                    placeholder="PIN جدید"
                    autoComplete="new-password"
                    dir="ltr"
                    maxLength={8}
                    inputMode="numeric"
                  />

                  <SecurityField
                    id="confirmPin"
                    label="تکرار PIN"
                    type="password"
                    value={formData.confirmPin}
                    onChange={(event) =>
                      handleFieldChange(
                        'confirmPin',
                        event.target.value
                      )
                    }
                    placeholder="PIN را دوباره وارد کنید"
                    autoComplete="new-password"
                    dir="ltr"
                    maxLength={8}
                    inputMode="numeric"
                  />

                </>

              )}


              {activeAction === 'removePin' && (

                <>

                  <div className="account-security-warning">

                    با حذف PIN، امکان ورود سریع با PIN غیرفعال می‌شود.
                    برای ورود همچنان می‌توانی از گذرواژه اصلی استفاده کنی.

                  </div>

                  {renderCurrentPasswordField()}

                </>

              )}


              {/* پیام خطا */}
              {feedback?.type === 'error' && (
                <Alert variant="danger" role="alert">
                  {feedback.message}
                </Alert>
              )}

              {/* دکمه‌های فرم */}
              <div className="account-security-form-actions">

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  انصراف
                </Button>

                <Button
                  type="submit"
                  // حذف PIN عملیات خطرناک است؛ سایر عملیات با رنگ اصلی نمایش داده می‌شوند.
                  variant={
                    activeAction === 'removePin'
                      ? 'danger'
                      : 'primary'
                  }
                  // هنگام ارسال اطلاعات، دکمه غیرفعال و نشانگر بارگذاری نمایش داده می‌شود.
                  loading={isSubmitting}
                >
                  {isSubmitting
                    ? 'در حال ثبت...'
                    : activeAction === 'removePin'
                      ? 'حذف PIN'
                      : 'ثبت تغییرات'}
                </Button>

              </div>

            </form>

          )}

        </div>


        {/* پایین پنجره */}
        <footer className="account-security-footer">

          حساب‌یار؛ مدیریت امن اطلاعات حساب

        </footer>

      </section>

    </div>

  );

}

export default AccountSecurityModal;
