
import { useState } from 'react';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';

import '../Login/login.css';
import './initial-setup.css';


function InitialSetup({ onComplete }) {

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [setupResult, setSetupResult] = useState(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);


  // ارسال اطلاعات برای ایجاد مدیر اولیه
  async function handleSubmit(event) {

    event.preventDefault();

    setError('');

    if (!displayName.trim()) {
      setError('نام و نام خانوادگی را وارد کن.');
      return;
    }

    if (!username.trim()) {
      setError('نام کاربری را وارد کن.');
      return;
    }

    if (password.length < 8) {
      setError('گذرواژه باید حداقل ۸ نویسه داشته باشد.');
      return;
    }

    if (password !== confirmPassword) {
      setError('گذرواژه و تکرار آن یکسان نیستند.');
      return;
    }

    setIsSubmitting(true);

    try {

      // بررسی وجود API راه‌اندازی در محیط Electron
      if (
        typeof window.hesabyar?.auth?.createInitialAdmin !==
        'function'
      ) {
        throw new Error(
          'ارتباط امن با هسته حساب‌یار برقرار نیست.'
        );
      }

      // درخواست ایجاد مدیر در Main Process
      const result = await window.hesabyar.auth.createInitialAdmin({
        displayName,
        username,
        password,
        confirmPassword,
      });

      if (!result?.success || !result?.recoveryCode) {
        throw new Error('ایجاد مدیر سیستم انجام نشد.');
      }

      // نگهداری موقت نتیجه فقط در حافظه صفحه
      setSetupResult(result);

      // پاک‌کردن گذرواژه از وضعیت فرم
      setPassword('');
      setConfirmPassword('');

    } catch (operationError) {

      setError(
        operationError.message ||
        'در ایجاد مدیر اولیه خطایی رخ داد.'
      );

    } finally {

      setIsSubmitting(false);

    }

  }


  // پس از تأیید یادداشت کد بازیابی
  function finishSetup() {

    if (!recoveryConfirmed) {
      return;
    }

    onComplete();

  }


  return (

    <main className="login-page">

      <div className="login-shell">

        {/* پنل اصلی فرم */}
        <section className="login-form-panel">

          <div className="login-form-content">

            {setupResult ? (

              /* مرحله نمایش کد بازیابی */
              <div className="setup-success-content">

                <span className="login-eyebrow">
                  راه‌اندازی حساب‌یار
                </span>

                <h1>مدیر سیستم ایجاد شد</h1>

                <p className="setup-success-description">
                  حساب مدیریتی با موفقیت ایجاد شد.
                  کد بازیابی زیر را در مکانی امن یادداشت کن.
                </p>

                <div className="setup-recovery-box">

                  <strong>کد بازیابی مدیر</strong>

                  <input
                    type="text"
                    className="setup-recovery-code"
                    value={setupResult.recoveryCode}
                    readOnly
                    onFocus={(event) => event.target.select()}
                    aria-label="کد بازیابی مدیر"
                    dir="ltr"
                  />

                  <p>
                    این کد فقط در همین مرحله نمایش داده می‌شود.
                    آن را در اختیار دیگران قرار نده.
                  </p>

                </div>

                <label className="setup-recovery-confirm">

                  <input
                    type="checkbox"
                    checked={recoveryConfirmed}
                    onChange={(event) =>
                      setRecoveryConfirmed(event.target.checked)
                    }
                  />

                  <span>
                    کد بازیابی را یادداشت کرده‌ام و در جای امن نگهداری می‌کنم.
                  </span>

                </label>

                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  className="login-submit"
                  disabled={!recoveryConfirmed}
                  onClick={finishSetup}
                >
                  پایان راه‌اندازی
                </Button>

                <div className="setup-recovery-warning">
                  در صورت گم‌شدن کد، بازیابی حساب از طریق این کد
                  در مرحله بعدی توسعه فعال خواهد شد.
                </div>

              </div>

            ) : (

              /* فرم ایجاد مدیر اولیه */
              <>

                <div className="login-heading">

                  <span className="login-eyebrow">
                    راه‌اندازی اولیه
                  </span>

                  <h1>ایجاد مدیر سیستم</h1>

                  <p>
                    برای شروع استفاده از حساب‌یار، نخستین حساب
                    مدیریتی را ایجاد کن.
                  </p>

                </div>


                <form
                  className="login-form"
                  onSubmit={handleSubmit}
                  noValidate
                >

                  <FormField
                    id='setup-display-name'
                    className="ui-field"
                    label='نام و نام خانوادگی'
                    required
                  >

                    <div className="login-input-wrapper">

                      <input
                        id="setup-display-name"
                        type="text"
                        value={displayName}
                        onChange={(event) =>
                          setDisplayName(event.target.value)
                        }
                        placeholder="نام کامل مدیر سیستم"
                        autoComplete="name"
                        maxLength={80}
                        required
                        autoFocus
                      />

                    </div>

                  </FormField>


                  <FormField
                    id="setup-username"
                    className="ui-field"
                    label="نام کاربری"
                    required
                    hint="از حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط استفاده کن."
                    hintClassName="setup-field-hint"
                  >

                    <label htmlFor="setup-username">
                      نام کاربری
                    </label>

                    <div className="login-input-wrapper">

                      <input
                        id="setup-username"
                        type="text"
                        value={username}
                        onChange={(event) =>
                          setUsername(event.target.value)
                        }
                        placeholder="نام کاربری انگلیسی"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        minLength={2}
                        maxLength={32}
                        dir="ltr"
                        required
                      />

                    </div>

                  </FormField>


                  <FormField
                    id="setup-password"
                    className="ui-field"
                    label="گذرواژه"
                    required>

                    <div className="login-input-wrapper">

                      <input
                        id="setup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="حداقل ۸ نویسه"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        className="initial-setup-password-toggle"
                        onClick={() => {
                          // تغییر وضعیت نمایش گذرواژه
                          setShowPassword((previous) => !previous);
                        }}
                        aria-label={
                          showPassword
                            ? 'مخفی کردن گذرواژه'
                            : 'نمایش گذرواژه'
                        }
                      >
                        {showPassword ? 'مخفی' : 'نمایش'}
                      </Button>
                    </div>

                  </FormField>


                  <FormField
                    id="setup-confirm-password"
                    className="ui-field"
                    label="تکرار گذرواژه"
                    required
                  >

                    <div className="login-input-wrapper">

                      <input
                        id="setup-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="گذرواژه را دوباره وارد کن"
                        autoComplete="new-password"
                        required
                      />

                    </div>

                  </FormField>


                  {error && (
                    <Alert variant="danger" role="alert">
                      {error}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    fullWidth
                    className="login-submit"
                    loading={isSubmitting}
                  >
                    {isSubmitting
                      ? 'در حال ایجاد حساب...'
                      : 'ایجاد مدیر سیستم'}
                  </Button>

                </form>


                <div className="login-bottom-text">
                  این حساب، نخستین حساب مدیریتی حساب‌یار خواهد بود.
                </div>

              </>

            )}

          </div>

        </section>


        {/* پنل معرفی حساب‌یار */}
        <aside className="login-brand-panel">

          <div className="brand-decoration decoration-one" />
          <div className="brand-decoration decoration-two" />
          <div className="brand-decoration decoration-three" />

          <div className="brand-content">

            <div className="brand-logo">

              <div className="brand-logo-icon">

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

              </div>

              <span>حساب‌یار</span>

            </div>


            <div className="brand-description">

              <span className="brand-label">
                مدیریت امن کاربران
              </span>

              <h2>
                حساب‌یار،
                <br />
                با مدیریت دقیق‌تر
              </h2>

              <p>
                نخستین مدیر سیستم را ایجاد کن تا بتوانی کاربران،
                دسترسی‌ها و عملیات کسب‌وکارت را مدیریت کنی.
              </p>

            </div>


            <div className="brand-features">

              <div>
                <span className="feature-dot" />
                مدیریت کاربران و دسترسی‌ها
              </div>

              <div>
                <span className="feature-dot" />
                ثبت سوابق فعالیت‌ها
              </div>

              <div>
                <span className="feature-dot" />
                نگهداری آفلاین اطلاعات
              </div>

            </div>

          </div>


          <div className="brand-footer">
            حساب‌یار؛ همراه مدیریت بهتر کسب‌وکار
          </div>

        </aside>

      </div>

    </main>

  );

}

export default InitialSetup;
