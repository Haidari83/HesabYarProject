import { useId } from 'react';


// ترکیب کلاس‌های CSS و حذف مقدارهای خالی
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}


// بررسی اینکه یک مقدار واقعاً محتوای قابل نمایش دارد یا خیر
function hasContent(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== false &&
    value !== ''
  );
}


/**
 * قاب مشترک جدول‌های حساب‌یار
 *
 * این کامپوننت فقط ساختار عمومی جدول را مدیریت می‌کند.
 * دریافت اطلاعات، ساخت ستون‌ها و ردیف‌ها و منطق صفحه‌بندی
 * همچنان در کامپوننت صفحه باقی می‌ماند.
 */
function DataTableShell({

  // عنوان جدول
  title,

  // توضیح یا تعداد نتایج
  description,

  // دکمه‌ها و عملیات سربرگ
  actions,

  // سربرگ اختصاصی؛ در صورت تعیین، جایگزین سربرگ پیش‌فرض می‌شود.
  // مقدار false سربرگ را به‌طور کامل غیرفعال می‌کند.
  header,

  // جدول یا محتوای اصلی
  children,

  // محتوای صفحه‌بندی
  pagination,

  // کلاس اختصاصی قاب اصلی
  className = '',

  // کلاس اختصاصی سربرگ
  headerClassName = '',

  // کلاس اختصاصی محفظه اسکرول جدول
  wrapperClassName = '',

  // کلاس اختصاصی صفحه‌بندی
  paginationClassName = '',

  // آیا محفظه داخلی جدول قاب مستقل داشته باشد؟
  bordered = false,

  // عنصر اصلی کامپوننت؛ به‌صورت پیش‌فرض section
  as: Root = 'section',

  // سایر ویژگی‌های استاندارد HTML
  ...rootProps

}) {

  // شناسه یکتا برای اتصال عنوان به قاب اصلی
  const headingId = useId();


  // آیا سربرگ اختصاصی واقعاً ارسال شده است؟
  const hasCustomHeader =
    header !== null &&
    header !== undefined &&
    header !== false;


  // آیا حداقل یکی از بخش‌های سربرگ پیش‌فرض محتوا دارد؟
  const hasGeneratedHeader =
    hasContent(title) ||
    hasContent(description) ||
    hasContent(actions);


  // مقدار false به معنای حذف کامل سربرگ است.
  const hasHeader = header === false
    ? false
    : hasCustomHeader || hasGeneratedHeader;


  // جلوگیری از ساخت محفظه صفحه‌بندی خالی
  const hasPagination =
    pagination !== null &&
    pagination !== undefined &&
    pagination !== false &&
    pagination !== '';


  // اتصال بخش اصلی به عنوان تولیدشده
  // در صورت ارسال aria-labelledby از بیرون، همان مقدار حفظ می‌شود.
  const resolvedLabelledBy =
    rootProps['aria-labelledby'] ??
    (
      !hasCustomHeader &&
        header !== false &&
        hasContent(title)
        ? headingId
        : undefined
    );


  return (
    <Root
      // انتقال ویژگی‌های استاندارد مانند id، role و aria-label
      {...rootProps}

      // کلاس پایه و کلاس اختصاصی قاب
      className={joinClasses(
        'ui-data-table-card',
        className
      )}

      // اتصال دسترس‌پذیر قاب به عنوان آن
      aria-labelledby={resolvedLabelledBy}
    >

      {/* =====================================
          سربرگ جدول
      ====================================== */}

      {hasHeader && (

        <header
          className={joinClasses(
            'ui-data-table-card__header',
            headerClassName
          )}
        >

          {/* اگر سربرگ اختصاصی ارسال شده باشد، همان نمایش داده می‌شود. */}
          {hasCustomHeader ? (

            header

          ) : (

            <>

              {/* عنوان و توضیحات */}
              <div className="ui-data-table-card__heading">

                {hasContent(title) && (
                  <h2
                    id={headingId}
                    className="ui-data-table-card__title"
                  >
                    {title}
                  </h2>
                )}

                {hasContent(description) && (
                  <p className="ui-data-table-card__description">
                    {description}
                  </p>
                )}

              </div>


              {/* عملیات و دکمه‌های سربرگ */}
              {hasContent(actions) && (
                <div className="ui-data-table-card__actions">
                  {actions}
                </div>
              )}

            </>

          )}

        </header>

      )}


      {/* =====================================
          محفظه اصلی جدول
      ====================================== */}

      <div
        className={joinClasses(
          'ui-data-table-wrapper',
          bordered && 'ui-data-table-wrapper--bordered',
          wrapperClassName
        )}
      >

        {children}

      </div>


      {/* =====================================
          صفحه‌بندی
      ====================================== */}

      {hasPagination && (

        <div
          className={joinClasses(
            'ui-data-table-pagination',
            paginationClassName
          )}
        >

          {pagination}

        </div>

      )}

    </Root>
  );
}


export default DataTableShell;