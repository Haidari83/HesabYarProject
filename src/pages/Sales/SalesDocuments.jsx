import { useEffect, useState } from 'react';

import DatePickerModule from 'react-multi-date-picker';
import persianCalendar from 'react-date-object/calendars/persian';
import persianAfghanistan from '../../locales/persianAfghanistan';

import KeyboardSelect from '../../components/ui/KeyboardSelect';
import FormField from '../../components/ui/FormField';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import EmptyState from '../../components/ui/EmptyState';
import DataTableShell from '../../components/ui/DataTableShell';

import { formatNumber } from '../../utils/numberFormat';

import {
  getTodayGregorianDate,
  toPersianDate,
  toGregorianDate,
  formatPersianDate,
} from '../../utils/dateUtils';

import './sales-documents.css';


// استخراج کامپوننت واقعی تقویم
const DatePicker =
  DatePickerModule?.default?.default ??
  DatePickerModule?.default ??
  DatePicker;


// تعداد فاکتورهای قابل نمایش در هر صفحه
const PAGE_SIZE = 20;


// وضعیت‌های قابل فیلتر فاکتور فروش
const SALES_STATUSES = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'posted', label: 'ثبت نهایی‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
];


// نام فارسی وضعیت فاکتور
const SALES_STATUS_LABELS = {
  draft: 'پیش‌نویس',
  posted: 'ثبت نهایی‌شده',
  cancelled: 'لغوشده',
};


// کلاس ظاهری وضعیت فاکتور
function getStatusClass(status) {

  const statusClasses = {
    draft: 'draft',
    posted: 'posted',
    cancelled: 'cancelled',
  };

  return statusClasses[status] || 'unknown';

}


// قالب نمایش اعداد فاکتورهای فروش
const SALES_NUMBER_OPTIONS = {
  locale: 'fa-AF',
  maximumFractionDigits: 2,
  emptyValue: 0,
  invalidValue: 0,
};


// قالب‌بندی مبلغ با ارز مربوط به آن
function formatCurrencyTotal(total) {

  const amount = formatNumber(
    total.totalAmount,
    {
      locale: 'fa-AF',
      maximumFractionDigits:
        total.minorUnitDigits ?? 2,
    }
  );


  const currencyLabel =
    total.currencySymbol ||
    total.currencyCode;


  return `${amount} ${currencyLabel}`;

}


// دکمه‌های عملیاتی داخل تقویم
function SalesDatePickerActions({
  DatePicker,
  onSelectToday,
}) {

  return (

    <div className="sales-documents-date-picker-actions">

      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={onSelectToday}
      >
        رفتن به امروز
      </Button>


      <Button
        type="button"
        variant="primary"
        size="small"
        onClick={() => {
          // بستن تقویم پس از تأیید تاریخ
          DatePicker?.closeCalendar?.();
        }}
      >
        تأیید
      </Button>

    </div>

  );

}


// انتخاب‌گر تاریخ شمسی برای فیلتر فاکتورها
function SalesDateFilter({
  label,
  value,
  placeholder,
  onChange,
}) {

  // تبدیل تاریخ انتخاب‌شده به تاریخ استاندارد میلادی
  function handleDateChange(selectedDate) {

    if (!selectedDate) {

      onChange('');

      return;

    }


    onChange(
      toGregorianDate(selectedDate)
    );

  }


  // انتخاب تاریخ امروز افغانستان
  function handleSelectToday() {

    onChange(
      getTodayGregorianDate()
    );

  }


  return (

    <div className="sales-documents-date-field">

      <span>{label}</span>


      <DatePicker

        // مقدار اصلی فیلتر به‌صورت تاریخ شمسی نمایش داده می‌شود.
        value={toPersianDate(value)}

        // ذخیره مقدار انتخاب‌شده به‌صورت YYYY-MM-DD میلادی
        onChange={handleDateChange}

        // دکمه‌های عملیاتی داخل تقویم
        plugins={[

          <SalesDatePickerActions
            key="sales-date-picker-actions"
            position="bottom"
            onSelectToday={handleSelectToday}
          />,

        ]}

        calendar={persianCalendar}

        locale={persianAfghanistan}

        format="DD MMMM YYYY"

        calendarPosition="bottom-right"

        weekStartDayIndex={0}

        editable={false}

        clearable

        inputClass="sales-documents-date-input"

        containerClassName="sales-documents-date-container"

        placeholder={placeholder}

      />

    </div>

  );

}


