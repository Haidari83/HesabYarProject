import { useEffect, useRef, useState } from 'react';

import { readSheet } from 'read-excel-file/browser';

import './excel-import-modal.css';
import { validateExcelProductRows } from './excel-import-validation';


// تعریف ستون‌های مورد انتظار فایل Excel
const EXCEL_COLUMNS = [
  {
    key: 'name',
    label: 'نام محصول',
    required: true,
    aliases: ['نام محصول', 'نام کالا'],
  },
  {
    key: 'category',
    label: 'دسته‌بندی',
    required: true,
    aliases: ['دسته بندی', 'نام دسته بندی'],
  },
  {
    key: 'baseUnit',
    label: 'واحد پایه',
    required: true,
    aliases: ['واحد پایه', 'واحد مبنا', 'واحد اصلی'],
  },
  {
    key: 'subUnit',
    label: 'واحد فرعی',
    required: false,
    aliases: ['واحد فرعی', 'واحد دیگر', 'واحد بسته بندی'],
  },
  {
    key: 'numerator',
    label: 'صورت تبدیل',
    required: false,
    aliases: ['صورت تبدیل', 'صورت ضریب تبدیل'],
  },
  {
    key: 'denominator',
    label: 'مخرج تبدیل',
    required: false,
    aliases: ['مخرج تبدیل', 'مخرج ضریب تبدیل'],
  },
];


// یکسان‌سازی عنوان ستون‌ها برای تطبیق فارسی
function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


// تبدیل مقدار سلول به متن قابل نمایش
function getCellText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}


