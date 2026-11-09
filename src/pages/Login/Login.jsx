
import { useState } from 'react';
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

function Login() {

  // اطلاعات ورودی کاربر
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // وضعیت نمایش یا مخفی بودن رمز
  const [showPassword, setShowPassword] = useState(false);

  // پیام‌های فرم
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');


  // مدیریت ارسال فرم
  function handleSubmit(e) {

    // جلوگیری از بارگذاری مجدد صفحه
    e.preventDefault();

    // بررسی نام کاربری
    if (!username.trim()) {
      setFeedbackType('error');
      setFeedback('لطفاً نام کاربری را وارد کنید.');
      return;
    }

    // بررسی رمز عبور
    if (!password) {
      setFeedbackType('error');
      setFeedback('لطفاً رمز عبور را وارد کنید.');
      return;
    }

    // احراز هویت هنوز به برنامه متصل نشده است
    setFeedbackType('info');
    setFeedback('صفحه ورود آماده است؛ اتصال احراز هویت در مرحله بعد انجام می‌شود.');
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
                  />

                </div>

              </div>


              {/* رمز عبور */}
              <div className="login-field">

                <label htmlFor="password">
                  رمز عبور
                </label>

                <div className="login-input-wrapper">

                  <span className="login-input-icon">
                    <LockIcon />
                  </span>

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="رمز عبور خود را وارد کنید"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFeedback('');
                    }}
                    autoComplete="current-password"
                  />

                  {/* نمایش یا مخفی کردن رمز */}

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(prev => !prev)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>

                </div>

              </div>


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
              >
                ورود به حساب‌یار
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