// صفحه فهرست فاکتورهای فروش
function SalesDocuments() {

  // فاکتورهای دریافتی از پایگاه داده
  const [documents, setDocuments] = useState([]);


  // تعداد کل فاکتورهای مطابق فیلتر
  const [totalCount, setTotalCount] = useState(0);


  // وضعیت دریافت اطلاعات
  const [isLoading, setIsLoading] = useState(true);


  // خطای احتمالی دریافت اطلاعات
  const [loadError, setLoadError] = useState('');


  // فیلترهای قابل ویرایش توسط کاربر
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    status: 'all',
    fromDate: '',
    toDate: '',
  });


  // فیلترهایی که برای دریافت اطلاعات ارسال می‌شوند
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    fromDate: '',
    toDate: '',
  });


  // شماره صفحه فعلی
  const [currentPage, setCurrentPage] = useState(1);


  // تعداد صفحات بر اساس تعداد کل نتایج
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );


  // دریافت فهرست فاکتورهای فروش از Electron
  useEffect(() => {

    let isCurrent = true;


    async function loadSalesDocuments() {

      try {

        // دریافت متد اختصاصی فهرست فروش از Preload
        const listDocuments =
          window.hesabyar?.sales?.listDocuments;


        if (typeof listDocuments !== 'function') {
          throw new Error(
            'ارتباط با سرویس فهرست فاکتورهای فروش برقرار نیست.'
          );
        }


        // آماده‌سازی فیلترها و اطلاعات صفحه‌بندی
        const requestFilters = {

          ...filters,

          limit: PAGE_SIZE,

          offset: (currentPage - 1) * PAGE_SIZE,

        };


        // دریافت اطلاعات واقعی از SQLite
        const result = await listDocuments(
          requestFilters
        );


        // جلوگیری از اعمال پاسخ درخواست قدیمی
        if (!isCurrent) {
          return;
        }


        // بررسی ساختار پاسخ سرویس
        if (
          !result ||
          !Array.isArray(result.documents) ||
          !Number.isInteger(result.totalCount)
        ) {
          throw new Error(
            'اطلاعات دریافتی فهرست فاکتورهای فروش معتبر نیست.'
          );
        }


        setDocuments(result.documents);

        setTotalCount(result.totalCount);

        setLoadError('');


      } catch (error) {

        if (isCurrent) {

          setLoadError(
            error.message ||
            'دریافت فهرست فاکتورهای فروش ناموفق بود.'
          );

        }

      } finally {

        if (isCurrent) {
          setIsLoading(false);
        }

      }

    }


    loadSalesDocuments();


    // جلوگیری از تغییر State پس از حذف کامپوننت
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


    // کنترل ترتیب تاریخ‌ها پیش از ارسال درخواست
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


    // ارسال نسخه تمیزشده عبارت جست‌وجو
    setFilters({
      ...draftFilters,
      search: draftFilters.search.trim(),
    });

  }


  // پاک‌کردن تمام فیلترها
  function handleResetFilters() {

    const emptyFilters = {
      search: '',
      status: 'all',
      fromDate: '',
      toDate: '',
    };


    setDraftFilters(emptyFilters);

    setFilters({ ...emptyFilters });

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


  // تلاش مجدد برای دریافت اطلاعات
  function handleRetry() {

    setLoadError('');

    setIsLoading(true);


    // تغییر مرجع فیلتر باعث اجرای دوباره useEffect می‌شود.
    setFilters((previous) => ({
      ...previous,
    }));

  }


  return (

    <div className="sales-documents">

      {/* خلاصه وضعیت فهرست فروش */}
      <section className="sales-documents__summary">

        <div className="sales-documents__summary-card">

          <span>تعداد کل فاکتورهای فروش</span>

          <strong>
            {formatNumber(
              totalCount,
              SALES_NUMBER_OPTIONS
            )}
          </strong>

        </div>


        <div className="sales-documents__summary-card">

          <span>فاکتورهای این صفحه</span>

          <strong>
            {formatNumber(
              documents.length,
              SALES_NUMBER_OPTIONS
            )}
          </strong>

        </div>

      </section>


      {/* جست‌وجو و فیلتر فاکتورها */}
      <section className="sales-documents__filter-section">

        <div className="sales-documents__section-heading">

          <h2 className="ui-data-table-card__title">
            جست‌وجو و فیلتر فاکتورها
          </h2>

          <p className="ui-data-table-card__description">
            فاکتور موردنظر را بر اساس شماره، مشتری، شماره مرجع،
            وضعیت یا تاریخ پیدا کن.
          </p>

        </div>


        <form
          className="sales-documents__filter-form"
          onSubmit={handleApplyFilters}
        >

          {/* جست‌وجو در شماره فاکتور، مشتری و شماره مرجع */}
          <FormField
            className="ui-field sales-documents__search-field"
            label="جست‌وجو"
          >
            <input
              type="search"
              value={draftFilters.search}
              onChange={(event) =>
                updateDraftFilter(
                  'search',
                  event.target.value
                )
              }
              placeholder="شماره فاکتور، نام مشتری یا شماره مرجع..."
            />
          </FormField>


          {/* فیلتر وضعیت فاکتور */}
          <FormField
            className="ui-field"
            label="وضعیت فاکتور"
          >
            <KeyboardSelect
              value={draftFilters.status}
              options={SALES_STATUSES}
              onChange={(value) =>
                updateDraftFilter(
                  'status',
                  value
                )
              }
            />
          </FormField>


          {/* تاریخ شروع بازه */}
          <SalesDateFilter
            label="از تاریخ"
            value={draftFilters.fromDate}
            placeholder="تاریخ شروع"
            onChange={(date) =>
              updateDraftFilter(
                'fromDate',
                date
              )
            }
          />


          {/* تاریخ پایان بازه */}
          <SalesDateFilter
            label="تا تاریخ"
            value={draftFilters.toDate}
            placeholder="تاریخ پایان"
            onChange={(date) =>
              updateDraftFilter(
                'toDate',
                date
              )
            }
          />


          {/* عملیات فیلتر */}
          <div className="sales-documents__filter-actions">

            <Button
              type="submit"
              variant="primary"
            >
              اعمال فیلتر
            </Button>


            <Button
              type="button"
              variant="secondary"
              onClick={handleResetFilters}
            >
              پاک‌کردن فیلترها
            </Button>

          </div>

        </form>

      </section>


      {/* خطای دریافت اطلاعات */}
      {loadError && (

        <div className="sales-documents__error">

          <Alert
            variant="danger"
            role="alert"
            className="sales-documents__error-message"
          >
            {loadError}
          </Alert>


          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={handleRetry}
          >
            تلاش مجدد
          </Button>

        </div>

      )}


      {/* قاب مشترک جدول فاکتورهای فروش */}
      <DataTableShell
        title="فاکتورهای فروش"
        description="فهرست پیش‌نویس‌ها و فاکتورهای ثبت نهایی‌شده"
        bordered
        paginationClassName="sales-documents__pagination"

        // صفحه‌بندی جدول
        pagination={
          totalPages > 1 ? (

            <>

              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={currentPage === 1 || isLoading}
                onClick={() =>
                  handlePageChange(currentPage - 1)
                }
              >
                قبلی
              </Button>


              <span>
                صفحه{' '}
                {formatNumber(
                  currentPage,
                  SALES_NUMBER_OPTIONS
                )}
                {' '}از{' '}
                {formatNumber(
                  totalPages,
                  SALES_NUMBER_OPTIONS
                )}
              </span>


              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={
                  currentPage === totalPages ||
                  isLoading
                }
                onClick={() =>
                  handlePageChange(currentPage + 1)
                }
              >
                بعدی
              </Button>

            </>

          ) : null
        }
      >

        {/* وضعیت بارگذاری */}
        {isLoading ? (

          <div className="sales-documents__loading">
            در حال دریافت فاکتورهای فروش...
          </div>

        ) : documents.length > 0 ? (

          /* جدول اطلاعات فاکتورها */
          <table className="ui-data-table sales-documents__table">

            <thead>

              <tr>
                <th>شماره فاکتور</th>
                <th>تاریخ</th>
                <th>مشتری</th>
                <th>تعداد اقلام</th>
                <th>مبلغ کل</th>
                <th>ایجادکننده</th>
                <th>ثبت‌کننده نهایی</th>
                <th>وضعیت</th>
              </tr>

            </thead>


            <tbody>

              {documents.map((document) => (

                <tr key={document.id}>

                  {/* شماره فاکتور و شماره مرجع */}
                  <td>

                    <div className="sales-documents__number">

                      <strong>
                        {document.documentNumber}
                      </strong>

                      {document.sourceInvoiceNumber && (
                        <small>
                          مرجع: {document.sourceInvoiceNumber}
                        </small>
                      )}

                    </div>

                  </td>


                  {/* تاریخ فاکتور */}
                  <td>
                    {formatPersianDate(
                      document.documentDate
                    )}
                  </td>


                  {/* نام مشتری */}
                  <td>
                    {document.customerName || '—'}
                  </td>


                  {/* تعداد ردیف‌های فاکتور */}
                  <td>
                    {formatNumber(
                      document.itemCount,
                      SALES_NUMBER_OPTIONS
                    )}
                  </td>


                  {/* جمع مبلغ به تفکیک ارز */}
                  <td>

                    <div className="sales-documents__totals">

                      {document.totalsByCurrency?.length > 0 ? (

                        document.totalsByCurrency.map((total) => (

                          <span key={total.currencyCode}>
                            {formatCurrencyTotal(total)}
                          </span>

                        ))

                      ) : (

                        '—'

                      )}

                    </div>

                  </td>


                  {/* کاربر ایجادکننده پیش‌نویس */}
                  <td>

                    <div className="sales-documents__user">

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


                  {/* کاربر ثبت‌کننده نهایی */}
                  <td>
                    {document.postedByDisplayName || '—'}
                  </td>


                  {/* وضعیت فاکتور */}
                  <td>

                    <span
                      className={`sales-documents__status sales-documents__status--${getStatusClass(
                        document.status
                      )}`}
                    >
                      {SALES_STATUS_LABELS[
                        document.status
                      ] || 'نامشخص'}
                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        ) : (

          // وضعیت خالی فهرست
          <EmptyState
            variant="table"
            title="فاکتوری پیدا نشد."
            description="برای فیلترهای انتخاب‌شده، فاکتور فروشی در پایگاه داده وجود ندارد."
          />

        )}

      </DataTableShell>

    </div>

  );

}


export default SalesDocuments;