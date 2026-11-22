import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import './inventory-entry.css';

// کتابخانه انتخاب تاریخ
import DatePicker from 'react-multi-date-picker';
import DateObject from 'react-date-object';

// تقویم شمسی و میلادی
import persianCalendar from 'react-date-object/calendars/persian';
import gregorianCalendar from 'react-date-object/calendars/gregorian';

// زبان میلادی برای خروجی استاندارد پایگاه داده
import gregorianEnglish from 'react-date-object/locales/gregorian_en';

// زبان افغانستان برای نمایش تقویم شمسی
import persianAfghanistan from '../../locales/persianAfghanistan';


// دریافت تاریخ امروز بر اساس ساعت محلی سیستم
// دریافت تاریخ روز بر اساس ساعت رسمی افغانستان
// خروجی همچنان میلادی است تا با SQLite سازگار باشد.
function getLocalDate() {

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${values.year}-${values.month}-${values.day}`;

}

// تبدیل تاریخ میلادی ذخیره‌شده به تاریخ قابل نمایش شمسی
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


// تبدیل تاریخ انتخاب‌شده شمسی به تاریخ میلادی استاندارد
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
// قالب‌بندی اعداد با ارقام فارسی
function formatNumber(value, maximumFractionDigits = 2) {

  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return new Intl.NumberFormat('fa-AF', {
    maximumFractionDigits,
  }).format(number);

}


// قالب‌بندی مبلغ همراه با نماد ارز
function formatCurrency(value, currency) {

  if (value === null || value === undefined) {
    return '—';
  }

  const digits = currency?.minorUnitDigits ?? 2;

  const formattedValue = formatNumber(
    value,
    digits
  );

  return `${formattedValue} ${currency?.symbol || currency?.code || ''}`;

}


// یکسان‌سازی متن برای جست‌وجوی فارسی
function normalizeSearch(value) {

  return String(value || '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

}

// تبدیل ارقام انگلیسی به ارقام فارسی
function toPersianDigits(value) {

  return String(value).replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]
  );

}


// استخراج پیام واقعی از خطاهای Electron
function getInventoryErrorMessage(error) {

  let message = String(
    error?.message || ''
  ).trim();


  // حذف پیشوند فنی خطاهای IPC در Electron
  if (message.startsWith('Error invoking remote method')) {

    const errorPosition = message.lastIndexOf('Error:');

    if (errorPosition !== -1) {

      message = message
        .slice(errorPosition + 'Error:'.length)
        .trim();

    }

  } else {

    message = message.replace(/^Error:\s*/i, '');

  }


  // جلوگیری از نمایش خطاهای فنی پایگاه داده به کاربر
  const isTechnicalError = /SQLITE_|constraint failed|database is locked|no such (table|column)|cannot read properties|is not a function|failed to fetch|foreign key/i.test(
    message
  );


  if (isTechnicalError) {

    return 'ذخیره سند انجام نشد. اطلاعات واردشده را بررسی کن و دوباره تلاش کن.';

  }


  return toPersianDigits(
    message || 'ذخیره پیش‌نویس ناموفق بود.'
  );

}

// اعلان شناور موفقیت یا خطا
function EntryToast({ toast }) {

  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === 'success';

  return (

    <div
      className={`entry-toast entry-toast--${toast.type}`}
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
    >

      <span className="entry-toast-icon" aria-hidden="true">
        {isSuccess ? '✓' : '!'}
      </span>

      <p>{toast.message}</p>

    </div>

  );

}


// انتخاب کالا با قابلیت جست‌وجو
function EntryProductPicker({
  value,
  products,
  onQueryChange,
  onSelect,
}) {

  const [isOpen, setIsOpen] = useState(false);

  const filteredProducts = useMemo(() => {

    const query = normalizeSearch(value);

    return products
      .filter((product) => {

        return (
          !query ||
          normalizeSearch(product.name).includes(query) ||
          normalizeSearch(product.code).includes(query)
        );

      })
      .slice(0, 10);

  }, [products, value]);


  return (

    <div className="entry-product-picker">

      <input
        type="search"
        value={value}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        placeholder="جست‌وجوی نام یا کد کالا..."
        autoComplete="off"
        aria-label="جست‌وجوی کالا"
        aria-expanded={isOpen}
      />

      {isOpen && (

        <div className="entry-product-options">

          {filteredProducts.length > 0 ? (

            filteredProducts.map((product) => (

              <button
                type="button"
                className="entry-product-option"
                key={product.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(product);
                  setIsOpen(false);
                }}
              >

                <span className="entry-product-option-info">

                  <strong>{product.name}</strong>

                  <small>{product.code || 'بدون کد'}</small>

                </span>

                <span className="entry-product-option-price">
                  {product.categoryName || 'بدون دسته‌بندی'}
                </span>

              </button>

            ))

          ) : (

            <div className="entry-product-no-result">
              کالایی با این مشخصات پیدا نشد.
            </div>

          )}

        </div>

      )}

    </div>

  );

}


function InventoryEntry() {

  // نوع سند ورود کالا
  const [entryType, setEntryType] = useState('purchase');

  // اطلاعات عمومی سند
  const [documentDate, setDocumentDate] = useState(getLocalDate);

  const [sourcePartyName, setSourcePartyName] = useState('');

  const [sourceInvoiceNumber, setSourceInvoiceNumber] = useState('');

  const [reason, setReason] = useState('');

  const [notes, setNotes] = useState('');


  // اطلاعات واقعی محصولات، واحدها و ارزها
  const [formOptions, setFormOptions] = useState(null);

  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [loadError, setLoadError] = useState('');

  const [reloadToken, setReloadToken] = useState(0);


  // ردیف‌های اقلام ورودی
  const [items, setItems] = useState([]);

  // شناسه مستقل برای هر ردیف
  const nextItemId = useRef(1);


  // وضعیت ذخیره سند
  const [isSaving, setIsSaving] = useState(false);


  // وضعیت اعلان شناور
  const [toast, setToast] = useState(null);


  // دریافت اطلاعات واقعی فرم از Electron
  useEffect(() => {

    let isCurrent = true;


    async function loadFormOptions() {

      setIsLoadingOptions(true);

      setLoadError('');

      setFormOptions(null);


      try {

        const getEntryFormOptions =
          window.hesabyar?.inventory?.getEntryFormOptions;


        if (typeof getEntryFormOptions !== 'function') {
          throw new Error(
            'ارتباط با سرویس موجودی انبار برقرار نیست.'
          );
        }


        const result = await getEntryFormOptions(entryType);


        if (
          !result ||
          !Array.isArray(result.products) ||
          !Array.isArray(result.currencies) ||
          !result.baseCurrencyCode
        ) {
          throw new Error(
            'اطلاعات دریافتی فرم ورود کالا معتبر نیست.'
          );
        }


        if (isCurrent) {
          setFormOptions(result);
        }

      } catch (error) {

        if (isCurrent) {
          setLoadError(
            error.message ||
            'دریافت اطلاعات فرم ورود کالا ناموفق بود.'
          );
        }

      } finally {

        if (isCurrent) {
          setIsLoadingOptions(false);
        }

      }

    }


    loadFormOptions();


    // جلوگیری از تغییر وضعیت پس از خروج کامپوننت
    return () => {
      isCurrent = false;
    };

  }, [entryType, reloadToken]);


  // ناپدید شدن خودکار اعلان پس از سه ثانیه
  useEffect(() => {

    if (!toast) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 3000);

    // پاک کردن زمان‌بندی قبلی هنگام تغییر اعلان
    return () => {
      clearTimeout(timeoutId);
    };

  }, [toast]);


  // فهرست محصولات فعال دریافتی از SQLite
  const activeProducts = useMemo(
    () => formOptions?.products || [],
    [formOptions]
  );


  // فهرست ارزهای فعال
  const currencies = useMemo(
    () => formOptions?.currencies || [],
    [formOptions]
  );


  // نمایش اعلان
  function showToast(type, message) {

    setToast({
      type,
      message,
      id: Date.now(),
    });

  }


  // افزودن ردیف جدید
  function addItemRow() {

    if (items.length >= 200) {
      showToast(
        'error',
        'در هر سند حداکثر ۲۰۰ ردیف کالا قابل ثبت است.'
      );

      return;
    }


    const newItem = {

      id: nextItemId.current++,

      productId: '',

      productSearch: '',

      productUnitId: '',

      quantity: '',

      unitPrice: '',

      currencyCode: formOptions?.baseCurrencyCode || '',

    };


    setItems((previous) => [...previous, newItem]);

  }


  // تغییر اطلاعات یک ردیف
  function updateItem(rowId, changes) {

    setItems((previous) =>
      previous.map((item) =>
        item.id === rowId
          ? { ...item, ...changes }
          : item
      )
    );

  }


  // تغییر عبارت جست‌وجوی کالا
  function handleProductSearch(rowId, value) {

    updateItem(rowId, {

      productId: '',

      productSearch: value,

      productUnitId: '',

      quantity: '',

      unitPrice: '',

    });

  }


  // انتخاب کالا از فهرست واقعی محصولات
  function handleProductSelect(rowId, product) {

    // واحد مبنای محصول به‌صورت پیش‌فرض انتخاب می‌شود
    const baseUnit = product.productUnits.find(
      (unit) => unit.isBaseUnit
    );


    updateItem(rowId, {

      productId: product.id,

      productSearch: product.name,

      productUnitId: baseUnit?.productUnitId || '',

      quantity: '',

      unitPrice: '',

      currencyCode: formOptions.baseCurrencyCode,

    });

  }


  // تغییر واحد اختصاصی کالا
  function handleUnitChange(rowId, productUnitId) {

    updateItem(rowId, {

      productUnitId,

      quantity: '',

      unitPrice: '',

    });

  }


  // حذف یک ردیف
  function removeItemRow(rowId) {

    setItems((previous) =>
      previous.filter((item) => item.id !== rowId)
    );

  }


  // دریافت محصول یک ردیف
  function getItemProduct(item) {

    return activeProducts.find(
      (product) => product.id === item.productId
    ) || null;

  }


  // دریافت واحد انتخاب‌شده یک ردیف
  function getItemUnit(item, product) {

    if (!product) {
      return null;
    }

    return product.productUnits.find(
      (unit) => unit.productUnitId === item.productUnitId
    ) || null;

  }


  // محاسبه مقدار معادل واحد پایه
  function getBaseQuantity(item, product, selectedUnit) {

    if (
      !product ||
      !selectedUnit ||
      item.quantity === '' ||
      !Number.isFinite(Number(item.quantity))
    ) {
      return null;
    }


    const quantity = Number(item.quantity);

    return (
      quantity *
      selectedUnit.conversionNum /
      selectedUnit.conversionDen
    );

  }


  // محاسبه مبلغ یک ردیف
  function getLineAmount(item) {

    if (
      item.quantity === '' ||
      item.unitPrice === ''
    ) {
      return null;
    }


    const quantity = Number(item.quantity);

    const unitPrice = Number(item.unitPrice);


    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      return null;
    }


    return quantity * unitPrice;

  }


  // بررسی کامل بودن تمام ردیف‌های سند
  const allItemsComplete = items.length > 0 &&

    items.every((item) => {

      const product = getItemProduct(item);

      const selectedUnit = getItemUnit(item, product);

      const quantity = Number(item.quantity);

      const unitPrice = Number(item.unitPrice);

      const currencyExists = currencies.some(
        (currency) => currency.code === item.currencyCode
      );


      return (

        Boolean(product) &&

        Boolean(selectedUnit) &&

        item.quantity !== '' &&

        Number.isFinite(quantity) &&

        quantity > 0 &&

        item.unitPrice !== '' &&

        Number.isFinite(unitPrice) &&

        unitPrice >= 0 &&

        currencyExists

      );

    });


  // محاسبه جمع مبالغ به تفکیک ارز
  // جمع ارزهای متفاوت نباید مستقیماً با یکدیگر ترکیب شود.
  const totalsByCurrency = useMemo(() => {

    if (!allItemsComplete) {
      return [];
    }


    const totals = {};

    for (const item of items) {

      const lineAmount = getLineAmount(item);

      totals[item.currencyCode] =
        (totals[item.currencyCode] || 0) + lineAmount;

    }


    return Object.entries(totals).map(
      ([currencyCode, total]) => ({

        currencyCode,

        total,

        currency: currencies.find(
          (currency) => currency.code === currencyCode
        ),

      })
    );

  }, [allItemsComplete, items, currencies]);


  // بررسی تکمیل اطلاعات لازم برای ذخیره پیش‌نویس
  const canSaveDraft = Boolean(

    formOptions &&

    !isLoadingOptions &&

    !isSaving &&

    documentDate &&

    allItemsComplete &&

    (
      entryType !== 'other' ||
      Boolean(reason.trim())
    )

  );


  // ثبت پیش‌نویس در SQLite
  async function handleSaveDraft() {

    if (!canSaveDraft) {
      return;
    }


    setIsSaving(true);


    try {

      const createEntryDraft =
        window.hesabyar?.inventory?.createEntryDraft;


      if (typeof createEntryDraft !== 'function') {
        throw new Error(
          'سرویس ثبت پیش‌نویس در دسترس نیست.'
        );
      }


      // آماده‌سازی اطلاعات برای ارسال به Main Process
      const input = {

        documentType: entryType,

        documentDate,

        sourcePartyName,

        sourceInvoiceNumber,

        reason,

        notes,

        items: items.map((item) => ({

          productId: item.productId,

          productUnitId: item.productUnitId,

          quantity: item.quantity,

          unitPrice: item.unitPrice,

          currencyCode: item.currencyCode,

        })),

      };


      // درخواست ثبت اطلاعات در پایگاه داده
      const result = await createEntryDraft(input);


      if (!result?.id || !result?.documentNumber) {
        throw new Error(
          'پاسخ ثبت پیش‌نویس معتبر نیست.'
        );
      }


      // نمایش پیام موفقیت پس از تأیید ذخیره در SQLite
      showToast(
        'success',
        `پیش‌نویس سند ${result.documentNumber} با موفقیت ذخیره شد.`
      );


      // پاک کردن اطلاعات سند ذخیره‌شده
      // فرم برای ثبت سند جدید آماده می‌شود.
      setItems([]);

      setDocumentDate(getLocalDate());

      setSourcePartyName('');

      setSourceInvoiceNumber('');

      setReason('');

      setNotes('');

      nextItemId.current = 1;


    } catch (error) {

      showToast(
        'error',
        getInventoryErrorMessage(error)
      );

    } finally {

      setIsSaving(false);

    }

  }


  // تغییر نوع سند
  function handleEntryTypeChange(value) {

    if (value === entryType) {
      return;
    }

    setEntryType(value);

  }


  // حالت دریافت اطلاعات
  if (isLoadingOptions) {

    return (

      <div className="inventory-entry">

        <div className="entry-load-state">
          در حال دریافت محصولات، واحدها و ارزهای فعال...
        </div>

      </div>

    );

  }


  // حالت بروز خطا در دریافت اطلاعات
  if (loadError || !formOptions) {

    return (

      <div className="inventory-entry">

        <div className="entry-load-error">

          <strong>دریافت اطلاعات فرم ناموفق بود.</strong>

          <p>
            {loadError || 'اطلاعات موردنیاز فرم در دسترس نیست.'}
          </p>

          <button
            type="button"
            onClick={() => setReloadToken((previous) => previous + 1)}
          >
            تلاش مجدد
          </button>

        </div>

      </div>

    );

  }


  return (

    <div className="inventory-entry">

      {/* اطلاعات عمومی سند */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>اطلاعات سند</h2>
            <p>اطلاعات عمومی ورود کالا به انبار</p>
          </div>

          <span className="entry-status">
            پیش‌نویس
          </span>

        </div>


        <div className="entry-form-grid">

          <label className="entry-field">

            <span>شماره سند</span>

            <input
              type="text"
              value="خودکار هنگام ذخیره"
              disabled
            />

          </label>


          <label className="entry-field">

            <span>
              {entryType === 'opening'
                ? 'تاریخ مبنای موجودی'
                : 'تاریخ ورود'}
            </span>

            <div className="entry-date-picker-wrapper">

              <DatePicker

                // تاریخ میلادی داخلی به تاریخ شمسی تبدیل می‌شود
                value={getPersianDateValue(documentDate)}

                // پس از انتخاب تاریخ، مقدار میلادی ذخیره می‌شود
                onChange={(selectedDate) => {

                  if (!selectedDate) {
                    return;
                  }

                  setDocumentDate(
                    convertToGregorianDate(selectedDate)
                  );

                }}

                calendar={persianCalendar}

                locale={persianAfghanistan}

                // قالب نمایش افغانستان: روز، نام ماه، سال
                format="DD MMMM YYYY"

                calendarPosition="bottom-right"

                editable={false}

                inputClass="entry-date-picker-input"

                containerClassName="entry-date-picker-container"

                placeholder="روز، ماه و سال"

              />

            </div>

          </label>


          <label className="entry-field entry-field-full">

            <span>نوع ورود کالا</span>

            <select
              value={entryType}
              onChange={(event) =>
                handleEntryTypeChange(event.target.value)
              }
            >

              <option value="purchase">
                خرید
              </option>

              <option value="sales-return">
                برگشت از فروش
              </option>

              <option value="opening">
                موجودی اولیه
              </option>

              <option value="other">
                سایر
              </option>

            </select>

          </label>

        </div>

      </section>


      {/* اطلاعات منبع ورود */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>اطلاعات منبع ورود</h2>
            <p>
              اطلاعات تکمیلی درباره منشأ کالاهای ورودی
            </p>
          </div>

        </div>


        <div className="entry-form-grid">

          {(entryType === 'purchase' ||
            entryType === 'sales-return') && (

              <>

                <label className="entry-field">

                  <span>
                    {entryType === 'purchase'
                      ? 'تأمین‌کننده'
                      : 'مشتری'}
                  </span>

                  <input
                    type="text"
                    value={sourcePartyName}
                    onChange={(event) =>
                      setSourcePartyName(event.target.value)
                    }
                    placeholder={
                      entryType === 'purchase'
                        ? 'نام تأمین‌کننده...'
                        : 'نام مشتری...'
                    }
                  />

                </label>


                <label className="entry-field">

                  <span>
                    {entryType === 'purchase'
                      ? 'شماره فاکتور خرید'
                      : 'شماره فاکتور فروش'}
                  </span>

                  <input
                    type="text"
                    value={sourceInvoiceNumber}
                    onChange={(event) =>
                      setSourceInvoiceNumber(event.target.value)
                    }
                    placeholder="شماره فاکتور (اختیاری)"
                  />

                </label>

              </>

            )}


          {entryType === 'other' && (

            <label className="entry-field entry-field-full">

              <span>علت ورود کالا</span>

              <input
                type="text"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="علت ورود کالا را بنویس..."
              />

            </label>

          )}

        </div>

      </section>


      {/* جدول اقلام ورودی */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>اقلام ورودی</h2>
            <p>
              کالاها، واحدها، مقادیر و قیمت‌های ورود به انبار
            </p>
          </div>


          <div className="entry-items-header-actions">

            <span className="entry-item-count">
              {formatNumber(items.length)} ردیف
            </span>


            {/* دکمه افزودن کالا در بالای فهرست */}
            <button
              type="button"
              className="entry-add-item-button"
              onClick={addItemRow}
            >
              <span>＋</span>
              افزودن کالا
            </button>

          </div>

        </div>


        {items.length === 0 ? (

          <div className="entry-empty-items">

            <div className="entry-empty-icon">＋</div>

            <strong>
              هنوز کالایی به سند اضافه نشده است.
            </strong>

            <p>
              برای شروع، کالاهای موردنظر را به سند ورود اضافه کن.
            </p>

            <button
              type="button"
              onClick={addItemRow}
            >
              افزودن اولین کالا
            </button>

          </div>

        ) : (

          <>

            <div className="entry-items-table-scroll">

              <table className="entry-items-table">

                <thead>

                  <tr>
                    <th>ردیف</th>
                    <th>کالا</th>
                    <th>واحد</th>
                    <th>مقدار ورودی</th>
                    <th>قیمت واحد</th>
                    <th>مبلغ ردیف</th>
                    <th>عملیات</th>
                  </tr>

                </thead>


                <tbody>

                  {items.map((item, index) => {

                    const product = getItemProduct(item);

                    const selectedUnit = getItemUnit(
                      item,
                      product
                    );

                    const baseQuantity = getBaseQuantity(
                      item,
                      product,
                      selectedUnit
                    );

                    const lineAmount = getLineAmount(item);

                    const currency = currencies.find(
                      (currentCurrency) =>
                        currentCurrency.code === item.currencyCode
                    );

                    const duplicateProduct = Boolean(
                      item.productId &&
                      items.some(
                        (otherItem) =>
                          otherItem.id !== item.id &&
                          otherItem.productId === item.productId
                      )
                    );


                    return (

                      <tr key={item.id}>

                        {/* شماره ردیف */}
                        <td data-label="ردیف">
                          {formatNumber(index + 1)}
                        </td>


                        {/* انتخاب کالا */}
                        <td data-label="کالا">

                          <EntryProductPicker
                            value={item.productSearch}
                            products={activeProducts}
                            onQueryChange={(value) =>
                              handleProductSearch(item.id, value)
                            }
                            onSelect={(selectedProduct) =>
                              handleProductSelect(
                                item.id,
                                selectedProduct
                              )
                            }
                          />


                          {duplicateProduct && (

                            <small className="entry-item-warning">
                              این کالا در ردیف دیگری نیز ثبت شده است.
                              این دو ردیف جداگانه محاسبه می‌شوند.
                            </small>

                          )}

                        </td>


                        {/* انتخاب واحد اختصاصی محصول */}
                        <td data-label="واحد">

                          <select
                            value={item.productUnitId}
                            onChange={(event) =>
                              handleUnitChange(
                                item.id,
                                event.target.value
                              )
                            }
                            disabled={!product}
                          >

                            {!product && (
                              <option value="">
                                ابتدا کالا را انتخاب کن
                              </option>
                            )}

                            {product?.productUnits.map((unit) => (

                              <option
                                key={unit.productUnitId}
                                value={unit.productUnitId}
                              >

                                {unit.name}
                                {' ('}
                                {unit.symbol}
                                {')'}

                                {unit.isBaseUnit
                                  ? ' - واحد اصلی'
                                  : ''}

                              </option>

                            ))}

                          </select>


                          {selectedUnit && !selectedUnit.isBaseUnit && (

                            <small className="entry-unit-hint">

                              هر ۱ {selectedUnit.name}
                              {' = '}
                              {formatNumber(
                                selectedUnit.conversionNum /
                                selectedUnit.conversionDen,
                                6
                              )}
                              {' '}
                              {product.baseUnitName}

                            </small>

                          )}

                        </td>


                        {/* مقدار ورودی */}
                        <td data-label="مقدار ورودی">

                          <input
                            type="number"
                            min="0"
                            step={
                              selectedUnit
                                ? String(
                                  1 / (
                                    10 ** selectedUnit.inputDecimalPlaces
                                  )
                                )
                                : '1'
                            }
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.id, {
                                quantity: event.target.value,
                              })
                            }
                            disabled={!selectedUnit}
                            placeholder="مقدار"
                            className="entry-number-input"
                          />


                          {baseQuantity !== null &&
                            selectedUnit &&
                            !selectedUnit.isBaseUnit && (

                              <small className="entry-unit-hint">

                                معادل پایه:
                                {' '}
                                {formatNumber(
                                  baseQuantity,
                                  product.baseQuantityDecimalPlaces
                                )}
                                {' '}
                                {product.baseUnitSymbol}

                              </small>

                            )}

                        </td>


                        {/* قیمت واحد و ارز */}
                        <td data-label="قیمت واحد">

                          <input
                            type="number"
                            min="0"
                            step="0.000001"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItem(item.id, {
                                unitPrice: event.target.value,
                              })
                            }
                            disabled={!selectedUnit}
                            placeholder="قیمت واحد"
                            className="entry-number-input"
                          />


                          <select
                            value={item.currencyCode}
                            onChange={(event) =>
                              updateItem(item.id, {
                                currencyCode: event.target.value,
                              })
                            }
                            disabled={!selectedUnit}
                            aria-label="ارز قیمت واحد"
                          >

                            {currencies.map((currencyOption) => (

                              <option
                                key={currencyOption.code}
                                value={currencyOption.code}
                              >

                                {currencyOption.code}
                                {' - '}
                                {currencyOption.name}

                              </option>

                            ))}

                          </select>


                          {selectedUnit && (

                            <small className="entry-unit-hint">
                              قیمت به ازای هر {selectedUnit.name}
                            </small>

                          )}

                        </td>


                        {/* مبلغ ردیف */}
                        <td data-label="مبلغ ردیف">

                          <strong className="entry-line-amount">

                            {lineAmount !== null
                              ? formatCurrency(lineAmount, currency)
                              : '—'}

                          </strong>

                        </td>


                        {/* حذف ردیف */}
                        <td data-label="عملیات">

                          <button
                            type="button"
                            className="entry-remove-item-button"
                            onClick={() => removeItemRow(item.id)}
                            title="حذف این ردیف"
                            aria-label={`حذف ردیف ${index + 1}`}
                          >
                            ×
                          </button>

                        </td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>


            {/* دکمه دوم افزودن کالا در انتهای فهرست */}
            <div className="entry-add-item-footer">

              <p>
                برای افزودن ردیف دیگری، از دکمه زیر استفاده کن.
              </p>

              <button
                type="button"
                className="entry-add-item-button"
                onClick={addItemRow}
              >
                <span>＋</span>
                افزودن کالای دیگر
              </button>

            </div>

          </>

        )}

      </section>


      {/* خلاصه سند */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>خلاصه سند</h2>
            <p>
              تعداد ردیف‌ها و مجموع مبالغ به تفکیک ارز
            </p>
          </div>

        </div>


        <div className="entry-summary">

          <div className="entry-summary-item">

            <span>تعداد ردیف کالا</span>

            <strong>
              {formatNumber(items.length)}
            </strong>

          </div>


          {totalsByCurrency.length > 0 ? (

            totalsByCurrency.map((total) => (

              <div
                className="entry-summary-item"
                key={total.currencyCode}
              >

                <span>
                  مبلغ کل به {total.currency?.name || total.currencyCode}
                </span>

                <strong>
                  {formatCurrency(
                    total.total,
                    total.currency
                  )}
                </strong>

              </div>

            ))

          ) : (

            <div className="entry-summary-item">

              <span>مبلغ کل سند</span>

              <strong>—</strong>

            </div>

          )}

        </div>


        {!allItemsComplete && items.length > 0 && (

          <p className="entry-summary-note">

            برای محاسبه مبلغ کل و ذخیره سند، کالا، واحد، مقدار،
            قیمت و ارز تمام ردیف‌ها باید تکمیل شوند.

          </p>

        )}

      </section>


      {/* توضیحات و عملیات */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>توضیحات</h2>
            <p>اطلاعات تکمیلی این سند</p>
          </div>

        </div>


        <label className="entry-field">

          <span>یادداشت</span>

          <textarea
            rows="3"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="توضیحات اختیاری درباره این سند..."
          />

        </label>


        <div className="entry-form-actions">

          <button
            type="button"
            className="entry-submit-button"
            disabled
            title="ثبت نهایی سند در مرحله بعد پیاده‌سازی می‌شود."
          >
            ثبت نهایی سند
          </button>


          <button
            type="button"
            className="entry-draft-button"
            onClick={handleSaveDraft}
            disabled={!canSaveDraft}
          >

            {isSaving
              ? 'در حال ذخیره...'
              : 'ذخیره پیش‌نویس'}

          </button>

        </div>

      </section>


      {/* اعلان شناور پایین چپ صفحه */}
      <EntryToast toast={toast} />

    </div>

  );

}


export default InventoryEntry;