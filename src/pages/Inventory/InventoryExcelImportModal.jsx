import { useRef, useState } from 'react';

import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import ModalShell from '../../components/ui/ModalShell';
import StatusBadge from '../../components/ui/StatusBadge';

import {
  formatExcelFileSize,
  getExcelCellText,
  readExcelSheet,
  resolveExcelColumnIndexes,
} from '../../utils/excelImport';

import { formatNumber } from '../../utils/numberFormat';

import { validateInventoryExcelRows } from './inventory-excel-validation';

import './inventory-excel-import.css';


// ستون‌های مورد انتظار فایل ورود کالا
const INVENTORY_EXCEL_COLUMNS = [
  {
    key: 'productName',
    label: 'نام کالا',
    required: true,
    aliases: [
      'نام کالا',
      'نام محصول',
      'نام',
    ],
  },
  {
    key: 'quantity',
    label: 'مقدار',
    required: true,
    aliases: [
      'مقدار',
      'تعداد',
      'مقدار ورودی',
      'مقدار ورود',
    ],
  },
  {
    key: 'unitPrice',
    label: 'قیمت واحد',
    required: true,
    aliases: [
      'قیمت واحد',
      'قیمت خرید',
      'بهای واحد',
      'قیمت',
    ],
  },
  {
    key: 'unit',
    label: 'واحد',
    required: false,
    aliases: [
      'واحد',
      'واحد کالا',
      'واحد اندازه گیری',
      'واحد اندازه‌گیری',
    ],
  },
  {
    key: 'currency',
    label: 'ارز',
    required: false,
    aliases: [
      'ارز',
      'واحد پول',
      'کد ارز',
      'نام ارز',
    ],
  },
];


// قالب نمایش تعدادها
const INVENTORY_EXCEL_NUMBER_OPTIONS = {
  locale: 'fa-AF',
  maximumFractionDigits: 0,
};


// تبدیل اعداد برای نمایش
function displayNumber(value) {
  return formatNumber(
    value,
    INVENTORY_EXCEL_NUMBER_OPTIONS
  );
}


// نمایش یک ردیف جدول بررسی
function InventoryExcelTableRow({
  row,
  index,
  showErrors = true,
}) {
  return (
    <tr key={row.excelRow}>

      <td>
        {displayNumber(index + 1)}
      </td>

      <td>
        <strong>
          {row.product?.name || row.productName || 'نامشخص'}
        </strong>
      </td>

      <td>
        {row.identified ? (
          <StatusBadge variant="success">
            شناسایی شد
          </StatusBadge>
        ) : (
          <StatusBadge variant="danger">
            پیدا نشد
          </StatusBadge>
        )}
      </td>

      <td>
        {row.unit?.name || row.sourceUnitName || '—'}
      </td>

      <td>
        {row.quantity || '—'}
      </td>

      <td>
        {row.unitPrice || '—'}
      </td>

      <td>
        {row.currency?.code || row.sourceCurrencyName || '—'}
      </td>

      <td>
        {row.status === 'valid' ? (
          <StatusBadge variant="success">
            مورد تأیید
          </StatusBadge>
        ) : (
          <StatusBadge variant="danger">
            رد شده
          </StatusBadge>
        )}
      </td>

      <td>
        {showErrors && row.errors.length > 0 ? (
          <ul className="inventory-excel-import__errors">
            {row.errors.map((error, errorIndex) => (
              <li key={errorIndex}>
                {error}
              </li>
            ))}
          </ul>
        ) : (
          <span className="inventory-excel-import__no-error">
            {row.status === 'valid'
              ? 'تمام بررسی‌ها موفق بود.'
              : '—'}
          </span>
        )}
      </td>

    </tr>
  );
}


