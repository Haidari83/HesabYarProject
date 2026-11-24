
import { useEffect, useRef, useState } from 'react';
import {
  formatDateInTimeZone,
  getTodayGregorianDate,
} from '../../utils/dateUtils';

import Alert from '../ui/Alert';
import Button from '../ui/Button';

import AccountSecurityModal from '../account/AccountSecurityModal';

import './topbar.css';

/* =========================
   آیکون‌های نوار بالایی
========================= */

// آیکون منوی کناری
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// آیکون حساب‌یار
function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h3" />
    </svg>
  );
}

// آیکون تقویم
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

// آیکون اعلان‌ها
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

// آیکون تنظیمات
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" />
    </svg>
  );
}

// آیکون کاربر
function ProfileUserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.5-3.5 3.2-5.8 7.5-5.8s7 2.3 7.5 5.8" />
    </svg>
  );
}

// آیکون فلش پایین
function ChevronDownIcon() {
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
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

// آیکون خروج از حساب کاربری
function LogoutIcon() {
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
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}

/* =========================
   کامپوننت نوار بالایی
========================= */

function TopBar({
  onToggleSidebar,
  sidebarCollapsed = false,
  currentUser = null,
  onLogout,
  onUserUpdated,
}) {

  // اطلاعات نمایشی کاربر واردشده
  const userName = currentUser?.displayName || 'کاربر';

  const username = currentUser?.username || '';

  const userRole = currentUser?.role === 'admin'
    ? 'مدیر سیستم'
    : 'کاربر عادی';

  // مشخص می‌کند کدام پنل باز باشد
  const [activePanel, setActivePanel] = useState(null);
  // وضعیت عملیات خروج
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // پیام خطای خروج
  const [logoutError, setLogoutError] = useState('');

  // برای تشخیص کلیک خارج از پنل‌ها
  const actionsRef = useRef(null);

  // دریافت تاریخ روز
  const now = new Date();


  // نمایش تاریخ افغانستان
  const formattedDate = formatDateInTimeZone(
    now,
    {
      locale: 'fa-AF',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );


  // تاریخ میلادی استاندارد برای تگ time
  const dateTime = getTodayGregorianDate(now);

  // وضعیت باز بودن پنجره مدیریت امنیت
  const [isSecurityModalOpen, setIsSecurityModalOpen] =
    useState(false);

  /* =========================
     مدیریت پنل‌های نوار بالایی
  ========================= */

  // باز و بسته کردن پنل‌های اعلان، تنظیمات و پروفایل
  function togglePanel(panelName) {
    setActivePanel((currentPanel) =>
      currentPanel === panelName ? null : panelName
    );
  }

  // باز کردن پنجره مدیریت حساب و امنیت
  function handleOpenSecurityModal() {

    // بستن منوی پروفایل
    setActivePanel(null);

    // پاک کردن خطای احتمالی خروج
    setLogoutError('');

    // باز کردن پنجره مدیریت امنیت
    setIsSecurityModalOpen(true);

  }

  // مدیریت خروج از حساب کاربری
  async function handleLogout() {

    if (typeof onLogout !== 'function') {
      setLogoutError('عملیات خروج در دسترس نیست.');
      return;
    }

    setLogoutError('');
    setIsLoggingOut(true);

    try {

      await onLogout();

    } catch (error) {

      setLogoutError(
        error.message ||
        'خروج از حساب با خطا مواجه شد.'
      );

      setIsLoggingOut(false);

    }

  }

  // بستن پنل‌ها با کلیک در خارج از آن‌ها یا فشردن Escape
  useEffect(() => {

    function handleOutsideClick(e) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(e.target)
      ) {
        setActivePanel(null);
      }
    }

    function handleEscape(e) {
      if (e.key === 'Escape') {
        setActivePanel(null);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    // حذف رویدادها هنگام خارج شدن کامپوننت از صفحه
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };

  }, []);


  return (
    <header className="topbar">

      {/* بخش راست: کنترل منو و هویت برنامه */}
      <div className="topbar__identity">

        {/* دکمه باز و بسته کردن منوی کناری */}
        <Button
          type="button"
          variant="ghost"
          iconOnly
          className="topbar__icon-button topbar__menu-button"
          onClick={onToggleSidebar}
          aria-label={
            sidebarCollapsed
              ? 'باز کردن منو'
              : 'جمع کردن منو'
          }
          title={
            sidebarCollapsed
              ? 'باز کردن منو'
              : 'جمع کردن منو'
          }
        >
          <MenuIcon />
        </Button>

        {/* نشان و نام برنامه */}
        <div className="topbar__brand">

          <div className="topbar__brand-icon">
            <BrandIcon />
          </div>

          <span className="topbar__brand-name">
            حساب‌یار
          </span>

        </div>

      </div>


      {/* بخش چپ: تاریخ و امکانات کاربر */}
      <div className="topbar__tools">

        {/* تاریخ روز */}
        <div className="topbar__date">

          <span className="topbar__date-icon">
            <CalendarIcon />
          </span>

          <time dateTime={dateTime}>
            {formattedDate}
          </time>

        </div>


        {/* اعلان‌ها، تنظیمات و پروفایل */}
        <div className="topbar__actions" ref={actionsRef}>

          {/* اعلان‌ها */}
          <div className="topbar__action-item">

            <Button
              type="button"
              variant="ghost"
              iconOnly
              className="topbar__icon-button"
              onClick={() => togglePanel('notifications')}
              aria-label="اعلان‌ها"
              aria-expanded={activePanel === 'notifications'}
              aria-controls="notifications-panel"
              title="اعلان‌ها"
            >
              <BellIcon />
            </Button>

            {activePanel === 'notifications' && (
              <div
                className="topbar__popover"
                id="notifications-panel"
                role="dialog"
                aria-label="اعلان‌ها"
              >
                <h3>اعلان‌ها</h3>

                <p>
                  در حال حاضر اعلانی برای نمایش وجود ندارد.
                </p>
              </div>
            )}

          </div>


          {/* تنظیمات */}
          <div className="topbar__action-item">

            <Button
              type="button"
              variant="ghost"
              iconOnly
              className="topbar__icon-button"
              onClick={() => togglePanel('settings')}
              aria-label="تنظیمات"
              aria-expanded={activePanel === 'settings'}
              aria-controls="settings-panel"
              title="تنظیمات"
            >
              <SettingsIcon />
            </Button>

            {activePanel === 'settings' && (
              <div
                className="topbar__popover"
                id="settings-panel"
                role="dialog"
                aria-label="تنظیمات"
              >
                <h3>تنظیمات</h3>

                <p>
                  تنظیمات برنامه در مراحل بعدی پیاده‌سازی می‌شود.
                </p>
              </div>
            )}

          </div>


          {/* اطلاعات کاربر */}
          <div className="topbar__action-item">

            <button
              type="button"
              className="topbar__profile-button"
              onClick={() => togglePanel('profile')}
              aria-label="اطلاعات کاربر"
              aria-expanded={activePanel === 'profile'}
              aria-controls="profile-panel"
            >

              {/* آیکون کاربر و وضعیت نشست */}
              <span className="topbar__profile-symbol">

                <ProfileUserIcon />

                <span
                  className="topbar__profile-status"
                  title="نشست فعال"
                  aria-label="نشست فعال"
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="m2.5 6.2 2.1 2.1 4.8-5" />
                  </svg>
                </span>

              </span>

              {/* نام نمایشی کاربر */}
              <span className="topbar__profile-name">
                {userName}
              </span>

              {/* فلش باز شدن منو */}
              <span className="topbar__profile-chevron">
                <ChevronDownIcon />
              </span>

            </button>

            {activePanel === 'profile' && (
              <div
                className="topbar__popover topbar__popover--profile"
                id="profile-panel"
                role="dialog"
                aria-label="اطلاعات کاربر"
              >

                {/* سربرگ زیرمنوی پروفایل */}
                <div className="topbar__profile-menu-header">

                  <div>
                    <strong>{userName}</strong>

                    <small>{userRole}</small>
                  </div>
                  <span>
                    نام کاربری:
                    {username && ` · ${username}`}
                  </span>

                </div>


                {/* گزینه‌های زیرمنوی پروفایل */}
                <div className="topbar__profile-menu-items">

                  {/* اطلاعات حساب کاربری */}
                  <button
                    type="button"
                    className="topbar__profile-menu-item"
                    onClick={handleOpenSecurityModal}
                  >
                    <ProfileUserIcon />
                    <span>مدیریت حساب کاربری</span>
                  </button>

                  {logoutError && (
                    <Alert
                      variant="danger"
                      role="alert"
                      className="topbar__logout-error"
                    >
                      {logoutError}
                    </Alert>
                  )}

                  {/* خروج از حساب کاربری */}
                  <button
                    type="button"
                    className="topbar__profile-menu-item topbar__profile-menu-item--danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    <LogoutIcon />

                    <span>
                      {isLoggingOut
                        ? 'در حال خروج...'
                        : 'خروج از حساب کاربری'}
                    </span>
                  </button>

                </div>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* پنجره مدیریت حساب و امنیت */}
      {isSecurityModalOpen && (

        <AccountSecurityModal
          currentUser={currentUser}
          onClose={() => setIsSecurityModalOpen(false)}
          onUserUpdated={onUserUpdated}
        />

      )}
    </header>
  );
}

export default TopBar;
