
import './page-layout.css';

/* =========================
   قالب عمومی صفحات
========================= */

function PageLayout({
  title,
  description,
  breadcrumbs = [],
  actions,
  toolbar,
  children,
  className = ''
}) {

  // اضافه کردن عنوان صفحه به انتهای مسیر دسترسی
  const breadcrumbItems = [...breadcrumbs, title].filter(Boolean);

  return (
    <section
      className={`page-layout ${className}`.trim()}
      aria-labelledby="page-layout-title"
    >

      {/* =========================
          مسیر دسترسی
      ========================== */}

      {breadcrumbItems.length > 0 && (

        <nav
          className="page-layout__breadcrumb"
          aria-label="مسیر دسترسی"
        >

          <ol>

            {breadcrumbItems.map((item, index) => {

              // بررسی اینکه این بخش، آخرین قسمت مسیر است یا خیر
              const isLastItem = index === breadcrumbItems.length - 1;

              return (
                <li
                  key={`${item}-${index}`}
                  aria-current={isLastItem ? 'page' : undefined}
                >
                  {item}
                </li>
              );
            })}

          </ol>

        </nav>

      )}


      {/* =========================
          عنوان و عملیات صفحه
      ========================== */}

      <header className="page-layout__header">

        {/* عنوان و توضیحات */}
        <div className="page-layout__heading">

          <h1 id="page-layout-title">
            {title}
          </h1>

          {description && (
            <p>
              {description}
            </p>
          )}

        </div>


        {/* دکمه‌ها و عملیات مرتبط با صفحه */}
        {actions && (
          <div className="page-layout__actions">
            {actions}
          </div>
        )}

      </header>


      {/* =========================
          نوار ابزار صفحه
      ========================== */}

      {toolbar && (
        <div className="page-layout__toolbar">
          {toolbar}
        </div>
      )}


      {/* =========================
          محتوای اصلی صفحه
      ========================== */}

      <div className="page-layout__content">
        {children}
      </div>

    </section>
  );
}

export default PageLayout;