function InventoryExcelImportModal({
  onClose,

  products,

  currencies,

  baseCurrencyCode,

  documentInput,

  existingItems = [],

  onDraftSaved,

  onDocumentPosted,
}) {

  // ورودی مخفی انتخاب فایل
  const fileInputRef = useRef(null);


  // اطلاعات فایل انتخاب‌شده
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');


  // نتیجه بررسی فایل
  const [validationResult, setValidationResult] = useState(null);


  // مرحله جاری ورود اطلاعات
  // upload: انتخاب فایل
  // validation: نمایش تمام ردیف‌ها
  // approved: نمایش فقط ردیف‌های تأییدشده
  const [currentStep, setCurrentStep] = useState('upload');


  // وضعیت خواندن فایل
  const [isReading, setIsReading] = useState(false);


  // وضعیت ذخیره پیش‌نویس
  const [isSaving, setIsSaving] = useState(false);


  // وضعیت ثبت نهایی
  const [isPosting, setIsPosting] = useState(false);


  // نمایش پنجره تأیید تصمیم کاربر
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);


  // پیام خطای خواندن فایل
  const [readError, setReadError] = useState('');


  // پیام خطای ذخیره یا ثبت نهایی
  const [operationError, setOperationError] = useState('');


  const isBusy =
    isReading ||
    isSaving ||
    isPosting;


  // فقط ردیف‌هایی که اعتبارسنجی کامل آن‌ها موفق بوده است.
  const approvedRows =
    validationResult?.validRows || [];


  // تعداد کالاهای تأییدشده فایل
  const approvedCount = approvedRows.length;


  // تبدیل اقلام دستی موجود به ساختار استاندارد سند
  const existingDocumentItems = existingItems.map((item) => ({
    productId: item.productId,
    productUnitId: item.productUnitId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    currencyCode: item.currencyCode,
  }));


  // تبدیل کالاهای تأییدشده Excel به اقلام استاندارد سند
  const approvedDocumentItems = approvedRows.map(
    (row) => row.item
  );


  // اقلام نهایی سند شامل ردیف‌های دستی و ردیف‌های Excel است.
  const mergedItems = [
    ...existingDocumentItems,
    ...approvedDocumentItems,
  ];


  // محدودیت مشترک تعداد ردیف‌های سند
  const exceedsDocumentLimit = mergedItems.length > 200;


  // بررسی امکان ذخیره یا ثبت نهایی
  const canSaveApprovedItems = Boolean(

    validationResult &&

    approvedCount > 0 &&

    !exceedsDocumentLimit &&

    documentInput?.documentDate &&

    (
      documentInput?.documentType !== 'other' ||
      Boolean(String(documentInput?.reason || '').trim())
    ) &&

    !isBusy

  );


  // بازکردن پنجره انتخاب فایل
  function openFilePicker() {
    if (isBusy) {
      return;
    }

    fileInputRef.current?.click();
  }


  // حذف نتیجه قبلی و انتخاب فایل جدید
  function handleChooseAnotherFile() {
    if (isBusy) {
      return;
    }

    // حذف کامل پیش‌نمایش قبلی
    setFileName('');
    setFileSize('');
    setValidationResult(null);

    setReadError('');
    setOperationError('');

    setCurrentStep('upload');

    // امکان انتخاب مجدد همان فایل
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }


  // خواندن و بررسی فایل Excel
  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    // برای امکان انتخاب دوباره همان فایل
    event.target.value = '';

    if (!file) {
      return;
    }


    // حذف کامل نتیجه فایل قبلی
    setFileName(file.name);
    setFileSize(formatExcelFileSize(file.size));

    setValidationResult(null);

    setReadError('');
    setOperationError('');

    setCurrentStep('upload');


    setIsReading(true);


    try {

      // خواندن برگه اول فایل با تابع عمومی پروژه
      const sheetRows = await readExcelSheet(file);


      // ردیف اول باید عنوان ستون‌ها باشد.
      const headerRow = Array.isArray(sheetRows[0])
        ? sheetRows[0]
        : [];


      // پیدا کردن جایگاه ستون‌ها
      const columnIndexes = resolveExcelColumnIndexes(
        headerRow,
        INVENTORY_EXCEL_COLUMNS
      );


      // تبدیل ردیف‌های Excel به ساختار قابل اعتبارسنجی
      const dataRows = sheetRows
        .slice(1)
        .map((sourceRow, index) => {

          const cells = Array.isArray(sourceRow)
            ? sourceRow
            : [];


          // نادیده گرفتن ردیف کاملاً خالی
          const hasData = cells.some(
            (cell) => getExcelCellText(cell) !== ''
          );


          if (!hasData) {
            return null;
          }


          // دریافت مقدار ستون بر اساس کلید
          function getValue(key) {
            const columnIndex = columnIndexes[key];

            if (columnIndex < 0) {
              return '';
            }

            return getExcelCellText(
              cells[columnIndex]
            );
          }


          return {
            excelRow: index + 2,

            productName: getValue('productName'),

            quantity: getValue('quantity'),

            unitPrice: getValue('unitPrice'),

            unit: getValue('unit'),

            currency: getValue('currency'),
          };

        })
        .filter(Boolean);


      if (dataRows.length === 0) {
        throw new Error(
          'هیچ ردیف اطلاعاتی پس از عنوان ستون‌ها پیدا نشد.'
        );
      }


      // هر سند حداکثر ۲۰۰ ردیف دارد.
      if (dataRows.length > 200) {
        throw new Error(
          'فایل انتخاب‌شده بیش از ۲۰۰ ردیف کالا دارد. لطفاً فایل را به چند بخش تقسیم کن.'
        );
      }


      // بررسی در دسترس بودن فهرست‌های مرجع
      if (
        !Array.isArray(products) ||
        !Array.isArray(currencies)
      ) {
        throw new Error(
          'فهرست کالاها یا ارزهای فعال برای اعتبارسنجی در دسترس نیست.'
        );
      }


      // اعتبارسنجی نام کالا، واحد، مقدار، قیمت و ارز
      const result = validateInventoryExcelRows({

        rows: dataRows,

        products,

        currencies,

        baseCurrencyCode,

      });


      setValidationResult(result);

      setCurrentStep('validation');


    } catch (error) {

      setValidationResult(null);

      setCurrentStep('upload');

      setReadError(
        error.message ||
        'خواندن یا بررسی فایل Excel ناموفق بود.'
      );

    } finally {

      setIsReading(false);

    }

  }


  // ساخت ورودی سند با تمام اقلام معتبر
  function buildDocumentInput() {
    return {
      ...documentInput,

      // اقلام دستی و اقلام تأییدشده Excel
      items: mergedItems,
    };
  }


  // ذخیره پیش‌نویس و در صورت درخواست، ثبت نهایی آن
  async function saveApprovedItems(postAfterSave = false) {

    if (!canSaveApprovedItems) {
      return;
    }


    setOperationError('');

    setIsSaving(true);


    let draftResult;


    try {

      // دریافت API ذخیره پیش‌نویس
      const createEntryDraft =
        window.hesabyar?.inventory?.createEntryDraft;


      if (typeof createEntryDraft !== 'function') {
        throw new Error(
          'سرویس ذخیره پیش‌نویس سند در دسترس نیست.'
        );
      }


      // ذخیره همه اقلام در همان سرویس استاندارد سند ورود کالا
      draftResult = await createEntryDraft(
        buildDocumentInput()
      );


      // بررسی نتیجه ذخیره
      if (
        !draftResult?.id ||
        !draftResult?.documentNumber ||
        draftResult.status !== 'draft'
      ) {
        throw new Error(
          'پاسخ ذخیره پیش‌نویس معتبر نیست.'
        );
      }

    } catch (error) {

      setOperationError(
        error.message ||
        'ذخیره پیش‌نویس سند ناموفق بود.'
      );

      setIsSaving(false);

      return;

    }


    // اگر کاربر فقط پیش‌نویس خواسته باشد
    if (!postAfterSave) {

      setIsSaving(false);

      onDraftSaved?.(
        draftResult,
        mergedItems
      );

      return;

    }


    // از این مرحله به بعد، ثبت نهایی آغاز می‌شود.
    setIsPosting(true);


    try {

      const postDocument =
        window.hesabyar?.inventory?.postDocument;


      if (typeof postDocument !== 'function') {
        throw new Error(
          'سرویس ثبت نهایی سند در دسترس نیست.'
        );
      }


      // ابتدا پیش‌نویس ذخیره شده و اکنون شناسه آن نهایی می‌شود.
      const postedResult = await postDocument(
        draftResult.id
      );


      if (
        !postedResult?.id ||
        postedResult.status !== 'posted'
      ) {
        throw new Error(
          'پاسخ ثبت نهایی سند معتبر نیست.'
        );
      }


      setIsConfirmationOpen(false);

      onDocumentPosted?.(postedResult);


    } catch (postError) {

      // پیش‌نویس قبلاً با موفقیت ذخیره شده است.
      // شکست ثبت نهایی نباید باعث از بین رفتن پیش‌نویس شود.
      setIsConfirmationOpen(false);

      onDraftSaved?.(
        draftResult,
        mergedItems,
        postError
      );

    } finally {

      setIsPosting(false);

      setIsSaving(false);

    }

  }


  // بازگشت از صفحه تأییدشده‌ها به بررسی همه موارد
  function handleReturnToAllItems() {

    if (isBusy) {
      return;
    }

    // اگر مورد تأییدشده‌ای وجود دارد، ابتدا تصمیم کاربر گرفته شود.
    if (approvedCount > 0) {
      setIsConfirmationOpen(true);
      return;
    }

    setCurrentStep('validation');

  }


  // تأیید ثبت نهایی
  function handleConfirmPosting() {
    void saveApprovedItems(true);
  }


  // عدم تأیید ثبت نهایی؛ فقط پیش‌نویس ذخیره شود.
  function handleConfirmDraftOnly() {
    void saveApprovedItems(false);
  }


  return (
    <>
      <ModalShell
        open
        size="extra-large"
        fixedHeight
        className="inventory-excel-import-modal"
        closeOnBackdrop={!isBusy}
        closeOnEscape={!isBusy}
        closeDisabled={isBusy}
        onClose={onClose}
        ariaLabelledBy="inventory-excel-import-title"
      >

        <ModalShell.Header
          title="ورود کالا از فایل Excel"
          titleId="inventory-excel-import-title"
          description="انتخاب فایل، بررسی اطلاعات و ذخیره سند ورود کالا"
          onClose={onClose}
          closeDisabled={isBusy}
        />


        <ModalShell.Body
          scrollable
          padded
          className="inventory-excel-import"
        >

          {/* ورودی فایل مخفی */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="inventory-excel-import__file-input"
            onChange={handleFileChange}
            disabled={isBusy}
            aria-label="انتخاب فایل Excel"
          />


          {/* قوانین و راهنمای فایل */}
          {currentStep === 'upload' && (

            <section className="inventory-excel-import__guide">

              <h3>قوانین و ساختار فایل Excel</h3>

              <p>
                اطلاعات کالاها را در یک فایل Excel قرار بده.
                ردیف اول فایل باید عنوان ستون‌ها باشد.
                اطلاعات فقط از برگه اول فایل خوانده می‌شود.
              </p>


              <div className="inventory-excel-import__columns">

                {INVENTORY_EXCEL_COLUMNS.map((column) => (

                  <div
                    key={column.key}
                    className="inventory-excel-import__column"
                  >

                    <strong>{column.label}</strong>

                    <span>
                      {column.required
                        ? 'الزامی'
                        : 'اختیاری'}
                    </span>

                  </div>

                ))}

              </div>


              <ul className="inventory-excel-import__rules">

                <li>
                  نام کالا باید با نام یکی از کالاهای فعال حساب‌یار
                  مطابقت داشته باشد.
                </li>

                <li>
                  واحد واردشده باید در واحدهای همان کالا تعریف شده باشد.
                  در صورت خالی بودن واحد، واحد پایه انتخاب می‌شود.
                </li>

                <li>
                  مقدار باید عدد مثبت و متناسب با دقت اعشاری واحد باشد.
                </li>

                <li>
                  قیمت واحد باید عدد مثبت باشد و حداکثر شش رقم اعشار داشته باشد.
                </li>

                <li>
                  در صورت خالی بودن ارز، ارز مبنای حساب‌یار استفاده می‌شود.
                </li>

                <li>
                  کالاهای ناموجود، واحدهای نامعتبر و ردیف‌های دارای
                  اطلاعات ناقص در گروه موارد ردشده قرار می‌گیرند.
                </li>

                <li>
                  فایل باید با فرمت XLSX و حداکثر حجم ۱۰ مگابایت باشد.
                </li>

                <li>
                  تعداد ردیف‌های هر سند حداکثر ۲۰۰ مورد است.
                </li>

              </ul>


              <Alert variant="info">
                نمونه عنوان ستون‌ها:
                <strong>
                  {' '}
                  نام کالا، مقدار، قیمت واحد، واحد، ارز
                </strong>
              </Alert>


              <div className="inventory-excel-import__file-picker">

                <Button
                  type="button"
                  variant="primary"
                  startIcon="⇧"
                  onClick={openFilePicker}
                  disabled={isBusy}
                >
                  {isReading
                    ? 'در حال خواندن فایل...'
                    : 'انتخاب فایل Excel'}
                </Button>


                {fileName && (

                  <div className="inventory-excel-import__file-info">

                    <strong>{fileName}</strong>

                    <span>{fileSize}</span>

                  </div>

                )}

              </div>


              {isReading && (

                <div
                  className="inventory-excel-import__loading"
                  role="status"
                >
                  در حال خواندن و بررسی اطلاعات فایل Excel...
                </div>

              )}


              {readError && (

                <Alert
                  variant="danger"
                  title="خواندن فایل ناموفق بود."
                >
                  {readError}
                </Alert>

              )}

            </section>

          )}


          {/* صفحه بررسی تمام ردیف‌های فایل */}
          {currentStep === 'validation' && validationResult && (

            <section className="inventory-excel-import__review">

              <header className="inventory-excel-import__page-heading">

                <div>

                  <h3>نتیجه بررسی فایل Excel</h3>

                  <p>
                    وضعیت شناسایی کالا، واحد، مقدار، قیمت و ارز
                    تمام ردیف‌ها را بررسی کن.
                  </p>

                </div>


                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  startIcon="⇧"
                  onClick={handleChooseAnotherFile}
                  disabled={isBusy}
                >
                  انتخاب فایل دیگر
                </Button>

              </header>


              {/* اطلاعات فایل فعلی */}
              <div className="inventory-excel-import__selected-file">

                <strong>{fileName}</strong>

                <span>{fileSize}</span>

              </div>


              {/* خلاصه نتایج اعتبارسنجی */}
              <div className="inventory-excel-import__summary">

                <article className="inventory-excel-import__summary-card">

                  <span>کل ردیف‌های فایل</span>

                  <strong>
                    {displayNumber(validationResult.totalCount)}
                  </strong>

                </article>


                <article className="inventory-excel-import__summary-card">

                  <span>کالاهای شناسایی‌شده</span>

                  <strong>
                    {displayNumber(validationResult.identifiedCount)}
                  </strong>

                </article>


                <article className="inventory-excel-import__summary-card is-valid">

                  <span>موارد تأییدشده</span>

                  <strong>
                    {displayNumber(validationResult.validCount)}
                  </strong>

                </article>


                <article className="inventory-excel-import__summary-card is-invalid">

                  <span>موارد ردشده</span>

                  <strong>
                    {displayNumber(validationResult.invalidCount)}
                  </strong>

                </article>

              </div>


              <div className="inventory-excel-import__table-heading">

                <div>

                  <h4>جدول کامل کالاهای فایل</h4>

                  <p>
                    شماره ردیف‌ها بر اساس موقعیت آن‌ها در فایل Excel است.
                  </p>

                </div>

                <span>
                  {displayNumber(validationResult.rows.length)} ردیف
                </span>

              </div>


              <div className="inventory-excel-import__table-wrapper">

                <table className="ui-data-table ui-data-table--wrap inventory-excel-import__table">

                  <thead>

                    <tr>
                      <th>ردیف</th>
                      <th>نام کالا</th>
                      <th>شناسایی کالا</th>
                      <th>واحد</th>
                      <th>مقدار</th>
                      <th>قیمت واحد</th>
                      <th>ارز</th>
                      <th>وضعیت</th>
                      <th>نتیجه بررسی</th>
                    </tr>

                  </thead>


                  <tbody>

                    {validationResult.rows.map((row, index) => (

                      <InventoryExcelTableRow
                        key={row.excelRow}
                        row={row}
                        index={index}
                      />

                    ))}

                  </tbody>

                </table>

              </div>


              {validationResult.validCount === 0 && (

                <Alert variant="warning">
                  هیچ ردیف تأییدشده‌ای وجود ندارد.
                  برای ذخیره سند باید ابتدا فایل یا اطلاعات آن اصلاح شود.
                </Alert>

              )}

            </section>

          )}


          {/* صفحه نمایش فقط کالاهای تأییدشده */}
          {currentStep === 'approved' && validationResult && (

            <section className="inventory-excel-import__review">

              <header className="inventory-excel-import__page-heading">

                <div>

                  <h3>کالاهای مورد تأیید</h3>

                  <p>
                    فقط کالاهایی در این جدول نمایش داده می‌شوند
                    که تمام بررسی‌ها را با موفقیت گذرانده‌اند.
                  </p>

                </div>


                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  startIcon="⇧"
                  onClick={handleChooseAnotherFile}
                  disabled={isBusy}
                >
                  انتخاب فایل دیگر
                </Button>

              </header>


              <div className="inventory-excel-import__selected-file">

                <strong>{fileName}</strong>

                <span>
                  {displayNumber(approvedCount)} مورد تأییدشده
                </span>

              </div>


              <div className="inventory-excel-import__summary">

                <article className="inventory-excel-import__summary-card is-valid">

                  <span>کالاهای تأییدشده از Excel</span>

                  <strong>
                    {displayNumber(approvedCount)}
                  </strong>

                </article>


                <article className="inventory-excel-import__summary-card">

                  <span>اقلام دستی موجود در فرم</span>

                  <strong>
                    {displayNumber(existingDocumentItems.length)}
                  </strong>

                </article>


                <article className="inventory-excel-import__summary-card">

                  <span>کل اقلام سند</span>

                  <strong>
                    {displayNumber(mergedItems.length)}
                  </strong>

                </article>


                <article className={`inventory-excel-import__summary-card ${exceedsDocumentLimit ? 'is-invalid' : ''}`}>

                  <span>حداکثر مجاز سند</span>

                  <strong>۲۰۰</strong>

                </article>

              </div>


              {exceedsDocumentLimit && (

                <Alert variant="danger">
                  تعداد اقلام موجود در فرم و فایل Excel در مجموع
                  از ۲۰۰ ردیف بیشتر است. فایل را اصلاح کن یا تعدادی
                  از کالاهای دستی را حذف کن.
                </Alert>

              )}


              <div className="inventory-excel-import__table-heading">

                <div>

                  <h4>جدول کالاهای تأییدشده</h4>

                  <p>
                    این ردیف‌ها برای ذخیره در سند آماده هستند.
                  </p>

                </div>

                <span>
                  {displayNumber(approvedCount)} ردیف
                </span>

              </div>


              {approvedRows.length > 0 ? (

                <div className="inventory-excel-import__table-wrapper">

                  <table className="ui-data-table ui-data-table--wrap inventory-excel-import__table">

                    <thead>

                      <tr>
                        <th>ردیف فایل</th>
                        <th>نام کالا</th>
                        <th>واحد</th>
                        <th>مقدار</th>
                        <th>قیمت واحد</th>
                        <th>ارز</th>
                        <th>وضعیت</th>
                      </tr>

                    </thead>


                    <tbody>

                      {approvedRows.map((row) => (

                        <tr key={row.excelRow}>

                          <td>
                            {displayNumber(row.excelRow)}
                          </td>

                          <td>
                            <strong>{row.product.name}</strong>
                          </td>

                          <td>
                            {row.unit.name}
                          </td>

                          <td>{row.item.quantity}</td>

                          <td>{row.item.unitPrice}</td>

                          <td>{row.currency.code}</td>

                          <td>
                            <StatusBadge variant="success">
                              تأییدشده
                            </StatusBadge>
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              ) : (

                <div className="inventory-excel-import__empty">
                  هیچ کالای تأییدشده‌ای برای نمایش وجود ندارد.
                </div>

              )}

            </section>

          )}


          {/* خطای ذخیره یا ثبت نهایی */}
          {operationError && (

            <Alert
              variant="danger"
              title="عملیات انجام نشد."
            >
              {operationError}
            </Alert>

          )}

        </ModalShell.Body>


        {/* پایین پنجره و دکمه‌های مرحله فعلی */}
        <ModalShell.Footer
          className="inventory-excel-import__footer"
        >

          <p className="inventory-excel-import__footer-note">

            {currentStep === 'upload'
              ? 'پس از انتخاب فایل، اطلاعات آن بررسی می‌شود.'
              : currentStep === 'validation'
                ? `${displayNumber(approvedCount)} ردیف برای استفاده در سند تأیید شده است.`
                : `${displayNumber(approvedCount)} ردیف تأییدشده آماده ذخیره است.`}

          </p>


          <div className="inventory-excel-import__footer-actions">

            {currentStep === 'upload' && (

              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isBusy}
              >
                بستن
              </Button>

            )}


            {currentStep === 'validation' && (

              <>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isBusy}
                >
                  انصراف
                </Button>


                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setOperationError('');
                    setCurrentStep('approved');
                  }}
                  disabled={
                    isBusy ||
                    approvedCount === 0 ||
                    exceedsDocumentLimit
                  }
                >
                  نمایش موارد تأییدشده
                </Button>

              </>

            )}


            {currentStep === 'approved' && (

              <>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReturnToAllItems}
                  disabled={isBusy}
                >
                  بازگشت به بررسی همه موارد
                </Button>


                <Button
                  type="button"
                  variant="primary"
                  loading={isSaving}
                  onClick={() => {
                    void saveApprovedItems(false);
                  }}
                  disabled={!canSaveApprovedItems}
                >
                  {isSaving
                    ? 'در حال ذخیره پیش‌نویس...'
                    : 'ذخیره پیش‌نویس'}
                </Button>

              </>

            )}

          </div>

        </ModalShell.Footer>

      </ModalShell>


      {/* پنجره تصمیم درباره ثبت نهایی یا نگهداری پیش‌نویس */}
      {isConfirmationOpen && (

        <ModalShell
          open
          size="small"
          priority
          closeOnBackdrop={!isBusy}
          closeOnEscape={!isBusy}
          closeDisabled={isBusy}
          onClose={() => setIsConfirmationOpen(false)}
          ariaLabelledBy="inventory-excel-confirm-title"
        >

          <ModalShell.Header
            title="تأیید ذخیره و ثبت سند"
            titleId="inventory-excel-confirm-title"
            onClose={() => setIsConfirmationOpen(false)}
            closeDisabled={isBusy}
          />


          <ModalShell.Body padded>

            <p>
              آیا ثبت نهایی این سند را تأیید می‌کنی؟
            </p>

            <p>
              با انتخاب «بله»، پیش‌نویس ابتدا ذخیره و سپس ثبت نهایی
              می‌شود. با انتخاب «خیر»، اطلاعات فقط به‌صورت پیش‌نویس
              ذخیره می‌شوند و می‌توانی در زمان دیگری درباره ثبت نهایی
              آن‌ها تصمیم بگیری.
            </p>

          </ModalShell.Body>


          <ModalShell.Footer>

            <Button
              type="button"
              variant="primary"
              loading={isPosting}
              disabled={isBusy || !canSaveApprovedItems}
              onClick={handleConfirmPosting}
            >
              بله، ثبت نهایی شود
            </Button>


            <Button
              type="button"
              variant="secondary"
              loading={isSaving && !isPosting}
              disabled={isBusy || !canSaveApprovedItems}
              onClick={handleConfirmDraftOnly}
            >
              خیر، فقط پیش‌نویس ذخیره شود
            </Button>


            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmationOpen(false)}
              disabled={isBusy}
            >
              انصراف
            </Button>

          </ModalShell.Footer>

        </ModalShell>

      )}

    </>
  );

}


export default InventoryExcelImportModal;