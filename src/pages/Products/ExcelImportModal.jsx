import { useId, useState } from 'react';

import { readSheet } from 'read-excel-file/browser';

import './excel-import-modal.css';


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


function ExcelImportModal({ onClose }) {
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
    setReadError('');

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

      // نمایش پیش‌نمایش حداکثر ۵۰ ردیف
      setPreviewRows(dataRows.slice(0, 50));

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
              فایل محصولات را انتخاب کن تا اطلاعات آن خوانده و
              پیش‌نمایش داده شود.
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
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.excelRow}>
                        <td>{row.excelRow.toLocaleString('fa-IR')}</td>

                        <td>{row.name || '—'}</td>

                        <td>{row.category || '—'}</td>

                        <td>{row.baseUnit || '—'}</td>

                        <td>{row.subUnit || '—'}</td>

                        <td>{row.numerator || '—'}</td>

                        <td>{row.denominator || '—'}</td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>


              {totalRows > previewRows.length && (
                <p className="excel-import-preview-note">
                  فقط ۵۰ ردیف نخست نمایش داده شده است؛
                  تعداد کل ردیف‌ها {totalRows.toLocaleString('fa-IR')} است.
                </p>
              )}

            </section>
          )}

        </div>


        {/* پایین پنجره */}
        <footer className="excel-import-footer">
          <p>
            در این مرحله هیچ محصولی در پایگاه داده ثبت نمی‌شود.
          </p>

          <button
            type="button"
            onClick={onClose}
            disabled={isReading}
          >
            بستن
          </button>
        </footer>

      </section>
    </div>
  );
}

export default ExcelImportModal;