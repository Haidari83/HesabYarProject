
// import Login from './pages/Login/Login';
import AppLayout from './layouts/AppLayout';
import PageLayout from './components/page/PageLayout';

function App() {
  return (
    <AppLayout>

      <PageLayout

        // عنوان صفحه
        title="فهرست محصولات"

        // توضیحات زیر عنوان
        description="مدیریت و بررسی محصولات فروشگاه"

        // مسیر دسترسی؛ عنوان صفحه به‌صورت خودکار اضافه می‌شود
        breadcrumbs={[
          'داشبورد',
          'محصولات و انبار'
        ]}

        // عملیات مرتبط با صفحه
        actions={
          <button
            type="button"
            className="page-demo-action"
          >
            افزودن محصول
          </button>
        }

        // نوار ابزار صفحه
        toolbar={
          <div className="page-demo-toolbar">

            <span>
              جست‌وجوی محصولات...
            </span>

            <button type="button">
              فیلتر
            </button>

          </div>
        }

      >

        {/* محتوای آزمایشی صفحه */}
        <div className="page-demo-content">

          <h2>
            محتوای صفحه
          </h2>

          <p>
            اطلاعات محصولات، جدول‌ها و سایر اجزای صفحه
            در این قسمت نمایش داده خواهند شد.
          </p>

        </div>

      </PageLayout>

    </AppLayout>
    //  {<Login />;}
  )
}

export default App;
