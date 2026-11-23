import { useState } from 'react';
import { toEnglishDigits } from '../../utils/persianText';

import './login.css';

/* ************************
   آیکون‌های صفحه
************************ */

// آیکون اصلی حساب‌یار
function BrandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h3" />
    </svg>
  );
}

// آیکون نام کاربری
function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  );
}

// آیکون قفل
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

// آیکون نمایش رمز
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// آیکون مخفی کردن رمز
function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a14 14 0 0 1-3 3.8" />
      <path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10.5 10.5 0 0 0 4.1-.8" />
    </svg>
  );
}


/* ************************
   صفحه ورود
************************= */

function Login({ onLogin }) {

  // اطلاعات ورودی کاربر
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // روش انتخاب‌شده برای ورود
  const [loginMethod, setLoginMethod] = useState('password');

  // وضعیت نمایش یا مخفی بودن رمز
  const [showPassword, setShowPassword] = useState(false);

  // وضعیت ارسال درخواست ورود
  const [isSubmitting, setIsSubmitting] = useState(false);

  // پیام‌های فرم
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');

  // تغییر روش ورود و پاک‌سازی اطلاعات قبلی
  function handleMethodChange(method) {

    setLoginMethod(method);

    setPassword('');
    setPin('');

    setFeedback('');
    setShowPassword(false);

  }

  // ارسال اطلاعات برای احراز هویت
  async function handleSubmit(event) {

    event.preventDefault();

    setFeedback('');


    // بررسی نام کاربری
    if (!username.trim()) {

      setFeedbackType('error');
      setFeedback('لطفاً نام کاربری را وارد کن.');

      return;

    }


    // بررسی گذرواژه یا PIN
    if (
      loginMethod === 'password' &&
      !password
    ) {

      setFeedbackType('error');
      setFeedback('لطفاً گذرواژه را وارد کن.');

      return;

    }


    if (
      loginMethod === 'pin' &&
      !/^[0-9]{4,8}$/.test(pin)
    ) {

      setFeedbackType('error');
      setFeedback('PIN باید بین 4 تا 8 رقم انگلیسی باشد.');

      return;

    }


    setIsSubmitting(true);

    // نگهداری کاربر پس از احراز هویت موفق
    let authenticatedUser = null;


    try {

      // دریافت تابع ورود از Preload
      const login = window.hesabyar?.auth?.login;

      if (typeof login !== 'function') {

        throw new Error(
          'ارتباط با سرویس احراز هویت برقرار نیست.'
        );

      }


      // آماده‌سازی اطلاعات متناسب با روش ورود
      const credentials = {
        username: username.trim(),
        method: loginMethod,

        ...(loginMethod === 'password'
          ? { password }
          : { pin }),
      };


      // ارسال درخواست به Main Process
      const result = await login(credentials);


      // بررسی نتیجه احراز هویت
      if (!result?.success) {

        setFeedbackType('error');

        setFeedback(
          result?.message ||
          'ورود به حساب‌یار انجام نشد.'
        );

        // پاک‌سازی فقط اطلاعات محرمانه روش انتخاب‌شده
        if (loginMethod === 'password') {
          setPassword('');
        } else {
          setPin('');
        }

      } else if (!result.user?.id) {

        throw new Error(
          'اطلاعات کاربر دریافت‌شده معتبر نیست.'
        );

      } else {

        authenticatedUser = result.user;

      }

    } catch (error) {

      setFeedbackType('error');

      setFeedback(
        error.message ||
        'هنگام ورود به حساب‌یار خطایی رخ داد.'
      );

      setPassword('');
      setPin('');

    } finally {

      setIsSubmitting(false);

    }


    // انتقال به محیط برنامه پس از ورود موفق
    if (authenticatedUser) {

      setPassword('');
      setPin('');

      onLogin(authenticatedUser);

    }

  }



  return (
    <main className="login-page">

      <div className="login-shell">

        {/* ************************
            ستون فرم ورود
        ************************** */}

        <section className="login-form-panel">

          <div className="login-form-content">

            {/* عنوان فرم */}
            <div className="login-heading">

              <span className="login-eyebrow">
                حساب کاربری
              </span>

              <h1>
                خوش آمدید
              </h1>

              <p>
                برای ورود به حساب‌یار، اطلاعات خود را وارد کنید.
              </p>

            </div>


            {/* فرم ورود */}
            <form
              className="login-form"
              onSubmit={handleSubmit}
              noValidate
            >

              {/* انتخاب روش ورود */}
              <div
                className="login-method-switch"
                role="group"
                aria-label="روش ورود"
              >

                <button
                  type="button"
                  className={
                    loginMethod === 'password'
                      ? 'login-method-button active'
                      : 'login-method-button'
                  }
                  onClick={() => handleMethodChange('password')}
                  aria-pressed={loginMethod === 'password'}
                  disabled={isSubmitting}
                >
                  ورود با گذرواژه
                </button>


                <button
                  type="button"
                  className={
                    loginMethod === 'pin'
                      ? 'login-method-button active'
                      : 'login-method-button'
                  }
                  onClick={() => handleMethodChange('pin')}
                  aria-pressed={loginMethod === 'pin'}
                  disabled={isSubmitting}
                >
                  ورود با PIN
                </button>

              </div>

              {/* نام کاربری */}
              <div className="login-field">

                <label htmlFor="username">
                  نام کاربری
                </label>

                <div className="login-input-wrapper">

                  <span className="login-input-icon">
                    <UserIcon />
                  </span>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="نام کاربری خود را وارد کنید"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setFeedback('');
                    }}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    dir="auto"
                    disabled={isSubmitting}
                  />

                </div>

              </div>



              {/* نمایش ورودی متناسب با روش ورود */}

              {loginMethod === 'password' ? (

                /* ورود با گذرواژه اصلی */
                <div className="login-field">

                  <label htmlFor="password">
                    گذرواژه اصلی
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <LockIcon />
                    </span>

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="گذرواژه خود را وارد کنید"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFeedback('');
                      }}
                      autoComplete="current-password"
                      dir="ltr"
                      disabled={isSubmitting}
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(prev => !prev)}
                      aria-label={
                        showPassword
                          ? 'مخفی کردن گذرواژه'
                          : 'نمایش گذرواژه'
                      }
                      title={
                        showPassword
                          ? 'مخفی کردن گذرواژه'
                          : 'نمایش گذرواژه'
                      }
                    >
                      {showPassword
                        ? <EyeOffIcon />
                        : <EyeIcon />}
                    </button>

                  </div>

                </div>

              ) : (

                /* ورود با PIN چهار تا هشت‌رقمی */
                <div className="login-field">

                  <label htmlFor="pin">
                    PIN
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <LockIcon />
                    </span>

                    <input
                      id="pin"
                      name="pin"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="PIN را وارد کنید"
                      value={pin}
                      onChange={(e) => {

                        const normalizedPin = toEnglishDigits(e.target.value)
                          .replace(/[^0-9]/g, '')
                          .slice(0, 8);

                        setPin(normalizedPin);

                        setFeedback('');
                      }}
                      autoComplete="off"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      disabled={isSubmitting}
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(prev => !prev)}
                      aria-label={
                        showPassword
                          ? 'مخفی کردن PIN'
                          : 'نمایش PIN'
                      }
                      title={
                        showPassword
                          ? 'مخفی کردن PIN'
                          : 'نمایش PIN'
                      }
                    >
                      {showPassword
                        ? <EyeOffIcon />
                        : <EyeIcon />}
                    </button>

                  </div>

                </div>

              )}


              {/* پیام فرم */}
              {feedback && (
                <div
                  className={`login-feedback ${feedbackType}`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback}
                </div>
              )}


              {/* دکمه ورود */}
              <button
                type="submit"
                className="login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'در حال بررسی اطلاعات...'
                  : 'ورود به حساب‌یار'}
              </button>

            </form>


            {/* توضیح پایین فرم */}
            <div className="login-bottom-text">
              <span>
                لطفاً اطلاعات حساب کاربری خود را محرمانه نگه دارید.
              </span>
            </div>

          </div>

        </section>


        {/* ************************=
            ستون معرفی حساب‌یار
        ************************** */}

        <aside className="login-brand-panel">

          {/* تزئینات پس‌زمینه */}
          <div className="brand-decoration decoration-one" />
          <div className="brand-decoration decoration-two" />
          <div className="brand-decoration decoration-three" />

          <div className="brand-content">

            {/* نشان و نام برنامه */}
            <div className="brand-logo">

              <div className="brand-logo-icon">
                <BrandIcon />
              </div>

              <span>
                حساب‌یار
              </span>

            </div>


            {/* معرفی برنامه */}
            <div className="brand-description">

              <span className="brand-label">
                سیستم حسابداری
              </span>

              <h2>
                مدیریت مالی،
                <br />
                ساده‌تر و دقیق‌تر
              </h2>

              <p>
                فروش، موجودی، حساب مشتریان و گزارش‌های مالی
                را در یک محیط یکپارچه مدیریت کنید.
              </p>

            </div>


            {/* ویژگی‌های برنامه */}
            <div className="brand-features">

              <div>
                <span className="feature-dot" />
                مدیریت فروش و خرید
              </div>

              <div>
                <span className="feature-dot" />
                کنترل موجودی کالا
              </div>

              <div>
                <span className="feature-dot" />
                گزارش‌های مالی
              </div>

            </div>

          </div>


          {/* پایین پنل معرفی */}
          <div className="brand-footer">
            حساب‌یار؛ همراه مدیریت بهتر کسب‌وکار
          </div>

        </aside>

      </div>

    </main>
  );
}

export default Login;
