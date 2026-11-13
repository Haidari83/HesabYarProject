
import { useState } from 'react';

import AppLayout from './layouts/AppLayout';
import PageLayout from './components/page/PageLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import ProductList from './pages/Products/ProductList';
import CategoryList from './pages/Categories/CategoryList';

import {
  navigationItems,
  pageRegistry
} from './routes/pageRegistry';


/* =========================
   برنامه اصلی حساب‌یار
========================= */

function App() {

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

export default App;
