import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import './inventory-entry.css';


// قالب‌بندی اعداد با ارقام فارسی
function formatNumber(value, maximumFractionDigits = 2) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits,
  }).format(number);

}


// تبدیل ارقام فارسی و عربی به انگلیسی
function normalizeNumber(value) {

  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - 1776)
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - 1632)
    )
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .trim();

}


// تبدیل مقدار ورودی به عدد
function parseInputNumber(value) {

  const normalized = normalizeNumber(value);

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;

}


// بررسی اعتبار مقدار و تعداد رقم‌های اعشار
function isValidDecimalInput(
  value,
  maximumDecimalPlaces,
  allowZero = false
) {

  const normalized = normalizeNumber(value);

  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);

  if (!match) {
    return false;
  }

  // صفرهای انتهایی در تعداد رقم اعشار مؤثر نیستند
  const effectiveFraction = (match[2] || '')
    .replace(/0+$/, '');

  if (
    effectiveFraction.length > maximumDecimalPlaces ||
    effectiveFraction.length > 6
  ) {
    return false;
  }

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return false;
  }

  return allowZero
    ? number >= 0
    : number > 0;

}


// دریافت تاریخ امروز بر اساس ساعت محلی سیستم
function getTodayDate() {

  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    today.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;

}


// محاسبه مقدار تبدیل‌شده به واحد پایه
function convertToBaseUnit(
  quantity,
  selectedUnit
) {

  const numericQuantity = parseInputNumber(quantity);

  if (
    numericQuantity === null ||
    numericQuantity <= 0 ||
    !selectedUnit
  ) {
    return null;
  }

  const numerator = Number(
    selectedUnit.conversionNum
  );

  const denominator = Number(
    selectedUnit.conversionDen
  );

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return null;
  }

  return numericQuantity * numerator / denominator;

}


