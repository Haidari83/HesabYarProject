import { useId, useState } from 'react';

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
  // شناسه یکتای ورودی فایل
  const inputId = useId();

  // نام فایل انتخاب‌شده
  const [fileName, setFileName] = useState('');

  // حجم فایل انتخاب‌شده
  const [fileSize, setFileSize] = useState('');

  // اطلاعات ردیف‌های خوانده‌شده
  const [previewRows, setPreviewRows] = useState([]);

  // تعداد کل ردیف‌های اطلاعاتی
  const [totalRows, setTotalRows] = useState(0);

  // نتیجه اعتبارسنجی محصولات و ردیف‌های Excel
  const [validationResult, setValidationResult] = useState(null);

  // وضعیت اجرای ثبت گروهی محصولات
  const [isImporting, setIsImporting] = useState(false);

  // خطای احتمالی ثبت محصولات در دیتابیس
  const [importError, setImportError] = useState('');

  // گزارش نهایی ثبت محصولات
  const [importReport, setImportReport] = useState(null);

  // وضعیت خواندن فایل
  const [isReading, setIsReading] = useState(false);

  // خطای احتمالی فایل یا ساختار آن
  const [readError, setReadError] = useState('');


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
    setPreviewRows([]);
    setTotalRows(0);
    setValidationResult(null);
    setReadError('');
    setImportError('');
    setImportReport(null);

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

      // نمایش پیش‌نمایش حداکثر ۵۰ ردیف نخست
      setPreviewRows(result.rows.slice(0, 50));

      // نگهداری تعداد کل ردیف‌ها
      setTotalRows(dataRows.length);

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

      // ثبت گزارش عملیات موفق
      const report = {
        createdCount: createdProducts.length,
        skippedCount: validationResult.invalidProductCount,
        totalCount: validationResult.totalProducts,
        products: createdProducts,
      };

      setImportReport(report);

      // اطلاع‌رسانی به صفحه اصلی درباره محصولات ثبت‌شده
      onImported(createdProducts);

    } catch (error) {
      // نمایش خطای احتمالی؛ تراکنش ناموفق در بک‌اند بازگردانده می‌شود
      setImportError(
        error.message ||
        'ثبت گروهی محصولات ناموفق بود.'
      );

    } finally {
      // پایان وضعیت ثبت
      setIsImporting(false);
    }
  }

  // ارتباط شماره ردیف‌های Excel با کد محصولات ثبت‌شده
  const importedProductCodeByRow = new Map();

  if (importReport && validationResult) {
    // استخراج گروه‌هایی که اعتبارسنجی آن‌ها موفق بوده است
    const validGroups = validationResult.groups.filter(
      (group) => group.status === 'valid'
    );

    // محصولات ثبت‌شده به همان ترتیب گروه‌های معتبر بازمی‌گردند
    validGroups.forEach((group, index) => {
      const createdProduct = importReport.products[index];

      if (!createdProduct?.code) {
        return;
      }

      // اختصاص کد محصول به تمام ردیف‌های متعلق به آن
      group.rowNumbers.forEach((rowNumber) => {
        importedProductCodeByRow.set(
          rowNumber,
          createdProduct.code
        );
      });
    });
  }

  return (
    <div
      className="excel-import-backdrop"
      onClick={(event) => {
        // بستن پنجره با کلیک روی پس‌زمینه
        if (
          event.target === event.currentTarget &&
          !isReading
        ) {
          onClose();
        }
      }}
    >
      <section
        className="excel-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-import-title"
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
            type="button"
            className="excel-import-close"
            onClick={onClose}
            disabled={isReading}
            aria-label="بستن پنجره"
          >
            ×
          </button>
        </header>


        {/* محتوای پنجره */}
        <div className="excel-import-body">

          {/* محتوای انتخاب و بررسی فایل فقط پیش از ثبت موفق نمایش داده می‌شود */}
          {!importReport && (
            <>
              {/* راهنمای ساختار فایل */}
              <section className="excel-import-guide">
                <h3>ساختار فایل Excel</h3>

                <p>
                  ردیف اول فایل باید عنوان ستون‌ها را داشته باشد.
                  نام ستون‌ها می‌تواند یکی از عنوان‌های زیر باشد:
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
                  <li>
                    ستون‌های نام محصول، دسته‌بندی و واحد پایه الزامی هستند.
                  </li>

                  <li>
                    برای ثبت چند واحد فرعی، اطلاعات اصلی محصول را
                    در ردیف‌های مربوط تکرار کن.
                  </li>

                  <li>
                    برای واحد استاندارد، صورت و مخرج تبدیل را خالی بگذار.
                  </li>

                  <li>
                    برای واحد بسته‌بندی، صورت و مخرج تبدیل را وارد کن.
                  </li>

                  <li>
                    قیمت خرید و فروش در این فایل وارد نمی‌شود.
                  </li>
                </ul>

                <p className="excel-import-sheet-note">
                  در این مرحله، اطلاعات فقط از برگه اول فایل خوانده می‌شود.
                </p>
              </section>


              {/* انتخاب فایل */}
              <section className="excel-import-file-section">
                <input
                  id={inputId}
                  className="excel-import-file-input"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  disabled={isReading}
                />

                <label
                  htmlFor={inputId}
                  className="excel-import-file-button"
                >
                  {isReading
                    ? 'در حال خواندن فایل...'
                    : 'انتخاب فایل Excel'}
                </label>

                {fileName && (
                  <div className="excel-import-file-info">
                    <strong>{fileName}</strong>

                    {fileSize && (
                      <small>{fileSize}</small>
                    )}
                  </div>
                )}
              </section>


              {/* وضعیت خواندن فایل */}
              {isReading && (
                <div className="excel-import-reading">
                  در حال خواندن اطلاعات فایل Excel...
                </div>
              )}


              {/* نمایش خطا */}
              {readError && (
                <div
                  className="excel-import-error"
                  role="alert"
                >
                  <strong>خواندن فایل ناموفق بود.</strong>
                  <p>{readError}</p>
                </div>
              )}


              {/* پیش‌نمایش اطلاعات */}
              {totalRows > 0 && (
                <section className="excel-import-preview">

                  <header className="excel-import-preview-header">
                    <div>
                      <h3>پیش‌نمایش اطلاعات</h3>

                      <p>
                        {totalRows.toLocaleString('fa-IR')}
                        {' '}
                        ردیف اطلاعاتی خوانده شد.
                      </p>
                    </div>

                    <span className="excel-import-preview-count">
                      {previewRows.length.toLocaleString('fa-IR')}
                      {' '}
                      ردیف
                    </span>
                  </header>

                  {/* خلاصه نتیجه اعتبارسنجی */}
                  {validationResult && (
                    <>
                      <div className="excel-import-summary">

                        <div className="excel-import-summary-card">
                          <span>کل محصولات شناسایی‌شده</span>

                          <strong>
                            {validationResult.totalProducts.toLocaleString('fa-IR')}
                          </strong>
                        </div>

                        <div className="excel-import-summary-card valid">
                          <span>محصولات معتبر</span>

                          <strong>
                            {validationResult.validProductCount.toLocaleString('fa-IR')}
                          </strong>
                        </div>

                        <div className="excel-import-summary-card invalid">
                          <span>محصولات نیازمند اصلاح</span>

                          <strong>
                            {validationResult.invalidProductCount.toLocaleString('fa-IR')}
                          </strong>
                        </div>

                        <div className="excel-import-summary-card">
                          <span>ردیف‌های دارای خطا</span>

                          <strong>
                            {validationResult.invalidRowCount.toLocaleString('fa-IR')}
                          </strong>
                        </div>

                      </div>


                      {/* نتیجه گروه‌بندی و اعتبارسنجی محصولات */}
                      <section className="excel-import-product-results">

                        <header>
                          <h3>نتیجه بررسی محصولات</h3>

                          <p>
                            ردیف‌های مربوط به یک محصول در یک گروه قرار گرفته‌اند.
                          </p>
                        </header>


                        {validationResult.groups.length === 0 ? (
                          <div className="excel-import-no-groups">
                            محصولی با نام معتبر برای بررسی پیدا نشد.
                            خطاهای ردیف‌ها را در جدول زیر بررسی کن.
                          </div>
                        ) : (
                          <div className="excel-import-table-wrapper">
                            <table className="excel-import-table">

                              <thead>
                                <tr>
                                  <th>نام محصول</th>
                                  <th>دسته‌بندی</th>
                                  <th>واحد پایه</th>
                                  <th>تعداد واحدهای فرعی</th>
                                  <th>ردیف‌های فایل</th>
                                  <th>وضعیت</th>
                                  <th>نتیجه بررسی</th>
                                </tr>
                              </thead>

                              <tbody>
                                {validationResult.groups.map((group) => (
                                  <tr key={group.key}>

                                    <td>{group.name}</td>

                                    <td>{group.categoryName || '—'}</td>

                                    <td>{group.baseUnitName || '—'}</td>

                                    <td>
                                      {group.unitOptions.length.toLocaleString('fa-IR')}
                                    </td>

                                    <td>
                                      {group.rowNumbers
                                        .map((number) =>
                                          number.toLocaleString('fa-IR')
                                        )
                                        .join('، ')}
                                    </td>

                                    <td>
                                      <span
                                        className={
                                          group.status === 'valid'
                                            ? 'excel-import-status-valid'
                                            : 'excel-import-status-invalid'
                                        }
                                      >
                                        {group.status === 'valid'
                                          ? 'معتبر'
                                          : 'نیازمند اصلاح'}
                                      </span>
                                    </td>

                                    <td>
                                      {group.errors.length > 0 ? (
                                        <ul className="excel-import-error-list">
                                          {group.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="excel-import-no-error">
                                          اطلاعات قابل قبول است.
                                        </span>
                                      )}
                                    </td>

                                  </tr>
                                ))}
                              </tbody>

                            </table>
                          </div>
                        )}

                      </section>
                    </>
                  )}


                  <div className="excel-import-table-wrapper">
                    <table className="excel-import-table">

                      <thead>
                        <tr>
                          <th>ردیف فایل</th>
                          <th>نام محصول</th>
                          <th>دسته‌بندی</th>
                          <th>واحد پایه</th>
                          <th>واحد فرعی</th>
                          <th>صورت تبدیل</th>
                          <th>مخرج تبدیل</th>
                          <th>وضعیت</th>
                          <th>خطاها</th>
                        </tr>
                      </thead>

                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.excelRow}>

                            <td>
                              {row.excelRow.toLocaleString('fa-IR')}
                            </td>

                            <td>{row.name || '—'}</td>

                            <td>{row.category || '—'}</td>

                            <td>{row.baseUnit || '—'}</td>

                            <td>{row.subUnit || '—'}</td>

                            <td>{row.numerator || '—'}</td>

                            <td>{row.denominator || '—'}</td>

                            <td>
                              <span
                                className={
                                  row.status === 'valid'
                                    ? 'excel-import-status-valid'
                                    : 'excel-import-status-invalid'
                                }
                              >
                                {row.status === 'valid'
                                  ? 'معتبر'
                                  : 'نیازمند اصلاح'}
                              </span>
                            </td>

                            <td>
                              {row.errors.length > 0
                                ? row.errors.join('؛ ')
                                : '—'}
                            </td>

                          </tr>
                        ))}
                      </tbody>

                    </table>
                  </div>


                  {totalRows > previewRows.length && (
                    <p className="excel-import-preview-note">
                      فقط ۵۰ ردیف نخست نمایش داده شده است؛
                      تعداد کل ردیف‌ها {totalRows.toLocaleString('fa-AF')} است.
                    </p>
                  )}

                </section>
              )}

            </>
          )}

          {/* خطای ثبت گروهی؛ فقط در صفحه قبل از ثبت نمایش داده می‌شود */}
          {!importReport && importError && (
            <div
              className="excel-import-error"
              role="alert"
            >
              <strong>ثبت محصولات ناموفق بود.</strong>

              <p>{importError}</p>

              <p>
                در صورت بروز خطا در تراکنش، هیچ‌یک از محصولات این
                درخواست ثبت نشده‌اند.
              </p>
            </div>
          )}

          {/* صفحه مستقل گزارش پس از ثبت موفق */}
          {importReport && (
            <section className="excel-import-final-view">

              {/* عنوان گزارش */}
              <div className="excel-import-report">
                <header>
                  <h3>گزارش نهایی ورود محصولات</h3>

                  <p>
                    عملیات ثبت گروهی به پایان رسید.
                  </p>
                </header>

                {/* اطلاعات فایل انتخاب‌شده */}
                <div className="excel-import-result-file">
                  <div>
                    <span>فایل انتخاب‌شده</span>
                    <strong>{fileName}</strong>
                  </div>

                  <div>
                    <span>حجم فایل</span>
                    <strong>{fileSize}</strong>
                  </div>

                  <div>
                    <span>تعداد ردیف‌های فایل</span>
                    <strong>
                      {validationResult.rows.length.toLocaleString('fa-IR')}
                    </strong>
                  </div>
                </div>

                {/* آمار نهایی */}
                <div className="excel-import-summary excel-import-summary-report">

                  <div className="excel-import-summary-card valid">
                    <span>محصولات ثبت‌شده</span>

                    <strong>
                      {importReport.createdCount.toLocaleString('fa-IR')}
                    </strong>
                  </div>

                  <div className="excel-import-summary-card invalid">
                    <span>محصولات ثبت‌نشده به علت خطای اعتبارسنجی</span>

                    <strong>
                      {importReport.skippedCount.toLocaleString('fa-IR')}
                    </strong>
                  </div>

                  <div className="excel-import-summary-card">
                    <span>کل محصولات شناسایی‌شده</span>

                    <strong>
                      {importReport.totalCount.toLocaleString('fa-IR')}
                    </strong>
                  </div>

                </div>
              </div>

              {/* تمام محتوای انتخاب‌شده از فایل Excel */}
              <section className="excel-import-selected-content">

                <header>
                  <div>
                    <h3>محتوای فایل انتخاب‌شده</h3>

                    <p>
                      تمام ردیف‌های فایل، همراه با نتیجه ثبت آن‌ها نمایش داده می‌شوند.
                    </p>
                  </div>

                  <span className="excel-import-preview-count">
                    {validationResult.rows.length.toLocaleString('fa-IR')}
                    {' '}
                    ردیف
                  </span>
                </header>

                <div className="excel-import-table-wrapper excel-import-final-table-wrapper">

                  <table className="excel-import-table excel-import-final-table">

                    <thead>
                      <tr>
                        <th>ردیف فایل</th>
                        <th>کد محصول</th>
                        <th>نام محصول</th>
                        <th>دسته‌بندی</th>
                        <th>واحد پایه</th>
                        <th>واحد فرعی</th>
                        <th>صورت تبدیل</th>
                        <th>مخرج تبدیل</th>
                        <th>وضعیت</th>
                        <th>خطاها</th>
                      </tr>
                    </thead>

                    <tbody>
                      {validationResult.rows.map((row) => {
                        // کد محصول ثبت‌شده برای این ردیف
                        const productCode =
                          importedProductCodeByRow.get(row.excelRow) || '';

                        // تعیین وضعیت نهایی
                        const statusLabel =
                          row.status !== 'valid'
                            ? 'نیازمند اصلاح'
                            : productCode
                              ? 'ثبت‌شده'
                              : 'ثبت‌نشده';

                        // تعیین ظاهر وضعیت
                        const statusClass =
                          row.status !== 'valid'
                            ? 'excel-import-status-invalid'
                            : productCode
                              ? 'excel-import-status-valid'
                              : 'excel-import-status-pending';

                        return (
                          <tr key={row.excelRow}>

                            <td>
                              {row.excelRow.toLocaleString('fa-IR')}
                            </td>

                            <td>{productCode || '—'}</td>

                            <td>{row.name || '—'}</td>

                            <td>{row.category || '—'}</td>

                            <td>{row.baseUnit || '—'}</td>

                            <td>{row.subUnit || '—'}</td>

                            <td>{row.numerator || '—'}</td>

                            <td>{row.denominator || '—'}</td>

                            <td>
                              <span className={statusClass}>
                                {statusLabel}
                              </span>
                            </td>

                            <td>
                              {row.errors.length > 0
                                ? row.errors.join('؛ ')
                                : '—'}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>

                  </table>

                </div>

              </section>

            </section>
          )}

        </div>

        {/* پایین پنجره */}
        <footer className="excel-import-footer">

          {/* راهنمای وضعیت ثبت */}
          <p>
            {importReport
              ? 'گزارش ثبت محصولات آماده است.'
              : validationResult
                ? validationResult.validProductCount > 0
                  ? `${validationResult.validProductCount.toLocaleString('fa-IR')} محصول معتبر آماده ثبت است.`
                  : 'محصول معتبری برای ثبت وجود ندارد.'
                : 'تا پیش از تأیید نهایی، هیچ محصولی در پایگاه داده ثبت نمی‌شود.'}
          </p>


          <div className="excel-import-footer-actions">

            {/* دکمه ثبت نهایی */}
            {!importReport && (
              <button
                type="button"
                className="excel-import-submit-button"
                disabled={
                  isReading ||
                  isImporting ||
                  !validationResult ||
                  validationResult.validProductCount === 0
                }
                onClick={handleImport}
              >
                {isImporting
                  ? 'در حال ثبت محصولات...'
                  : validationResult?.validProductCount > 0
                    ? `تأیید و ثبت ${validationResult.validProductCount.toLocaleString('fa-IR')} محصول`
                    : 'محصول معتبری برای ثبت وجود ندارد'}
              </button>
            )}


            {/* بستن پنجره */}
            <button
              type="button"
              onClick={onClose}
              disabled={isReading || isImporting}
            >
              {importReport ? 'پایان' : 'بستن'}
            </button>

          </div>

        </footer>

      </section>
    </div>
  );
}

export default ExcelImportModal;