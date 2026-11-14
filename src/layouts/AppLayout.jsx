
import { useEffect, useState } from 'react';

import TopBar from '../components/navigation/TopBar';
import Sidebar from '../components/navigation/Sidebar';

import './app-layout.css';


/* =========================
   چارچوب اصلی برنامه
========================= */

function AppLayout({
  children,
  navigationItems = [],
  activeItem = 'dashboard',
  onPageSelect = () => { },
  currentUser = null,
  onLogout = () => { }
}) {

  // وضعیت جمع‌شدن منوی کناری در دسکتاپ
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // وضعیت باز بودن منوی کشویی در موبایل
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // تشخیص اندازه نمایشگر
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 760px)').matches
  );


  /* =========================
     مدیریت اندازه نمایشگر
  ========================= */

  useEffect(() => {

    const mediaQuery = window.matchMedia('(max-width: 760px)');

    // بررسی تغییر اندازه نمایشگر
    function handleMediaChange(event) {

      setIsMobile(event.matches);

      // هنگام تغییر حالت نمایشگر، منوی موبایل را می‌بندیم
      setMobileSidebarOpen(false);

    }

    mediaQuery.addEventListener('change', handleMediaChange);

    // حذف رویداد هنگام خروج کامپوننت
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };

  }, []);


  /* =========================
     مدیریت باز و بسته شدن Sidebar
  ========================= */

  function handleToggleSidebar() {

    // در موبایل، منو به شکل کشویی باز و بسته می‌شود
    if (isMobile) {

      setMobileSidebarOpen((previousState) => !previousState);

      return;
    }

    // در دسکتاپ، منو جمع یا باز می‌شود
    setSidebarCollapsed((previousState) => !previousState);

  }


  // بستن منوی موبایل
  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }


  // باز کردن منوی دسکتاپ
  function expandSidebar() {
    setSidebarCollapsed(false);
  }


  /* =========================
     بستن منوی موبایل با Escape
  ========================= */

  useEffect(() => {

    // فقط هنگام باز بودن منوی موبایل رویداد را فعال می‌کنیم
    if (!mobileSidebarOpen) {
      return;
    }

    function handleEscape(event) {

      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }

    }

    document.addEventListener('keydown', handleEscape);

    // حذف رویداد هنگام بسته شدن منو
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };

  }, [mobileSidebarOpen]);


  return (

    <div className="app-layout">

      {/* نوار بالایی برنامه */}
      <TopBar
        onToggleSidebar={handleToggleSidebar}
        sidebarCollapsed={
          isMobile ? !mobileSidebarOpen : sidebarCollapsed
        }
        currentUser={currentUser}
        onLogout={onLogout}
      />


      {/* بدنه اصلی برنامه */}
      <div className="app-layout__body">

        {/* لایه تیره پشت منوی کشویی موبایل */}
        {isMobile && mobileSidebarOpen && (

          <button
            type="button"
            className="app-layout__sidebar-overlay"
            onClick={closeMobileSidebar}
            aria-label="بستن منوی کناری"
          />

        )}


        {/* منوی کناری */}
        <Sidebar
          items={navigationItems}
          collapsed={!isMobile && sidebarCollapsed}
          mobileOpen={isMobile && mobileSidebarOpen}
          activeItem={activeItem}
          onSelect={onPageSelect}
          onCloseMobile={closeMobileSidebar}
          onExpand={expandSidebar}
        />


        {/* فضای نمایش صفحه انتخاب‌شده */}
        <main className="app-layout__main">
          {children}
        </main>

      </div>

    </div>

  );
}

export default AppLayout;
