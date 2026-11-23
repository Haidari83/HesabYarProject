import { useEffect, useState } from 'react';

import DatePickerModule from 'react-multi-date-picker';
import DateObject from 'react-date-object';

import persianCalendar from 'react-date-object/calendars/persian';
import gregorianCalendar from 'react-date-object/calendars/gregorian';

import gregorianEnglish from 'react-date-object/locales/gregorian_en';

import persianAfghanistan from '../../locales/persianAfghanistan';

import './inventory-documents.css';


// استخراج کامپوننت واقعی تقویم
const DatePicker =
  DatePickerModule?.default?.default ??
  DatePickerModule?.default ??
  DatePickerModule;


// تعداد اسناد قابل نمایش در هر صفحه
const PAGE_SIZE = 20;


// انواع اسناد انبار
const DOCUMENT_TYPES = [
  { value: 'all', label: 'همه انواع اسناد' },
  { value: 'purchase', label: 'خرید' },
  { value: 'sales_return', label: 'برگشت از فروش' },
  { value: 'opening', label: 'موجودی اولیه' },
  { value: 'other', label: 'سایر' },
  { value: 'sale', label: 'فروش' },
  { value: 'purchase_return', label: 'برگشت از خرید' },
  { value: 'adjustment_in', label: 'اصلاح افزایشی' },
  { value: 'adjustment_out', label: 'اصلاح کاهشی' },
];


// وضعیت‌های اسناد
const DOCUMENT_STATUSES = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'posted', label: 'ثبت نهایی‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
];


// نام فارسی انواع سند
const DOCUMENT_TYPE_LABELS = Object.fromEntries(
  DOCUMENT_TYPES
    .filter((item) => item.value !== 'all')
    .map((item) => [
      item.value,
      item.label,
    ])
);


// نام فارسی وضعیت سند
const DOCUMENT_STATUS_LABELS = Object.fromEntries(
  DOCUMENT_STATUSES
    .filter((item) => item.value !== 'all')
    .map((item) => [
      item.value,
      item.label,
    ])
);


// دریافت کلاس وضعیت سند
function getStatusClass(status) {

  const statusClasses = {
    draft: 'draft',
    posted: 'posted',
    cancelled: 'cancelled',
  };

  return statusClasses[status] || 'unknown';

}


// تبدیل تاریخ میلادی به تاریخ شمسی
function getPersianDateValue(gregorianDate) {

  if (!gregorianDate) {
    return null;
  }

  return new DateObject({
    date: gregorianDate,
    format: 'YYYY-MM-DD',
  }).convert(
    persianCalendar,
    persianAfghanistan
  );

}


// تبدیل تاریخ شمسی به تاریخ میلادی استاندارد
function convertToGregorianDate(selectedDate) {

  if (!selectedDate) {
    return '';
  }

  return new DateObject(selectedDate)
    .convert(
      gregorianCalendar,
      gregorianEnglish
    )
    .format('YYYY-MM-DD');

}


// نمایش تاریخ سند به شکل شمسی
function formatDocumentDate(date) {

  if (!date) {
    return '—';
  }

  return getPersianDateValue(date)
    .format('DD MMMM YYYY');

}


// قالب‌بندی عدد با ارقام فارسی
function formatNumber(value) {

  return new Intl.NumberFormat('fa-AF').format(
    Number(value) || 0
  );

}


