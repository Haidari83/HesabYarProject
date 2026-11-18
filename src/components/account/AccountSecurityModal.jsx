
import { useEffect, useState } from 'react';

import './account-security-modal.css';


// مقادیر اولیه فرم‌ها
const INITIAL_FORM = {
  currentPassword: '',
  newUsername: '',
  newPassword: '',
  confirmPassword: '',
  pin: '',
  confirmPin: '',
};


// عنوان هر عملیات
const ACTION_TITLES = {
  username: 'تغییر نام کاربری',
  password: 'تغییر گذرواژه اصلی',
  pin: 'تنظیم یا تغییر PIN',
  removePin: 'حذف PIN',
};


// ورودی عمومی فرم‌های امنیتی
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
    <div className="security-field">

      <label htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        dir={dir}
        maxLength={maxLength}
        inputMode={inputMode}
        required
      />

    </div>
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

          <button
            type="button"
            className="account-security-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="بستن پنجره"
          >
            ×
          </button>

        </header>


        <div className="account-security-body">

          {/* پیام موفقیت عملیات */}
          {feedback && !activeAction && (

            <div
              className={`account-security-feedback ${feedback.type}`}
              role="status"
            >
              {feedback.message}
            </div>

          )}


          {/* نمای اصلی مدیریت حساب */}
          {!activeAction ? (

            <>

              {/* مشخصات کاربر */}
              <section className="account-security-user">

                <div className="account-security-avatar">
                  {userName.trim().charAt(0) || 'ک'}
                </div>

                <div className="account-security-user-info">

                  <strong>{userName}</strong>

                  <span>{userRole}</span>

                  <small dir="ltr">
                    {currentUser?.username}
                  </small>

                </div>

              </section>


              {/* عملیات امنیتی */}
              <div className="account-security-options">

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
                    نام کاربری باید بین ۳ تا ۳۲ نویسه و شامل
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

                <div
                  className="account-security-feedback error"
                  role="alert"
                >
                  {feedback.message}
                </div>

              )}


              {/* دکمه‌های فرم */}
              <div className="account-security-form-actions">

                <button
                  type="button"
                  className="account-security-secondary-button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className={`account-security-submit-button ${activeAction === 'removePin' ? 'danger' : ''
                    }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'در حال ثبت...'
                    : activeAction === 'removePin'
                      ? 'حذف PIN'
                      : 'ثبت تغییرات'}
                </button>

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