// انتخاب کالا با قابلیت جست‌وجو
function EntryProductPicker({
  value,
  products,
  onQueryChange,
  onSelect,
  disabled,
}) {

  const [isOpen, setIsOpen] = useState(false);


  // فیلتر کردن محصولات بر اساس نام یا کد
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
        disabled={disabled}
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


      {isOpen && !disabled && (

        <div className="entry-product-options">

          {filteredProducts.length > 0 ? (

            filteredProducts.map((product) => (

              <button
                type="button"
                className="entry-product-option"
                key={product.id}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => {
                  onSelect(product);
                  setIsOpen(false);
                }}
              >

                <span className="entry-product-option-info">

                  <strong>
                    {product.name}
                  </strong>

                  <small>
                    کد: {product.code}
                  </small>

                </span>

                <span className="entry-product-option-price">

                  {product.categoryName || 'بدون دسته‌بندی'}

                  {' · '}

                  واحد پایه: {product.baseUnitName}

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


function InventoryEntry() {

  // نوع سند ورود کالا
  const [entryType, setEntryType] = useState('purchase');


  // اطلاعات محصولات، واحدها و ارزها از SQLite
  const [formOptions, setFormOptions] = useState(null);


  // وضعیت دریافت اطلاعات فرم
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [optionsError, setOptionsError] = useState('');


  // کلید تلاش مجدد برای دریافت اطلاعات فرم
  const [reloadOptionsKey, setReloadOptionsKey] = useState(0);


  // اطلاعات عمومی سند
  const [documentDate, setDocumentDate] = useState(
    getTodayDate()
  );

  const [sourcePartyName, setSourcePartyName] = useState('');

  const [sourceInvoiceNumber, setSourceInvoiceNumber] = useState('');

  const [reason, setReason] = useState('');

  const [notes, setNotes] = useState('');


  // اقلام سند
  const [items, setItems] = useState([]);


  // تولید شناسه مستقل برای هر ردیف فرم
  const nextItemId = useRef(1);


  // وضعیت ذخیره پیش‌نویس
  const [savingDraft, setSavingDraft] = useState(false);


  // پیام نتیجه عملیات
  const [feedback, setFeedback] = useState(null);


  // بارگذاری محصولات، واحدها و ارزهای معتبر برای نوع سند جاری
  useEffect(() => {

    let isCurrentRequest = true;


    async function loadFormOptions() {

      try {

        const getOptions =
          window.hesabyar?.inventory?.getEntryFormOptions;


        if (typeof getOptions !== 'function') {
          throw new Error(
            'ارتباط فرم موجودی با سرویس Electron برقرار نیست.'
          );
        }


        const result = await getOptions(entryType);


        if (!isCurrentRequest) {
          return;
        }


        // بررسی ساختار اطلاعات دریافتی
        if (
          !result ||
          !Array.isArray(result.products) ||
          !Array.isArray(result.currencies) ||
          !result.baseCurrencyCode
        ) {
          throw new Error(
            'اطلاعات دریافت‌شده از پایگاه داده معتبر نیست.'
          );
        }


        setFormOptions(result);

        setOptionsError('');

      } catch (error) {

        if (!isCurrentRequest) {
          return;
        }

        setFormOptions(null);

        setOptionsError(
          error?.message ||
          'دریافت اطلاعات فرم ورود کالا با خطا مواجه شد.'
        );

      } finally {

        if (isCurrentRequest) {
          setLoadingOptions(false);
        }

      }

    }


    loadFormOptions();


    // جلوگیری از به‌روزرسانی وضعیت پس از تغییر نوع سند یا خروج از صفحه
    return () => {
      isCurrentRequest = false;
    };

  }, [entryType, reloadOptionsKey]);


  // محصولات فعال دریافتی از پایگاه داده
  const activeProducts = formOptions?.products || [];


  // ارزهای فعال دریافتی از پایگاه داده
  const currencies = formOptions?.currencies || [];


  // ارز مبنای ارزش‌گذاری
  const baseCurrencyCode =
    formOptions?.baseCurrencyCode || '';


  // افزودن ردیف جدید
  function addItemRow() {

    if (!formOptions || loadingOptions) {
      return;
    }

    const newItem = {

      id: nextItemId.current++,

      productId: '',

      productSearch: '',

      productUnitId: '',

      quantity: '',

      unitPrice: '',

      currencyCode: baseCurrencyCode,

    };


    setItems((previous) => [
      ...previous,
      newItem,
    ]);

    setFeedback(null);

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

    setFeedback(null);

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


  // انتخاب کالا
  function handleProductSelect(rowId, product) {

    // پیدا کردن واحد پایه از فهرست واحدهای اختصاصی محصول
    const baseUnit = product.productUnits.find(
      (unit) => unit.isBaseUnit
    );


    updateItem(rowId, {

      productId: product.id,

      productSearch: product.name,

      // انتخاب خودکار واحد پایه
      productUnitId: baseUnit?.productUnitId || '',

      quantity: '',

      unitPrice: '',

      currencyCode: baseCurrencyCode,

    });

  }


  // تغییر واحد اختصاصی محصول
  function handleUnitChange(rowId, productUnitId) {

    updateItem(rowId, {

      productUnitId,

      // با تغییر واحد، مقدار و قیمت قبلی پاک می‌شوند
      quantity: '',

      unitPrice: '',

    });

  }


  // تغییر ارز قیمت
  function handleCurrencyChange(rowId, currencyCode) {

    updateItem(rowId, {

      currencyCode,

      // قیمت قبلی نباید ناخواسته با ارز جدید تفسیر شود
      unitPrice: '',

    });

  }


  // حذف یک ردیف
  function removeItemRow(rowId) {

    setItems((previous) =>
      previous.filter((item) => item.id !== rowId)
    );

    setFeedback(null);

  }


  // پیدا کردن محصول متناظر با ردیف
  function getItemProduct(item) {

    return activeProducts.find(
      (product) => product.id === item.productId
    ) || null;

  }


  // پیدا کردن واحد انتخاب‌شده از میان واحدهای اختصاصی محصول
  function getItemSelectedUnit(item, product) {

    if (!product) {
      return null;
    }

    return product.productUnits.find(
      (unit) =>
        unit.productUnitId === item.productUnitId
    ) || null;

  }


  // محاسبه مبلغ یک ردیف
  function getLineAmount(item) {

    const quantity = parseInputNumber(item.quantity);

    const unitPrice = parseInputNumber(item.unitPrice);


    if (
      quantity === null ||
      unitPrice === null ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      return null;
    }

    return quantity * unitPrice;

  }


  // بررسی کامل بودن و اعتبار تمام ردیف‌ها
  const allItemsComplete = items.length > 0 &&
    items.every((item) => {

      const product = getItemProduct(item);

      const selectedUnit = getItemSelectedUnit(
        item,
        product
      );


      const currencyExists = currencies.some(
        (currency) =>
          currency.code === item.currencyCode
      );


      return (

        Boolean(product) &&

        Boolean(selectedUnit) &&

        isValidDecimalInput(
          item.quantity,
          selectedUnit?.inputDecimalPlaces ?? 0
        ) &&

        isValidDecimalInput(
          item.unitPrice,
          6,
          true
        ) &&

        currencyExists

      );

    });


  // بررسی فیلدهای عمومی سند
  const documentFieldsComplete = Boolean(
    documentDate &&
    (
      entryType !== 'other' ||
      reason.trim()
    )
  );


  // محاسبه مجموع مبالغ به تفکیک ارز
  // جمع ارزهای متفاوت در یک عدد واحد صحیح نیست.
  const totalsByCurrency = (() => {

    if (!allItemsComplete) {
      return [];
    }

    const totals = new Map();


    for (const item of items) {

      const lineAmount = getLineAmount(item);

      if (lineAmount === null) {
        continue;
      }

      const previousTotal = totals.get(
        item.currencyCode
      ) || 0;

      totals.set(
        item.currencyCode,
        previousTotal + lineAmount
      );

    }


    return Array.from(totals.entries()).map(
      ([currencyCode, total]) => {

        const currency = currencies.find(
          (item) => item.code === currencyCode
        );

        return {
          currencyCode,
          currency,
          total,
        };

      }
    );

  })();

  // امکان ذخیره پیش‌نویس
  const canSaveDraft = Boolean(

    formOptions &&

    !loadingOptions &&

    !savingDraft &&

    allItemsComplete &&

    documentFieldsComplete

  );


  // تغییر نوع سند
  function handleEntryTypeChange(nextType) {

    if (nextType === entryType) {
      return;
    }

    setEntryType(nextType);

    // هنگام تغییر نوع سند، اقلام قبلی پاک می‌شوند
    setItems([]);

    nextItemId.current = 1;

    setSourcePartyName('');

    setSourceInvoiceNumber('');

    setReason('');

    setNotes('');

    setFormOptions(null);

    setLoadingOptions(true);

    setOptionsError('');

    setFeedback(null);

  }


  // تلاش مجدد برای دریافت اطلاعات فرم
  function retryLoadFormOptions() {

    setLoadingOptions(true);

    setOptionsError('');

    setFormOptions(null);

    setReloadOptionsKey((previous) => previous + 1);

  }


  // ذخیره پیش‌نویس سند
  async function handleSaveDraft(event) {

    event.preventDefault();


    if (!canSaveDraft) {
      return;
    }


    setSavingDraft(true);

    setFeedback(null);


    try {

      const createDraft =
        window.hesabyar?.inventory?.createEntryDraft;


      if (typeof createDraft !== 'function') {
        throw new Error(
          'قابلیت ثبت پیش‌نویس در ارتباط Electron پیدا نشد.'
        );
      }


      // آماده‌سازی اطلاعات عمومی سند و ردیف‌ها
      const input = {

        documentType: entryType,

        documentDate,

        sourcePartyName,

        sourceInvoiceNumber,

        reason,

        notes,


        items: items.map((item) => ({

          productId: item.productId,

          // شناسه نسخه واحد اختصاصی محصول
          productUnitId: item.productUnitId,

          quantity: normalizeNumber(item.quantity),

          unitPrice: normalizeNumber(item.unitPrice),

          currencyCode: item.currencyCode,

        })),

      };


      // ارسال درخواست به Main Process
      const result = await createDraft(input);


      if (!result?.id || !result?.documentNumber) {
        throw new Error(
          'پیش‌نویس ذخیره شد، اما پاسخ سرویس کامل نیست.'
        );
      }


      // اعلام موفقیت همراه با شماره سند
      setFeedback({

        type: 'success',

        message:
          `پیش‌نویس سند ${result.documentNumber} با موفقیت ذخیره شد.`,

      });


      // پاک‌سازی فرم برای ورود سند بعدی
      setItems([]);

      nextItemId.current = 1;

      setSourcePartyName('');

      setSourceInvoiceNumber('');

      setReason('');

      setNotes('');

      setDocumentDate(getTodayDate());


    } catch (error) {

      setFeedback({

        type: 'error',

        message:
          error?.message ||
          'ذخیره پیش‌نویس با خطا مواجه شد.',

      });

    } finally {

      setSavingDraft(false);

    }

  }


  // عنوان فیلد طرف حساب بر اساس نوع سند
  const sourcePartyLabel =
    entryType === 'purchase'
      ? 'تأمین‌کننده'
      : entryType === 'sales-return'
        ? 'مشتری'
        : 'منبع ورود';


  // عنوان شماره فاکتور
  const invoiceLabel =
    entryType === 'sales-return'
      ? 'شماره فاکتور فروش'
      : 'شماره فاکتور خرید';


  return (

    <form
      className="inventory-entry"
      onSubmit={handleSaveDraft}
    >

      {/* وضعیت دریافت اطلاعات واقعی از SQLite */}
      {loadingOptions && (

        <div className="entry-options-state" role="status">
          در حال دریافت محصولات، واحدها و ارزهای فعال...
        </div>

      )}


      {optionsError && (

        <div
          className="entry-feedback entry-feedback-error"
          role="alert"
        >

          <span>{optionsError}</span>

          <button
            type="button"
            onClick={retryLoadFormOptions}
          >
            تلاش مجدد
          </button>

        </div>

      )}


      {/* پیام نتیجه عملیات */}
      {feedback && (

        <div
          className={`entry-feedback ${feedback.type === 'success'
            ? 'entry-feedback-success'
            : 'entry-feedback-error'
            }`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>

      )}


      {/* اطلاعات عمومی سند */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>اطلاعات سند</h2>

            <p>
              اطلاعات عمومی ورود کالا به انبار
            </p>
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
              value="پس از ذخیره به‌صورت خودکار تولید می‌شود"
              disabled
            />

          </label>


          <label className="entry-field">

            <span>
              {entryType === 'opening'
                ? 'تاریخ مبنای موجودی'
                : 'تاریخ ورود'}
            </span>

            <input
              type="date"
              value={documentDate}
              onChange={(event) => {
                setDocumentDate(event.target.value);
                setFeedback(null);
              }}
              required
            />

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

                  <span>{sourcePartyLabel}</span>

                  <input
                    type="text"
                    value={sourcePartyName}
                    onChange={(event) => {
                      setSourcePartyName(event.target.value);
                      setFeedback(null);
                    }}
                    placeholder={`نام ${sourcePartyLabel} را وارد کن...`}
                    maxLength={150}
                  />

                </label>


                <label className="entry-field">

                  <span>{invoiceLabel}</span>

                  <input
                    type="text"
                    value={sourceInvoiceNumber}
                    onChange={(event) => {
                      setSourceInvoiceNumber(event.target.value);
                      setFeedback(null);
                    }}
                    placeholder="شماره فاکتور (اختیاری)"
                    maxLength={100}
                  />

                </label>

              </>

            )}


          {entryType === 'other' && (

            <>

              <label className="entry-field">

                <span>منبع ورود (اختیاری)</span>

                <input
                  type="text"
                  value={sourcePartyName}
                  onChange={(event) => {
                    setSourcePartyName(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="منبع ورود کالا..."
                  maxLength={150}
                />

              </label>


              <label className="entry-field">

                <span>علت ورود کالا</span>

                <input
                  type="text"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="علت ورود کالا را بنویس..."
                  maxLength={500}
                  required
                />

              </label>

            </>

          )}


          {entryType === 'opening' && (

            <div className="entry-field entry-field-full">

              <span>توضیح موجودی اولیه</span>

              <p className="entry-unit-hint">
                تاریخ مبنا و بهای واحد هر کالا برای ارزش‌گذاری
                موجودی اولیه ثبت می‌شود.
              </p>

            </div>

          )}

        </div>

      </section>


      {/* جدول اقلام ورودی */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>

            <h2>اقلام ورودی</h2>

            <p>
              کالاها، واحدها، مقادیر و بهای ورود به انبار
            </p>

          </div>


          <div className="entry-items-header-actions">

            <span className="entry-item-count">
              {formatNumber(items.length)} ردیف
            </span>


            <button
              type="button"
              className="entry-add-item-button"
              onClick={addItemRow}
              disabled={
                !formOptions ||
                loadingOptions
              }
            >
              <span>＋</span>
              افزودن کالا
            </button>

          </div>

        </div>


        {activeProducts.length === 0 &&
          formOptions &&
          !loadingOptions && (

            <p className="entry-summary-note">
              در حال حاضر محصول فعالی با واحد معتبر برای ورود به انبار
              پیدا نشد.
            </p>

          )}


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
              disabled={
                !formOptions ||
                loadingOptions ||
                activeProducts.length === 0
              }
            >
              افزودن اولین کالا
            </button>

          </div>

        ) : (

          <div className="entry-items-table-scroll">

            <table className="entry-items-table">

              <thead>

                <tr>
                  <th>ردیف</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار ورودی</th>
                  <th>بهای واحد</th>
                  <th>ارز</th>
                  <th>مبلغ ردیف</th>
                  <th>عملیات</th>
                </tr>

              </thead>


              <tbody>

                {items.map((item, index) => {

                  const product = getItemProduct(item);

                  const selectedUnit = getItemSelectedUnit(
                    item,
                    product
                  );

                  const baseUnit = product?.productUnits.find(
                    (unit) => unit.isBaseUnit
                  ) || null;


                  const lineAmount = getLineAmount(item);


                  const currency = currencies.find(
                    (entry) =>
                      entry.code === item.currencyCode
                  );


                  const duplicateProduct = Boolean(
                    item.productId &&
                    items.some(
                      (otherItem) =>
                        otherItem.id !== item.id &&
                        otherItem.productId === item.productId
                    )
                  );


                  const baseQuantity = convertToBaseUnit(
                    item.quantity,
                    selectedUnit
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
                          disabled={
                            loadingOptions ||
                            !formOptions
                          }
                          onQueryChange={(value) =>
                            handleProductSearch(
                              item.id,
                              value
                            )
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
                            ردیف‌ها جداگانه ذخیره می‌شوند.
                          </small>

                        )}


                        {product && !baseUnit && (

                          <small className="entry-item-error">
                            واحد پایه این کالا پیدا نشد.
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
                          disabled={
                            !product ||
                            product.productUnits.length === 0
                          }
                        >

                          {!product && (

                            <option value="">
                              ابتدا کالا را انتخاب کن
                            </option>

                          )}


                          {product && product.productUnits.map(
                            (unit) => (

                              <option
                                key={unit.productUnitId}
                                value={unit.productUnitId}
                              >

                                {unit.name}
                                {unit.symbol
                                  ? ` (${unit.symbol})`
                                  : ''}

                                {unit.isBaseUnit
                                  ? ' - واحد پایه'
                                  : ''}

                              </option>

                            )
                          )}

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
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: event.target.value,
                            })
                          }
                          disabled={!selectedUnit}
                          placeholder="مقدار"
                          className="entry-number-input"
                          aria-label={`مقدار ردیف ${index + 1}`}
                        />


                        {selectedUnit && baseQuantity !== null && (

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


                        {selectedUnit && (

                          <small className="entry-unit-hint">

                            حداکثر اعشار مجاز:

                            {' '}

                            {formatNumber(
                              selectedUnit.inputDecimalPlaces,
                              0
                            )}

                          </small>

                        )}

                      </td>


                      {/* بهای واحد */}
                      <td data-label="بهای واحد">

                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitPrice: event.target.value,
                            })
                          }
                          disabled={!selectedUnit}
                          placeholder="بهای واحد"
                          className="entry-number-input"
                          aria-label={`بهای واحد ردیف ${index + 1}`}
                        />


                        {selectedUnit && (

                          <small className="entry-unit-hint">
                            به ازای هر {selectedUnit.name}
                          </small>

                        )}

                      </td>


                      {/* انتخاب ارز */}
                      <td data-label="ارز">

                        <select
                          value={item.currencyCode}
                          onChange={(event) =>
                            handleCurrencyChange(
                              item.id,
                              event.target.value
                            )
                          }
                          disabled={!selectedUnit}
                        >

                          {currencies.map((entry) => (

                            <option
                              key={entry.code}
                              value={entry.code}
                            >
                              {entry.code} - {entry.name}
                            </option>

                          ))}

                        </select>


                        {item.currencyCode &&
                          item.currencyCode !== baseCurrencyCode && (

                            <small className="entry-item-currency-hint">

                              نرخ تبدیل به {baseCurrencyCode} در تاریخ سند
                              باید ثبت شده باشد.

                            </small>

                          )}

                      </td>


                      {/* مبلغ ردیف */}
                      <td data-label="مبلغ ردیف">

                        <strong className="entry-line-amount">

                          {lineAmount !== null
                            ? formatNumber(
                              lineAmount,
                              currency?.minorUnitDigits ?? 2
                            )
                            : '—'}

                        </strong>


                        {currency && (

                          <small className="entry-unit-hint">
                            {currency.code}
                          </small>

                        )}

                      </td>


                      {/* حذف ردیف */}
                      <td data-label="عملیات">

                        <button
                          type="button"
                          className="entry-remove-item-button"
                          onClick={() =>
                            removeItemRow(item.id)
                          }
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

        )}

      </section>


      {/* خلاصه سند */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>خلاصه سند</h2>

            <p>
              تعداد ردیف‌ها و جمع مبالغ به تفکیک ارز
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


          {totalsByCurrency.map((entry) => (

            <div
              className="entry-summary-item"
              key={entry.currencyCode}
            >

              <span>
                جمع مبلغ به {entry.currency?.name || entry.currencyCode}
              </span>

              <strong>

                {formatNumber(
                  entry.total,
                  entry.currency?.minorUnitDigits ?? 2
                )}

                {' '}

                {entry.currencyCode}

              </strong>

            </div>

          ))}

        </div>


        {!allItemsComplete && items.length > 0 && (

          <p className="entry-summary-note">

            برای ذخیره سند، کالا، واحد، مقدار، بهای واحد و ارز تمام
            ردیف‌ها باید معتبر و تکمیل باشند.

          </p>

        )}


        {allItemsComplete && totalsByCurrency.length > 1 && (

          <p className="entry-summary-note">

            مبالغ ارزهای مختلف جداگانه نمایش داده شده‌اند و
            با یکدیگر جمع نمی‌شوند.

          </p>

        )}

      </section>


      {/* توضیحات و عملیات */}
      <section className="entry-section">

        <div className="entry-section-header">

          <div>
            <h2>توضیحات</h2>

            <p>
              اطلاعات تکمیلی این سند
            </p>
          </div>

        </div>


        <label className="entry-field">

          <span>یادداشت</span>

          <textarea
            rows="3"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setFeedback(null);
            }}
            placeholder="توضیحات اختیاری درباره این سند..."
            maxLength={2000}
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
            type="submit"
            className="entry-draft-button"
            disabled={!canSaveDraft}
          >

            {savingDraft
              ? 'در حال ذخیره...'
              : 'ذخیره پیش‌نویس'}

          </button>

        </div>

      </section>

    </form>

  );

}

export default InventoryEntry;