// نمایش حجم فایل
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} بایت`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}


function ExcelImportModal({
  onClose,
  categories,
  units,
  products,
  onImported,
}) {
  // مرجع ورودی فایل برای باز کردن مستقیم پنجره انتخاب فایل
  const fileInputRef = useRef(null);

  // نام فایل انتخاب‌شده
  const [fileName, setFileName] = useState('');

  // حجم فایل انتخاب‌شده
  const [fileSize, setFileSize] = useState('');

  // نتیجه اعتبارسنجی محصولات و ردیف‌های Excel
  const [validationResult, setValidationResult] = useState(null);

  // وضعیت اجرای ثبت گروهی محصولات
  const [isImporting, setIsImporting] = useState(false);

  // باز کردن مستقیم پنجره انتخاب فایل سیستم‌عامل
  function openFilePicker() {
    if (isReading || isImporting) {
      return;
    }

    fileInputRef.current?.click();
  }
  // خطای احتمالی ثبت محصولات در دیتابیس
  const [importError, setImportError] = useState('');

  // گزارش نهایی ثبت محصولات
  const [importReport, setImportReport] = useState(null);

  // مرحله فعلی فرایند واردسازی
  // upload: انتخاب فایل
  // validation: نمایش تمام موارد تأیید و ردشده
  // approved: نمایش فقط کالاهای تأییدشده
  // completed: گزارش نهایی ثبت
  const [currentStep, setCurrentStep] = useState('upload');
  // وضعیت خواندن فایل
  const [isReading, setIsReading] = useState(false);

  // خطای احتمالی فایل یا ساختار آن
  const [readError, setReadError] = useState('');

  // مراجع مدیریت تمرکز مودال
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // نگهداری آخرین تابع بستن مودال
  const closeHandlerRef = useRef(onClose);

  // نگهداری وضعیت مشغول بودن مودال
  const busyRef = useRef(false);

  // به‌روزرسانی مرجع تابع بستن مودال
  useEffect(() => {
    closeHandlerRef.current = onClose;
  }, [onClose]);

  // به‌روزرسانی وضعیت مشغول بودن
  useEffect(() => {
    busyRef.current = isReading || isImporting;
  }, [isReading, isImporting]);

  // مدیریت صفحه‌کلید و تمرکز داخل مودال
  useEffect(() => {
    const dialog = modalRef.current;
    const previousFocusedElement = document.activeElement;

    const focusableSelector = [
      'button:not(:disabled)',
      'a[href]',
      'input:not(:disabled):not([tabindex="-1"])',
      'select:not(:disabled)',
      'textarea:not(:disabled)',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    // انتقال تمرکز به دکمه بستن
    closeButtonRef.current?.focus();

    function handleDialogKeyDown(event) {
      // بستن مودال با Escape
      if (event.key === 'Escape') {
        if (!busyRef.current) {
          closeHandlerRef.current?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll(focusableSelector)
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];

      // جلوگیری از خروج تمرکز با Shift + Tab
      if (
        event.shiftKey &&
        document.activeElement === firstElement
      ) {
        event.preventDefault();
        lastElement.focus();
      }

      // جلوگیری از خروج تمرکز با Tab
      else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown);

    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);

      // بازگرداندن تمرکز به عنصر قبلی
      if (
        previousFocusedElement instanceof HTMLElement &&
        previousFocusedElement.isConnected
      ) {
        previousFocusedElement.focus();
      }
    };
  }, []);

  // خواندن فایل انتخاب‌شده و آماده‌سازی پیش‌نمایش
  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    // امکان انتخاب دوباره همان فایل
    event.target.value = '';

    if (!file) {
      return;
    }

    // پاک‌کردن نتیجه فایل قبلی
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setValidationResult(null);
    setReadError('');
    setImportError('');
    setImportReport(null);
    setCurrentStep('upload');

    // در این نسخه فقط فایل XLSX پذیرفته می‌شود
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setReadError(
        'فرمت فایل معتبر نیست. لطفاً فایل را با فرمت XLSX انتخاب کن.'
      );
      return;
    }

    // جلوگیری از خواندن فایل‌های بسیار بزرگ
    if (file.size > 10 * 1024 * 1024) {
      setReadError(
        'حجم فایل نمی‌تواند بیشتر از ۱۰ مگابایت باشد.'
      );
      return;
    }

    setIsReading(true);

    try {
      // خواندن برگه اول فایل Excel
      const sheetRows = await readSheet(file);

      if (
        !Array.isArray(sheetRows) ||
        sheetRows.length === 0
      ) {
        throw new Error(
          'فایل Excel خالی است یا اطلاعات قابل خواندن ندارد.'
        );
      }

      // ردیف اول باید شامل عنوان ستون‌ها باشد
      const headerRow = Array.isArray(sheetRows[0])
        ? sheetRows[0]
        : [];

      // پیدا کردن شماره هر ستون بر اساس نام آن
      const columnIndexes = {};

      const missingColumns = [];

      EXCEL_COLUMNS.forEach((column) => {
        const aliases = column.aliases.map(normalizeHeader);

        const matchedIndexes = headerRow
          .map((cell, index) => ({
            index,
            header: normalizeHeader(cell),
          }))
          .filter((item) =>
            aliases.includes(item.header)
          )
          .map((item) => item.index);

        // جلوگیری از وجود دو ستون با یک مفهوم
        if (matchedIndexes.length > 1) {
          throw new Error(
            `ستون «${column.label}» بیش از یک بار در فایل تعریف شده است.`
          );
        }

        columnIndexes[column.key] =
          matchedIndexes.length > 0
            ? matchedIndexes[0]
            : -1;

        // بررسی ستون‌های الزامی
        if (
          column.required &&
          matchedIndexes.length === 0
        ) {
          missingColumns.push(column.label);
        }
      });

      if (missingColumns.length > 0) {
        throw new Error(
          `ستون‌های الزامی پیدا نشدند: ${missingColumns.join('، ')}`
        );
      }

      // تبدیل ردیف‌های Excel به ساختار قابل نمایش
      const dataRows = sheetRows
        .slice(1)
        .map((row, index) => {
          const cells = Array.isArray(row) ? row : [];

          // حذف ردیف‌هایی که کاملاً خالی هستند
          const hasData = cells.some(
            (cell) => getCellText(cell) !== ''
          );

          if (!hasData) {
            return null;
          }

          // استخراج مقدار هر ستون
          const getValue = (key) => {
            const columnIndex = columnIndexes[key];

            if (columnIndex < 0) {
              return '';
            }

            return getCellText(cells[columnIndex]);
          };

          return {
            excelRow: index + 2,

            name: getValue('name'),
            category: getValue('category'),
            baseUnit: getValue('baseUnit'),

            subUnit: getValue('subUnit'),
            numerator: getValue('numerator'),
            denominator: getValue('denominator'),
          };
        })
        .filter(Boolean);

      if (dataRows.length === 0) {
        throw new Error(
          'هیچ ردیف اطلاعاتی پس از عنوان ستون‌ها پیدا نشد.'
        );
      }

      // بررسی در دسترس بودن اطلاعات موردنیاز برای اعتبارسنجی
      if (
        !Array.isArray(categories) ||
        !Array.isArray(units) ||
        !Array.isArray(products)
      ) {
        throw new Error(
          'اطلاعات محصولات، دسته‌بندی‌ها یا واحدها در دسترس نیست.'
        );
      }

      // اعتبارسنجی تمام ردیف‌ها و گروه‌بندی محصولات
      const result = validateExcelProductRows({
        rows: dataRows,
        categories,
        units,
        products,
      });

      // نگهداری نتیجه کامل اعتبارسنجی
      setValidationResult(result);

      // پس از موفقیت اعتبارسنجی، نمایش صفحه بررسی همه موارد
      setCurrentStep('validation');

    } catch (error) {
      setReadError(
        error.message ||
        'خواندن فایل Excel ناموفق بود.'
      );

    } finally {
      setIsReading(false);
    }
  }

  // ثبت محصولات معتبر در پایگاه داده
  async function handleImport() {

    // بررسی وجود نتیجه اعتبارسنجی و جلوگیری از ثبت چندباره
    if (
      !validationResult ||
      validationResult.validProductCount === 0 ||
      isImporting ||
      importReport
    ) {
      return;
    }


    // دریافت فقط محصولات معتبر
    const validProducts = validationResult.validProducts;

    // نگهداری محصولات ثبت‌شده برای اطلاع‌رسانی به صفحه اصلی
    let productsToNotify = null;

    // پاک‌کردن خطای قبلی
    setImportError('');

    setIsImporting(true);


    try {

      // دریافت API ثبت گروهی محصولات از Preload
      const createBulk =
        window.hesabyar?.products?.createBulk;


      if (typeof createBulk !== 'function') {
        throw new Error(
          'سرویس ثبت گروهی محصولات در دسترس نیست.'
        );
      }


      // ارسال محصولات معتبر به Main Process
      const createdProducts = await createBulk(validProducts);


      // بررسی پاسخ سرویس
      if (!Array.isArray(createdProducts)) {
        throw new Error(
          'پاسخ سرویس ثبت گروهی محصولات معتبر نیست.'
        );
      }

      // شناسایی ردیف‌هایی که به دلیل نداشتن نام محصول گروه نشده‌اند
      const groupedRows = new Set(
        validationResult.groups.flatMap(
          (group) => group.rowNumbers
        )
      );


      const unidentifiedRowCount = validationResult.rows.filter(
        (row) => !groupedRows.has(row.excelRow)
      ).length;


      // ثبت گزارش عملیات موفق
      const report = {

        createdCount: createdProducts.length,

        skippedCount: validationResult.invalidProductCount,

        unidentifiedRowCount,

        totalCount: validationResult.totalProducts,

        products: createdProducts,

      };


      setImportReport(report);


      // انتقال به صفحه گزارش نهایی
      setCurrentStep('completed');


      // آماده‌سازی اطلاع‌رسانی پس از موفقیت کامل عملیات
      productsToNotify = createdProducts;


    } catch (error) {

      // نمایش خطای احتمالی
      setImportError(
        error.message ||
        'ثبت گروهی محصولات ناموفق بود.'
      );

    } finally {

      // پایان وضعیت ثبت
      setIsImporting(false);

    }


    // اطلاع‌رسانی فقط در صورت موفقیت عملیات
    if (productsToNotify !== null) {
      onImported(productsToNotify);
    }

  }

  // فقط کالاهایی که تمام اعتبارسنجی‌های آن‌ها موفق بوده است
  const approvedGroups =
    validationResult?.groups.filter(
      (group) => group.status === 'valid'
    ) ?? [];


  // شناسایی شماره ردیف‌هایی که به یک محصول گروه‌بندی شده‌اند
  const groupedExcelRows = new Set(
    (validationResult?.groups ?? []).flatMap(
      (group) => group.rowNumbers
    )
  );

  // ردیف‌هایی که به دلیل نداشتن نام محصول گروه تشکیل نداده‌اند
  const ungroupedRows = (validationResult?.rows ?? []).filter(
    (row) => !groupedExcelRows.has(row.excelRow)
  );

  // آماده‌سازی یک ردیف نمایشی برای هر محصول
  const reviewItems = [
    ...(validationResult?.groups ?? []).map((group) => {
      // نمایش واحدهای فرعی بدون تکرار
      const subUnits = [
        ...new Set(
          group.rows
            .filter((row) => row.subUnit)
            .map((row) =>
              `${row.subUnit}${row.numerator && row.denominator
                ? ` (${row.numerator}/${row.denominator})`
                : ''
              }`
            )
        ),
      ];

      return {
        key: group.key,
        name: group.name,
        category: group.categoryName,
        baseUnit: group.baseUnitName,
        subUnits: subUnits.join('، ') || 'ندارد',
        rowNumbers: group.rowNumbers,
        status: group.status,
        errors: group.errors,
      };
    }),

    // افزودن ردیف‌هایی که نام محصول ندارند
    ...ungroupedRows.map((row) => ({
      key: `invalid-row-${row.excelRow}`,
      name: row.name || 'نام محصول مشخص نیست',
      category: row.category || '—',
      baseUnit: row.baseUnit || '—',

      subUnits: row.subUnit
        ? `${row.subUnit}${row.numerator && row.denominator
          ? ` (${row.numerator}/${row.denominator})`
          : ''
        }`
        : 'ندارد',

      rowNumbers: [row.excelRow],
      status: 'invalid',
      errors: row.errors,
    })),
  ];
  return (
    <div
      className="excel-import-backdrop"
      onClick={(event) => {
        // بستن پنجره با کلیک روی پس‌زمینه
        if (
          event.target === event.currentTarget &&
          !isReading && !isImporting
        ) {
          onClose();
        }
      }}
    >
      <section
        ref={modalRef}
        className="excel-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-import-title"
        tabIndex={-1}
      >

        {/* سربرگ پنجره */}
        <header className="excel-import-header">
          <div>
            <h2 id="excel-import-title">
              ورود محصولات از Excel
            </h2>

            <p>
              {importReport
                ? `گزارش نهایی فایل «${fileName}»`
                : 'فایل محصولات را انتخاب کن تا اطلاعات آن خوانده و پیش‌نمایش داده شود.'}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="excel-import-close"
            onClick={onClose}
            disabled={isReading || isImporting}
            aria-label="بستن پنجره"
          >
            ×
          </button>
        </header>

        {/* ورودی فایل در تمام مراحل مودال در دسترس می‌ماند */}
        <input
          ref={fileInputRef}
          className="excel-import-file-input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileChange}
          disabled={isReading || isImporting}
          tabIndex={-1}
          aria-label="انتخاب فایل Excel"
        />

        <div className="excel-import-body">

          {/* صفحه انتخاب فایل */}
          {currentStep === 'upload' && (
            <>

              <section className="excel-import-guide">
                <h3>ساختار فایل Excel</h3>

                <p>
                  ردیف اول فایل باید عنوان ستون‌ها را داشته باشد.
                  ستون‌های نام محصول، دسته‌بندی و واحد پایه الزامی هستند.
                </p>

                <div className="excel-import-columns">
                  {EXCEL_COLUMNS.map((column) => (
                    <span key={column.key}>
                      {column.label}
                      {column.required && ' *'}
                    </span>
                  ))}
                </div>

                <ul>
                  <li>برای هر محصول چند واحد فرعی، اطلاعات اصلی را در ردیف‌های جداگانه تکرار کن.</li>
                  <li>برای واحد استاندارد، صورت و مخرج تبدیل را خالی بگذار.</li>
                  <li>برای واحد بسته‌بندی، صورت و مخرج تبدیل را مشخص کن.</li>
                  <li>قیمت خرید و فروش در این فایل وارد نمی‌شود.</li>
                  <li>
                    اطلاعات فقط از برگه اول فایل Excel خوانده می‌شود.
                  </li>
                </ul>
              </section>


              <section className="excel-import-file-section">

                <button
                  type="button"
                  className="excel-import-file-button"
                  onClick={openFilePicker}
                  disabled={isReading || isImporting}
                >
                  {isReading
                    ? 'در حال خواندن فایل...'
                    : 'انتخاب فایل Excel'}
                </button>

                {fileName && (
                  <div className="excel-import-file-info">
                    <strong>{fileName}</strong>
                    <small>{fileSize}</small>
                  </div>
                )}

              </section>


              {isReading && (
                <div
                  className="excel-import-reading"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  در حال خواندن و بررسی اطلاعات فایل Excel...
                </div>
              )}


              {readError && (
                <div className="excel-import-error" role="alert">
                  <strong>خواندن فایل ناموفق بود.</strong>
                  <p>{readError}</p>
                </div>
              )}

            </>
          )}


          {/* صفحه اول: بررسی همه محصولات */}
          {currentStep === 'validation' && validationResult && (
            <section className="excel-import-review-page">

              <header className="excel-import-page-heading">
                <div>
                  <h3>نتیجه بررسی فایل Excel</h3>

                  <p>
                    وضعیت اعتبار هر محصول و دلیل موارد ردشده را بررسی کن.
                  </p>
                </div>

                <span className="excel-import-preview-count">
                  {reviewItems.length.toLocaleString('fa-IR')}
                  {' '}
                  مورد
                </span>
              </header>


              {/* خلاصه اعتبارسنجی */}
              <div className="excel-import-summary">

                <div className="excel-import-summary-card">
                  <span>کل محصولات شناسایی‌شده</span>
                  <strong>
                    {validationResult.totalProducts.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card valid">
                  <span>موارد مورد تأیید</span>
                  <strong>
                    {validationResult.validProductCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card invalid">
                  <span>موارد ردشده</span>
                  <strong>
                    {validationResult.invalidProductCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card">
                  <span>ردیف‌های فاقد نام محصول</span>
                  <strong>
                    {ungroupedRows.length.toLocaleString('fa-Af')}
                  </strong>
                </div>

              </div>


              {/* تنها جدول صفحه اول */}
              <div className="excel-import-table-wrapper excel-import-review-table-wrapper">

                <table className="excel-import-table excel-import-review-table">

                  <thead>
                    <tr>
                      <th>نام محصول</th>
                      <th>دسته‌بندی</th>
                      <th>واحد پایه</th>
                      <th>واحدهای فرعی</th>
                      <th>ردیف فایل</th>
                      <th>نتیجه بررسی</th>
                      <th>دلیل رد یا تأیید</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reviewItems.map((item) => (
                      <tr key={item.key}>

                        <td>{item.name}</td>

                        <td>{item.category || '—'}</td>

                        <td>{item.baseUnit || '—'}</td>

                        <td>{item.subUnits}</td>

                        <td>
                          {item.rowNumbers
                            .map((number) =>
                              number.toLocaleString('fa-IR')
                            )
                            .join('، ')}
                        </td>

                        <td>
                          <span
                            className={
                              item.status === 'valid'
                                ? 'excel-import-status-valid'
                                : 'excel-import-status-invalid'
                            }
                          >
                            {item.status === 'valid'
                              ? 'مورد تأیید'
                              : 'رد شده'}
                          </span>
                        </td>

                        <td>
                          {item.errors.length > 0 ? (
                            <ul className="excel-import-error-list">
                              {item.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="excel-import-no-error">
                              تمام شرایط اعتبارسنجی برقرار است.
                            </span>
                          )}
                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>

              {reviewItems.length === 0 && (
                <div className="excel-import-no-groups">
                  هیچ محصولی در فایل شناسایی نشد.
                </div>
              )}

            </section>
          )}


          {/* صفحه دوم: فقط کالاهای تأییدشده */}
          {currentStep === 'approved' && (
            <section className="excel-import-review-page">

              <header className="excel-import-page-heading">
                <div>
                  <h3>کالاهای مورد تأیید</h3>

                  <p>
                    این محصولات شرایط لازم برای ثبت در حساب‌یار را دارند.
                  </p>
                </div>

                <span className="excel-import-preview-count">
                  {approvedGroups.length.toLocaleString('fa-IR')}
                  {' '}
                  محصول
                </span>
              </header>


              {importError && (
                <div className="excel-import-error" role="alert">
                  <strong>ثبت محصولات ناموفق بود.</strong>
                  <p>{importError}</p>
                </div>
              )}


              {approvedGroups.length > 0 ? (
                <div className="excel-import-table-wrapper excel-import-approved-table-wrapper">

                  <table className="excel-import-table excel-import-approved-table">

                    <thead>
                      <tr>
                        <th>کد (پس از ثبت)</th>
                        <th>نام محصول</th>
                        <th>دسته‌بندی</th>
                        <th>واحد پایه</th>
                        <th>واحدهای فرعی</th>
                        <th>ردیف‌های فایل</th>
                        <th>وضعیت</th>
                      </tr>
                    </thead>

                    <tbody>
                      {approvedGroups.map((group) => {

                        // آماده‌سازی نام و نسبت واحدهای فرعی
                        const unitNames = group.unitOptions.map((option) => {
                          const unit = units.find(
                            (item) => item.id === option.unitId
                          );

                          const ratio =
                            option.conversionNum &&
                              option.conversionDen
                              ? ` (${option.conversionNum}/${option.conversionDen})`
                              : '';

                          return `${unit?.name || option.unitId}${ratio}`;
                        });

                        return (
                          <tr key={group.key}>

                            <td>پس از ثبت تولید می‌شود</td>

                            <td>{group.name}</td>

                            <td>{group.categoryName}</td>

                            <td>{group.baseUnitName}</td>

                            <td>{unitNames.join('، ') || 'ندارد'}</td>

                            <td>
                              {group.rowNumbers
                                .map((number) =>
                                  number.toLocaleString('fa-IR')
                                )
                                .join('، ')}
                            </td>

                            <td>
                              <span className="excel-import-status-valid">
                                مورد تأیید
                              </span>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>

                  </table>

                </div>
              ) : (
                <div className="excel-import-no-groups">
                  هیچ محصول تأییدشده‌ای برای ثبت وجود ندارد.
                </div>
              )}

            </section>
          )}


          {/* صفحه نهایی: نتیجه ثبت */}
          {currentStep === 'completed' && importReport && (
            <section className="excel-import-review-page">

              <header className="excel-import-page-heading">
                <div>
                  <h3>گزارش نهایی ورود محصولات</h3>

                  <p>عملیات ثبت گروهی با موفقیت به پایان رسید.</p>
                </div>

                <span className="excel-import-status-valid">
                  ثبت موفق
                </span>
              </header>


              <div className="excel-import-summary">

                <div className="excel-import-summary-card valid">
                  <span>محصولات ثبت‌شده</span>
                  <strong>
                    {importReport.createdCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card invalid">
                  <span>محصولات ردشده</span>
                  <strong>
                    {importReport.skippedCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card">
                  <span>کل محصولات</span>
                  <strong>
                    {importReport.totalCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

                <div className="excel-import-summary-card">
                  <span>ردیف‌های فاقد نام محصول</span>
                  <strong>
                    {importReport.unidentifiedRowCount.toLocaleString('fa-IR')}
                  </strong>
                </div>

              </div>


              <div className="excel-import-table-wrapper">
                <table className="excel-import-table">

                  <thead>
                    <tr>
                      <th>کد محصول</th>
                      <th>نام محصول</th>
                      <th>دسته‌بندی</th>
                      <th>واحد پایه</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>

                  <tbody>
                    {importReport.products.map((product) => (
                      <tr key={product.id}>
                        <td>{product.code}</td>
                        <td>{product.name}</td>
                        <td>{product.categoryName || '—'}</td>
                        <td>{product.baseUnitName || '—'}</td>
                        <td>
                          <span className="excel-import-status-valid">
                            ثبت‌شده
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>

            </section>
          )}

        </div>

        <footer className="excel-import-footer">

          <p>
            {currentStep === 'upload'
              ? 'فایل XLSX را انتخاب کن.'
              : currentStep === 'validation'
                ? `${approvedGroups.length.toLocaleString('fa-IR')} محصول مورد تأیید است.`
                : currentStep === 'approved'
                  ? 'موارد تأییدشده را بررسی و سپس ثبت نهایی کن.'
                  : 'گزارش نهایی ثبت محصولات آماده است.'}
          </p>


          <div className="excel-import-footer-actions">

            {/* صفحه اول */}
            {currentStep === 'validation' && (
              <>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isReading || isImporting}
                >
                  انتخاب فایل دیگر
                </button>

                <button
                  type="button"
                  className="excel-import-submit-button"
                  disabled={approvedGroups.length === 0}
                  onClick={() => {
                    setImportError('');
                    setCurrentStep('approved');
                  }}
                >
                  نمایش موارد مورد تأیید
                </button>
              </>
            )}


            {/* صفحه دوم */}
            {currentStep === 'approved' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setImportError('');
                    setCurrentStep('validation');
                  }}
                  disabled={isImporting}
                >
                  بازگشت به بررسی همه موارد
                </button>

                <button
                  type="button"
                  className="excel-import-submit-button"
                  disabled={
                    isImporting ||
                    approvedGroups.length === 0
                  }
                  onClick={handleImport}
                >
                  {isImporting
                    ? 'در حال ثبت محصولات...'
                    : `تأیید و ثبت ${approvedGroups.length.toLocaleString('fa-IR')} محصول`}
                </button>
              </>
            )}


            {/* دکمه پایان پس از ثبت موفق */}
            {(currentStep === 'completed' || currentStep === 'upload') && (
              <button
                type="button"
                onClick={onClose}
                disabled={isReading || isImporting}
              >
                {currentStep === 'completed' ? 'پایان' : 'بستن'}
              </button>
            )}

          </div>

        </footer>

      </section>
    </div>
  );
}

export default ExcelImportModal;