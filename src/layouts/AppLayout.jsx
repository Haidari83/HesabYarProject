
import { useEffect, useState } from 'react';

import TopBar from '../components/navigation/TopBar';
import Sidebar from '../components/navigation/Sidebar';

import './app-layout.css';

function AppLayout({ children }) {

  // وضعیت جمع‌شده منوی کناری در دسکتاپ
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // وضعیت باز بودن منوی کشویی در موبایل
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // تشخیص اینکه اندازه صفحه در محدوده موبایل است یا خیر
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 760px)').matches
  );

  // شناسه بخش انتخاب‌شده در منو
  const [activeItem, setActiveItem] = useState('dashboard');


  /* =========================
     تشخیص اندازه نمایشگر
  ========================= */

  useEffect(() => {

    const mediaQuery = window.matchMedia('(max-width: 760px)');

    // به‌روزرسانی وضعیت هنگام تغییر اندازه نمایشگر
    function handleMediaChange(event) {
      setIsMobile(event.matches);
      setMobileSidebarOpen(false);
    }

    mediaQuery.addEventListener('change', handleMediaChange);

    // حذف رویداد هنگام خروج کامپوننت از صفحه
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };

  }, []);


  /* =========================
     مدیریت منوی کناری
  ========================= */

  // تغییر وضعیت Sidebar متناسب با اندازه نمایشگر
  function handleToggleSidebar() {

    if (isMobile) {
      setMobileSidebarOpen((previousState) => !previousState);
      return;
    }

    setSidebarCollapsed((previousState) => !previousState);
  }


  // بستن منوی کشویی موبایل
  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }


  // باز کردن منوی دسکتاپ در صورت نیاز
  function expandSidebar() {
    setSidebarCollapsed(false);
  }


  /* =========================
     مدیریت انتخاب بخش‌ها
  ========================= */

  // ثبت بخش انتخاب‌شده در منو
  function handlePageSelect(page) {
    setActiveItem(page.id);
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
        closeMobileSidebar();
      }
    }

    document.addEventListener('keydown', handleEscape);

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
      />


      {/* بدنه اصلی برنامه */}
      <div className="app-layout__body">

        {/* لایه تیره پشت منوی موبایل */}
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
          collapsed={!isMobile && sidebarCollapsed}
          mobileOpen={isMobile && mobileSidebarOpen}
          activeItem={activeItem}
          onSelect={handlePageSelect}
          onCloseMobile={closeMobileSidebar}
          onExpand={expandSidebar}
        />


        {/* فضای نمایش صفحات */}
        <main className="app-layout__main">
          {children}
        </main>

      </div>

    </div>
  );
}

export default AppLayout;