function InventoryDocuments() {

  // فهرست اسناد دریافتی از SQLite
  const [documents, setDocuments] = useState([]);

  // تعداد کل اسناد مطابق فیلترها
  const [totalCount, setTotalCount] = useState(0);

  // وضعیت دریافت اطلاعات
  const [isLoading, setIsLoading] = useState(true);

  // خطای احتمالی دریافت اطلاعات
  const [loadError, setLoadError] = useState('');


  // وضعیت فیلترهای قابل ویرایش توسط کاربر
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    documentType: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });


  // فیلترهایی که در درخواست SQLite استفاده می‌شوند
  const [filters, setFilters] = useState({
    search: '',
    documentType: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });


  // شماره صفحه فعلی
  const [currentPage, setCurrentPage] = useState(1);


  // تعداد صفحات
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );


  // دریافت اطلاعات اسناد از Electron
  useEffect(() => {

    let isCurrent = true;


    async function loadDocuments() {

      try {

        const listDocuments =
          window.hesabyar?.inventory?.listDocuments;


        if (typeof listDocuments !== 'function') {
          throw new Error(
            'ارتباط با سرویس فهرست اسناد برقرار نیست.'
          );
        }


        // آماده‌سازی فیلترها و صفحه‌بندی
        const requestFilters = {

          ...filters,

          limit: PAGE_SIZE,

          offset: (currentPage - 1) * PAGE_SIZE,

        };


        // دریافت اطلاعات واقعی از SQLite
        const result = await listDocuments(requestFilters);


        if (!isCurrent) {
          return;
        }


        // بررسی اعتبار پاسخ
        if (
          !result ||
          !Array.isArray(result.documents) ||
          !Number.isInteger(result.totalCount)
        ) {
          throw new Error(
            'اطلاعات دریافتی فهرست اسناد معتبر نیست.'
          );
        }


        setDocuments(result.documents);

        setTotalCount(result.totalCount);

        setLoadError('');


      } catch (error) {

        if (isCurrent) {

          setLoadError(
            error.message ||
            'دریافت فهرست اسناد ناموفق بود.'
          );

        }

      } finally {

        if (isCurrent) {
          setIsLoading(false);
        }

      }

    }


    loadDocuments();


    // جلوگیری از دریافت پاسخ درخواست‌های قدیمی
    return () => {
      isCurrent = false;
    };

  }, [filters, currentPage]);


  // تغییر فیلترهای موقت
  function updateDraftFilter(key, value) {

    setDraftFilters((previous) => ({
      ...previous,
      [key]: value,
    }));

  }


  // اعمال فیلترها
  function handleApplyFilters(event) {

    event.preventDefault();


    // اعتبارسنجی ترتیب تاریخ‌ها
    if (
      draftFilters.fromDate &&
      draftFilters.toDate &&
      draftFilters.fromDate > draftFilters.toDate
    ) {

      setLoadError(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.'
      );

      return;

    }


    setLoadError('');

    setIsLoading(true);

    setCurrentPage(1);

    setFilters({
      ...draftFilters,
      search: draftFilters.search.trim(),
    });

  }


  // پاک‌کردن فیلترها
  function handleResetFilters() {

    const emptyFilters = {
      search: '',
      documentType: 'all',
      status: 'all',
      fromDate: '',
      toDate: '',
    };

    setDraftFilters(emptyFilters);

    setFilters(emptyFilters);

    setCurrentPage(1);

    setLoadError('');

    setIsLoading(true);

  }


  // تغییر صفحه
  function handlePageChange(page) {

    if (
      page < 1 ||
      page > totalPages ||
      page === currentPage
    ) {
      return;
    }

    setCurrentPage(page);

    setIsLoading(true);

  }


  // تلاش مجدد برای دریافت اسناد
  function handleRetry() {

    setLoadError('');

    setIsLoading(true);

    // تغییر فیلتر باعث اجرای مجدد درخواست می‌شود.
    setFilters((previous) => ({
      ...previous,
    }));

  }


  return (

    <div className="inventory-documents">

      {/* خلاصه فهرست اسناد */}
      <section className="documents-summary">

        <div>
          <span>تعداد کل اسناد</span>

          <strong>
            {formatNumber(totalCount)}
          </strong>
        </div>

        <div>
          <span>اسناد این صفحه</span>

          <strong>
            {formatNumber(documents.length)}
          </strong>
        </div>

      </section>


      {/* فیلترها و جست‌وجو */}
      <section className="documents-filter-section">

        <div className="documents-section-heading">

          <div>
            <h2>جست‌وجو و فیلتر اسناد</h2>

            <p>
              سند موردنظر را بر اساس شماره، نوع، وضعیت یا تاریخ پیدا کن.
            </p>
          </div>

        </div>


        <form
          className="documents-filter-form"
          onSubmit={handleApplyFilters}
        >

          {/* جست‌وجو */}
          <label className="documents-field documents-search-field">

            <span>جست‌وجو</span>

            <input
              type="search"
              value={draftFilters.search}
              onChange={(event) =>
                updateDraftFilter(
                  'search',
                  event.target.value
                )
              }
              placeholder="شماره سند، طرف حساب یا شماره فاکتور..."
            />

          </label>


          {/* نوع سند */}
          <label className="documents-field">

            <span>نوع سند</span>

            <select
              value={draftFilters.documentType}
              onChange={(event) =>
                updateDraftFilter(
                  'documentType',
                  event.target.value
                )
              }
            >

              {DOCUMENT_TYPES.map((item) => (

                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>

              ))}

            </select>

          </label>


          {/* وضعیت */}
          <label className="documents-field">

            <span>وضعیت سند</span>

            <select
              value={draftFilters.status}
              onChange={(event) =>
                updateDraftFilter(
                  'status',
                  event.target.value
                )
              }
            >

              {DOCUMENT_STATUSES.map((item) => (

                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>

              ))}

            </select>

          </label>


          {/* تاریخ شروع */}
          <label className="documents-field">

            <span>از تاریخ</span>

            <DatePicker
              value={getPersianDateValue(
                draftFilters.fromDate
              )}
              onChange={(date) =>
                updateDraftFilter(
                  'fromDate',
                  date
                    ? convertToGregorianDate(date)
                    : ''
                )
              }
              calendar={persianCalendar}
              locale={persianAfghanistan}
              format="DD MMMM YYYY"
              calendarPosition="bottom-right"
              editable={false}
              clearable
              inputClass="documents-date-input"
              containerClassName="documents-date-container"
              placeholder="تاریخ شروع"
            />

          </label>


          {/* تاریخ پایان */}
          <label className="documents-field">

            <span>تا تاریخ</span>

            <DatePicker
              value={getPersianDateValue(
                draftFilters.toDate
              )}
              onChange={(date) =>
                updateDraftFilter(
                  'toDate',
                  date
                    ? convertToGregorianDate(date)
                    : ''
                )
              }
              calendar={persianCalendar}
              locale={persianAfghanistan}
              format="DD MMMM YYYY"
              calendarPosition="bottom-right"
              editable={false}
              clearable
              inputClass="documents-date-input"
              containerClassName="documents-date-container"
              placeholder="تاریخ پایان"
            />

          </label>


          {/* دکمه‌های عملیات فیلتر */}
          <div className="documents-filter-actions">

            <button
              type="submit"
              className="documents-apply-button"
            >
              اعمال فیلتر
            </button>

            <button
              type="button"
              className="documents-reset-button"
              onClick={handleResetFilters}
            >
              پاک‌کردن فیلترها
            </button>

          </div>

        </form>

      </section>


      {/* جدول اسناد */}
      <section className="documents-table-section">

        <div className="documents-section-heading">

          <div>
            <h2>اسناد انبار</h2>

            <p>
              فهرست اسناد ثبت‌شده و پیش‌نویس‌های ذخیره‌شده
            </p>
          </div>

        </div>


        {loadError && (

          <div
            className="documents-error"
            role="alert"
          >

            <span>{loadError}</span>

            <button
              type="button"
              onClick={handleRetry}
            >
              تلاش مجدد
            </button>

          </div>

        )}


        {isLoading ? (

          <div className="documents-loading">
            در حال دریافت اسناد انبار...
          </div>

        ) : documents.length > 0 ? (

          <>

            <div className="documents-table-wrapper">

              <table className="documents-table">

                <thead>

                  <tr>
                    <th>شماره سند</th>
                    <th>تاریخ</th>
                    <th>نوع سند</th>
                    <th>طرف حساب</th>
                    <th>تعداد اقلام</th>
                    <th>ثبت‌کننده</th>
                    <th>وضعیت</th>
                  </tr>

                </thead>


                <tbody>

                  {documents.map((document) => (

                    <tr key={document.id}>

                      <td>
                        <strong className="documents-number">
                          {document.documentNumber}
                        </strong>
                      </td>


                      <td>
                        {formatDocumentDate(
                          document.documentDate
                        )}
                      </td>


                      <td>
                        {DOCUMENT_TYPE_LABELS[
                          document.documentType
                        ] || 'نامشخص'}
                      </td>


                      <td>
                        {document.sourcePartyName || '—'}
                      </td>


                      <td>
                        {formatNumber(document.itemCount)}
                      </td>


                      <td>
                        <div className="documents-creator">

                          <strong>
                            {document.createdBy?.displayName || '—'}
                          </strong>

                          {document.createdBy?.username && (
                            <small>
                              {document.createdBy.username}
                            </small>
                          )}

                        </div>
                      </td>


                      <td>

                        <span
                          className={`documents-status documents-status-${getStatusClass(document.status)}`}
                        >

                          {DOCUMENT_STATUS_LABELS[
                            document.status
                          ] || 'نامشخص'}

                        </span>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>


            {/* صفحه‌بندی */}
            {totalPages > 1 && (

              <div className="documents-pagination">

                <button
                  type="button"
                  disabled={currentPage === 1 || isLoading}
                  onClick={() =>
                    handlePageChange(currentPage - 1)
                  }
                >
                  قبلی
                </button>


                <span>
                  صفحه {formatNumber(currentPage)}
                  {' '}
                  از {formatNumber(totalPages)}
                </span>


                <button
                  type="button"
                  disabled={currentPage === totalPages || isLoading}
                  onClick={() =>
                    handlePageChange(currentPage + 1)
                  }
                >
                  بعدی
                </button>

              </div>

            )}

          </>

        ) : (

          <div className="documents-empty">

            <strong>
              سندی پیدا نشد.
            </strong>

            <p>
              برای این فیلترها سندی در پایگاه داده وجود ندارد.
            </p>

          </div>

        )}

      </section>

    </div>

  );

}

export default InventoryDocuments;