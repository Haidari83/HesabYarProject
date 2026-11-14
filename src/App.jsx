
import { useEffect, useState } from 'react';

import Login from './pages/Login/Login';
import InitialSetup from './pages/Setup/InitialSetup';

import AppLayout from './layouts/AppLayout';
import PageLayout from './components/page/PageLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import ProductList from './pages/Products/ProductList';
import CategoryList from './pages/Categories/CategoryList';
import UnitList from './pages/Units/UnitList';
import InventoryOverview from './pages/Inventory/InventoryOverview';
import InventoryStockList from './pages/Inventory/InventoryStockList';
import InventoryEntry from './pages/Inventory/InventoryEntry';
import UserManagement from './pages/Users/UserManagement';

import {
  navigationItems,
  pageRegistry
} from './routes/pageRegistry';


/* =========================
   برنامه اصلی حساب‌یار
========================= */

function ApplicationShell({ currentUser, onLogout }) {

  // شناسه صفحه‌ای که در حال حاضر نمایش داده می‌شود
  const [activePageId, setActivePageId] = useState('dashboard');


  // دریافت اطلاعات صفحه انتخاب‌شده
  const currentPage = pageRegistry[activePageId];


  /* =========================
     مدیریت تغییر صفحات
  ========================= */

  function handlePageSelect(page) {

    // جلوگیری از انتخاب شناسه‌های ثبت‌نشده
    if (!pageRegistry[page.id]) {
      return;
    }

    // تغییر صفحه فعال
    setActivePageId(page.id);

  }


  return (

    <AppLayout

      // ارسال ساختار منو به چارچوب اصلی
      navigationItems={navigationItems}

      // ارسال شناسه صفحه فعال
      activeItem={activePageId}

      // دریافت انتخاب جدید از Sidebar
      onPageSelect={handlePageSelect}

      currentUser={currentUser}

      onLogout={onLogout}
    >

      {/* قالب عمومی صفحه انتخاب‌شده */}


      <PageLayout
        title={currentPage.title}
        description={currentPage.description}
        breadcrumbs={currentPage.breadcrumbs}
      >
        {activePageId === 'dashboard' ? (
          <Dashboard />
        ) : activePageId === 'product-list' ? (
          <ProductList />
        ) : activePageId === 'categories' ? (
          <CategoryList />
        ) : activePageId === 'units' ? (
          <UnitList />
        ) : activePageId === 'inventory' ? (
          <InventoryOverview onNavigate={setActivePageId} />
        ) : activePageId === 'inventory-stock-list' ? (
          <InventoryStockList />
        ) : activePageId === 'inventory-entry' ? (
          <InventoryEntry />
        ) : activePageId === 'users' ? (
          <UserManagement />
        ) : (
          <div className="page-demo-content">
            <h2>{currentPage.title}</h2>
            <p>{currentPage.description}</p>
          </div>
        )}
      </PageLayout>



    </AppLayout>

  );
}


function App() {

  // وضعیت آغاز برنامه
  const [startupState, setStartupState] = useState('checking');

  const [startupError, setStartupError] = useState('');

  // اطلاعات کاربر احراز هویت‌شده
  const [currentUser, setCurrentUser] = useState(null);

  // بررسی وضعیت کاربران هنگام شروع برنامه
  useEffect(() => {

    let isActive = true;

    async function checkSetupStatus() {

      try {

        // دریافت API از Preload
        const getSetupStatus =
          window.hesabyar?.system?.getSetupStatus;

        if (typeof getSetupStatus !== 'function') {

          throw new Error(
            'ارتباط با هسته Electron برقرار نیست. برنامه را از طریق پنجره دسکتاپ اجرا کن.'
          );

        }


        // دریافت وضعیت راه‌اندازی
        const result = await getSetupStatus();


        if (
          typeof result?.needsInitialSetup !== 'boolean'
        ) {
          throw new Error(
            'پاسخ وضعیت راه‌اندازی معتبر نیست.'
          );
        }


        if (result.needsInitialSetup) {

          if (isActive) {
            setStartupState('setup');
          }

        } else {

          // اگر در همین اجرای Electron نشست فعالی وجود داشته باشد،
          // اطلاعات کاربر را دوباره دریافت می‌کنیم.
          const getCurrentSession =
            window.hesabyar?.auth?.getCurrentSession;

          if (typeof getCurrentSession !== 'function') {
            throw new Error(
              'سرویس بازیابی نشست کاربر در دسترس نیست.'
            );
          }

          const restoredUser = await getCurrentSession();

          if (isActive) {

            if (restoredUser) {
              setCurrentUser(restoredUser);
              setStartupState('authenticated');
            } else {
              setStartupState('login');
            }

          }

        }

      } catch (error) {

        if (isActive) {

          setStartupError(
            error.message ||
            'بررسی وضعیت راه‌اندازی حساب‌یار ناموفق بود.'
          );

          setStartupState('error');

        }

      }

    }


    checkSetupStatus();


    // جلوگیری از تغییر State پس از خروج کامپوننت
    return () => {
      isActive = false;
    };

  }, []);

  // تکمیل ورود موفق کاربر
  function handleLogin(user) {

    setCurrentUser(user);

    setStartupState('authenticated');

  }

  // خروج از حساب کاربری
  async function handleLogout() {

    const logout = window.hesabyar?.auth?.logout;

    if (typeof logout !== 'function') {
      throw new Error(
        'سرویس خروج از حساب در دسترس نیست.'
      );
    }

    const result = await logout();

    if (!result?.success) {
      throw new Error(
        'خروج از حساب انجام نشد.'
      );
    }

    // پاک‌کردن اطلاعات کاربر از رابط React
    setCurrentUser(null);

    // بازگشت به صفحه ورود
    setStartupState('login');

  }

  // وضعیت بررسی اولیه
  if (startupState === 'checking') {

    return (
      <div className="auth-startup-message">
        در حال بررسی وضعیت حساب‌یار...
      </div>
    );

  }


  // نمایش خطای راه‌اندازی
  if (startupState === 'error') {

    return (
      <div className="auth-startup-message">

        <h2>راه‌اندازی حساب‌یار با خطا مواجه شد.</h2>

        <p>{startupError}</p>

        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          تلاش مجدد
        </button>

      </div>
    );

  }


  // اولین اجرا: ساخت مدیر اولیه
  if (startupState === 'setup') {

    return (
      <InitialSetup
        onComplete={() => setStartupState('login')}
      />
    );

  }


  if (startupState === 'authenticated' && currentUser) {
    return (
      <ApplicationShell
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  return <Login onLogin={handleLogin} />;

}

export default App;

