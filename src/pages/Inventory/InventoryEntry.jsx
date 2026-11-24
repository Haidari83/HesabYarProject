import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';

import './inventory-entry.css';

// کتابخانه انتخاب تاریخ
import DatePickerModule from 'react-multi-date-picker';

// تقویم شمسی و میلادی
import persianCalendar from 'react-date-object/calendars/persian';

// زبان افغانستان برای نمایش تقویم شمسی
import persianAfghanistan from '../../locales/persianAfghanistan';

import { formatNumber } from '../../utils/numberFormat';

import {
  normalizePersianText as normalizeSearch,
  toPersianDigits,
} from '../../utils/persianText';

import {
  getTodayGregorianDate as getLocalDate,
  toPersianDate as getPersianDateValue,
  toGregorianDate as convertToGregorianDate,
} from '../../utils/dateUtils';

// استخراج کامپوننت واقعی از خروجی کتابخانه تقویم
// پشتیبانی از حالت خروجی مستقیم و حالت خروجی دارای default
const DatePicker =
  DatePickerModule?.default?.default ??
  DatePickerModule?.default ??
  DatePickerModule;

// تنظیم مشترک قالب اعداد صفحه ورود کالا
const INVENTORY_NUMBER_OPTIONS = {
  locale: 'fa-AF',
  maximumFractionDigits: 2,
};

// دکمه‌های عملیاتی داخل پنجره تقویم
function InventoryDatePickerActions({
  DatePicker,
  onSelectToday,
  onConfirm,
}) {
  return (
    <div className="entry-date-picker-actions">

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
          // ابتدا تاریخ تأیید می‌شود و سپس تقویم بسته می‌شود.
          onConfirm();
          DatePicker?.closeCalendar?.();
        }}
      >
        تأیید
      </Button>

    </div>
  );
}

// قالب‌بندی مبلغ همراه با نماد ارز
function formatCurrency(value, currency) {

  if (value === null || value === undefined) {
    return '—';
  }

  const digits = currency?.minorUnitDigits ?? 2;

  const formattedValue = formatNumber(
    value,
    {
      ...INVENTORY_NUMBER_OPTIONS,
      maximumFractionDigits: digits,
    }
  );

  return `${formattedValue} ${currency?.symbol || currency?.code || ''}`;

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
    <Alert
      variant={isSuccess ? 'success' : 'danger'}
      className="entry-toast"
      role={isSuccess ? 'status' : 'alert'}
    >
      {toast.message}
    </Alert>
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

// گزینه‌های مجاز برای نوع ورود کالا
const INVENTORY_ENTRY_TYPE_OPTIONS = [
  {
    value: 'purchase',
    label: 'خرید',
  },
  {
    value: 'sales-return',
    label: 'برگشت از فروش',
  },
  {
    value: 'opening',
    label: 'موجودی اولیه',
  },
  {
    value: 'other',
    label: 'سایر',
  },
];


// انتخاب‌گر نوع ورود کالا با پشتیبانی از صفحه‌کلید
function EntryTypePicker({ value, onChange }) {

  const [isOpen, setIsOpen] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef(null);

  const triggerRef = useRef(null);

  const optionRefs = useRef([]);


  // پیدا کردن گزینه انتخاب‌شده فعلی
  const selectedIndex = INVENTORY_ENTRY_TYPE_OPTIONS.findIndex(
    (option) => option.value === value
  );

  const selectedOption =
    INVENTORY_ENTRY_TYPE_OPTIONS[selectedIndex] ||
    INVENTORY_ENTRY_TYPE_OPTIONS[0];


  // پس از بازشدن فهرست، فوکوس روی گزینه فعال قرار می‌گیرد.
  useEffect(() => {

    if (isOpen) {
      optionRefs.current[activeIndex]?.focus();
    }

  }, [isOpen, activeIndex]);


  // بستن فهرست با کلیک خارج از آن
  useEffect(() => {

    if (!isOpen) {
      return undefined;
    }


    function handleOutsideClick(event) {

      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }

    }


    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );


    return () => {

      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );

    };

  }, [isOpen]);


  // بازکردن فهرست با تمرکز روی گزینه فعلی
  function openPicker() {

    setActiveIndex(
      selectedIndex >= 0 ? selectedIndex : 0
    );

    setIsOpen(true);

  }


  // انتخاب گزینه
  function handleSelectOption(option, index) {

    onChange(option.value);

    setActiveIndex(index);

    setIsOpen(false);

    // پس از انتخاب، فوکوس به دکمه اصلی برمی‌گردد.
    triggerRef.current?.focus();

  }


  // مدیریت کلیدهای صفحه‌کلید
  function handleOptionKeyDown(event, index) {

    const lastIndex = INVENTORY_ENTRY_TYPE_OPTIONS.length - 1;

    let nextIndex;


    switch (event.key) {

      case 'ArrowDown':

        event.preventDefault();

        nextIndex = index === lastIndex ? 0 : index + 1;

        break;


      case 'ArrowUp':

        event.preventDefault();

        nextIndex = index === 0 ? lastIndex : index - 1;

        break;


      case 'Home':

        event.preventDefault();

        nextIndex = 0;

        break;


      case 'End':

        event.preventDefault();

        nextIndex = lastIndex;

        break;


      case 'Escape':

        event.preventDefault();

        setIsOpen(false);

        triggerRef.current?.focus();

        return;


      case ' ':
      case 'Enter':

        // انتخاب مستقیم گزینه فعال با Space یا Enter
        event.preventDefault();

        handleSelectOption(
          INVENTORY_ENTRY_TYPE_OPTIONS[index],
          index
        );

        return;

      default:
        return;

    }


    setActiveIndex(nextIndex);

  }


  return (

    <div
      className="entry-type-picker"
      ref={containerRef}
      onBlur={(event) => {

        // با خروج فوکوس از کل انتخاب‌گر، فهرست بسته می‌شود.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }

      }}
    >

      {/* دکمه اصلی انتخاب نوع ورود */}
      <button
        type="button"
        ref={triggerRef}
        className="entry-type-trigger"
        aria-label="نوع ورود کالا"
        aria-expanded={isOpen}
        onClick={() => {

          if (isOpen) {
            setIsOpen(false);
          } else {
            openPicker();
          }

        }}
        onKeyDown={(event) => {

          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp'
          ) {

            event.preventDefault();

            openPicker();

          }

          if (event.key === 'Escape') {
            setIsOpen(false);
          }

        }}
      >

        <span>{selectedOption.label}</span>

        <span className="entry-type-picker-arrow" aria-hidden="true">
          {isOpen ? '⌃' : '⌄'}
        </span>

      </button>


      {/* فهرست گزینه‌ها */}
      {isOpen && (

        <div
          className="entry-type-options"
          role="group"
          aria-label="گزینه‌های نوع ورود کالا"
        >

          {INVENTORY_ENTRY_TYPE_OPTIONS.map((option, index) => (

            <button
              key={option.value}
              type="button"
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              className="entry-type-option"
              aria-pressed={value === option.value}
              onClick={() =>
                handleSelectOption(option, index)
              }
              onKeyDown={(event) =>
                handleOptionKeyDown(event, index)
              }
            >

              <span>{option.label}</span>

              {value === option.value && (
                <span aria-hidden="true">✓</span>
              )}

            </button>

          ))}

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

  // تاریخ امروز بر اساس ساعت رسمی افغانستان
  const [todayDate, setTodayDate] = useState(getLocalDate);

  // تاریخ موقت؛ تا زمان تأیید نباید تاریخ اصلی سند تغییر کند.
  const [draftDocumentDate, setDraftDocumentDate] = useState(getLocalDate);

  // وضعیت باز یا بسته بودن تقویم
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // جلوگیری از بسته‌شدن تقویم هنگام انتخاب یک روز
  const keepCalendarOpenRef = useRef(false);

  // مشخص‌کردن دلیل بسته‌شدن تقویم
  const datePickerCloseReasonRef = useRef(null);

  const [sourcePartyName, setSourcePartyName] = useState('');

  const [sourceInvoiceNumber, setSourceInvoiceNumber] = useState('');

  const [reason, setReason] = useState('');

  const [notes, setNotes] = useState('');


  // اطلاعات واقعی محصولات، واحدها و ارزها
  const [formOptions, setFormOptions] = useState(null);

  // بارگذاری اولیه اطلاعات فرم
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // بررسی مجوز نوع سند بدون نمایش مجدد صفحه بارگذاری
  const [isCheckingEntryType, setIsCheckingEntryType] = useState(false);

  // مشخص می‌کند اطلاعات اولیه فرم قبلاً دریافت شده‌اند یا خیر
  const hasLoadedFormOptionsRef = useRef(false);

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

  // تبدیل تاریخ موقت میلادی به تاریخ شمسی برای تقویم
  const persianDraftDate = useMemo(
    () => getPersianDateValue(draftDocumentDate),
    [draftDocumentDate]
  );

  // حداکثر تاریخ قابل انتخاب در تقویم شمسی
  const persianMaxDate = useMemo(
    () => getPersianDateValue(todayDate),
    [todayDate]
  );


  // تاریخ قابل نمایش در فیلد اصلی
  const formattedDocumentDate = useMemo(() => {

    const persianDate = getPersianDateValue(documentDate);

    return persianDate
      ? persianDate.format('DD MMMM YYYY')
      : '';

  }, [documentDate]);

  // دریافت اطلاعات اولیه فرم و بررسی مجوز نوع سند
  useEffect(() => {

    let isCurrent = true;


    async function loadFormOptions() {

      try {

        // اگر کامپوننت دیگر فعال نیست، درخواست اجرا نشود.
        if (!isCurrent) {
          return;
        }

        const getEntryFormOptions =
          window.hesabyar?.inventory?.getEntryFormOptions;


        if (typeof getEntryFormOptions !== 'function') {
          throw new Error(
            'ارتباط با سرویس موجودی انبار برقرار نیست.'
          );
        }


        // دریافت پاسخ متناسب با نوع سند برای بررسی مجوز
        const result = await getEntryFormOptions(entryType);


        // بررسی اعتبار پاسخ سرویس
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


        // اطلاعات محصولات و ارزها فقط یک بار ذخیره می‌شوند.
        if (
          isCurrent &&
          !hasLoadedFormOptionsRef.current
        ) {

          setFormOptions(result);

          hasLoadedFormOptionsRef.current = true;

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

          setIsCheckingEntryType(false);

        }

      }

    }


    // اجرای درخواست در صف غیرهم‌زمان؛
    // تا داخل بدنه مستقیم useEffect تغییری در state انجام نشود.
    void Promise.resolve().then(loadFormOptions);


    // جلوگیری از تغییر وضعیت توسط درخواست‌های قدیمی
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

  // هنگام بازشدن تقویم، تاریخ موقت از تاریخ اصلی سند آغاز می‌شود.
  function handleDatePickerOpen() {

    keepCalendarOpenRef.current = false;

    datePickerCloseReasonRef.current = null;

    setDraftDocumentDate(
      documentDate || getLocalDate()
    );

    setIsDatePickerOpen(true);

  }


  // مدیریت بسته‌شدن تقویم
  function handleDatePickerClose() {
    // جلوگیری از بسته‌شدن خودکار تقویم هنگام انتخاب روز
    if (keepCalendarOpenRef.current) {

      keepCalendarOpenRef.current = false;

      return false;

    }


    // دریافت دلیل بسته‌شدن تقویم
    const closeReason = datePickerCloseReasonRef.current;

    datePickerCloseReasonRef.current = null;


    // تغییر وضعیت تقویم به بسته
    setIsDatePickerOpen(false);


    // اگر کاربر دکمه تأیید را زده باشد،
    // تاریخ قبلاً در تابع تأیید اعمال شده است.
    if (closeReason === 'confirm') {
      return;
    }


    // اگر کاربر بیرون تقویم کلیک کند،
    // تاریخ انتخاب‌شده موقت اعمال می‌شود.
    const selectedDate =
      draftDocumentDate ||
      documentDate ||
      getLocalDate();

    setDocumentDate(selectedDate);

  }

  // انتخاب تاریخ امروز در داخل تقویم
  function handleSelectTodayInCalendar() {

    const today = getLocalDate();

    setTodayDate(today);

    setDraftDocumentDate(today);

  }

  // تأیید تاریخ موقت
  function handleConfirmDate() {

    if (!draftDocumentDate) {
      return;
    }

    keepCalendarOpenRef.current = false;

    datePickerCloseReasonRef.current = 'confirm';

    setDocumentDate(draftDocumentDate);

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

    !isCheckingEntryType &&

    !loadError &&

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

      const today = getLocalDate();

      setDocumentDate(today);

      setDraftDocumentDate(today);

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


  // تلاش مجدد برای دریافت اطلاعات یا بررسی مجوز
  function handleRetryFormOptions() {

    setLoadError('');

    // اگر اطلاعات اولیه دریافت شده‌اند، فقط مجوز بررسی می‌شود.
    if (hasLoadedFormOptionsRef.current) {

      setIsCheckingEntryType(true);

    } else {

      // در غیر این صورت، بارگذاری اولیه دوباره انجام می‌شود.
      setIsLoadingOptions(true);

    }

    setReloadToken((previous) => previous + 1);

  }


  // تغییر نوع سند
  function handleEntryTypeChange(value) {

    if (value === entryType) {
      return;
    }

    // پاک‌کردن خطای قبلی در پاسخ به اقدام کاربر
    setLoadError('');

    // آغاز بررسی مجوز نوع جدید
    setIsCheckingEntryType(true);

    setEntryType(value);

  }

  // حالت دریافت اطلاعات
  if (isLoadingOptions && !formOptions) {

    return (

      <div className="inventory-entry">

        <div className="entry-load-state">
          در حال دریافت محصولات، واحدها و ارزهای فعال...
        </div>

      </div>

    );

  }


  // حالت بروز خطا در دریافت اطلاعات
  if (!formOptions) {

    return (

      <div className="inventory-entry">

        <div className="entry-load-error">

          <strong>دریافت اطلاعات فرم ناموفق بود.</strong>

          <p>
            {loadError || 'اطلاعات موردنیاز فرم در دسترس نیست.'}
          </p>

          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={handleRetryFormOptions}
          >
            تلاش مجدد
          </Button>

        </div>

      </div>

    );

  }


  return (

    <div className="inventory-entry">

      {/* نمایش خطا بدون حذف اطلاعات فعلی فرم */}
      {loadError && formOptions && (

        <div className="entry-feedback entry-feedback-error">

          <Alert
            variant="danger"
            role="alert"
            className="entry-feedback__alert"
          >
            {loadError}
          </Alert>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={handleRetryFormOptions}
          >
            تلاش مجدد
          </Button>

        </div>

      )}

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


          <div className="entry-field">

            <span>
              {entryType === 'opening'
                ? 'تاریخ مبنای موجودی'
                : 'تاریخ ورود'}
            </span>


            <div className="entry-date-picker-wrapper">

              <DatePicker

                // تاریخ موقت به تقویم داده می‌شود، نه تاریخ اصلی سند
                value={persianDraftDate}

                // جلوگیری از انتخاب روزهای بعد از امروز
                maxDate={persianMaxDate}

                // انتخاب روز فقط تاریخ موقت را تغییر می‌دهد
                onChange={(selectedDate) => {

                  if (!selectedDate) {
                    return;
                  }

                  keepCalendarOpenRef.current = true;

                  setDraftDocumentDate(
                    convertToGregorianDate(selectedDate)
                  );

                }}


                // مدیریت باز و بسته شدن پنجره تقویم
                onOpen={handleDatePickerOpen}

                onClose={handleDatePickerClose}


                // دکمه‌های عملیاتی داخل خود تقویم
                plugins={[
                  <InventoryDatePickerActions
                    key="inventory-date-picker-actions"
                    position="bottom"
                    onSelectToday={handleSelectTodayInCalendar}
                    onConfirm={handleConfirmDate}
                  />,
                ]}


                calendar={persianCalendar}

                locale={persianAfghanistan}

                format="DD MMMM YYYY"

                calendarPosition="bottom-right"

                weekStartDayIndex={0}

                editable={false}


                // نمایش تاریخ تأییدشده؛ نه تاریخ موقت
                render={(_value, openCalendar) => (

                  <input
                    id="entry-document-date"
                    type="text"
                    className="entry-date-picker-input"
                    value={formattedDocumentDate}
                    onFocus={openCalendar}
                    readOnly
                    autoComplete="off"
                    placeholder="روز، ماه و سال"
                    aria-label="انتخاب تاریخ ورود کالا"
                    aria-haspopup="dialog"
                    aria-expanded={isDatePickerOpen}
                  />

                )}


                containerClassName="entry-date-picker-container"

              />

            </div>

          </div>


          <div className="entry-field entry-field-full">

            <span>نوع ورود کالا</span>

            <EntryTypePicker
              value={entryType}
              onChange={handleEntryTypeChange}
            />

          </div>

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
              {formatNumber(
                items.length,
                INVENTORY_NUMBER_OPTIONS
              )} ردیف
            </span>


            {/* دکمه افزودن کالا در بالای فهرست */}
            <Button
              type="button"
              variant="secondary"
              startIcon="＋"
              onClick={addItemRow}
            >
              افزودن کالا
            </Button>

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

            <Button
              type="button"
              variant="primary"
              onClick={addItemRow}
            >
              افزودن اولین کالا
            </Button>

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
                          {formatNumber(
                            index + 1,
                            INVENTORY_NUMBER_OPTIONS
                          )}
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
                                {
                                  ...INVENTORY_NUMBER_OPTIONS,
                                  maximumFractionDigits: 6,
                                }
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
                                  {
                                    ...INVENTORY_NUMBER_OPTIONS,
                                    maximumFractionDigits:
                                      product.baseQuantityDecimalPlaces ?? 2,
                                  }
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

                          <Button
                            type="button"
                            variant="danger"
                            size="small"
                            iconOnly
                            className="entry-remove-item-button"
                            onClick={() => removeItemRow(item.id)}
                            title="حذف این ردیف"
                            aria-label={`حذف ردیف $DIL3`}
                          >
                            ×
                          </Button>

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

              <Button
                type="button"
                variant="secondary"
                startIcon="＋"
                onClick={addItemRow}
              >
                افزودن کالای دیگر
              </Button>

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
              {formatNumber(
                items.length,
                INVENTORY_NUMBER_OPTIONS
              )}
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

          <Button
            type="button"
            variant="primary"
            disabled
            title="ثبت نهایی سند در مرحله بعد پیاده‌سازی می‌شود."
          >
            ثبت نهایی سند
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={isSaving}
            onClick={handleSaveDraft}
            disabled={!canSaveDraft}
          >
            {isSaving
              ? 'در حال ذخیره...'
              : 'ذخیره پیش‌نویس'}
          </Button>
        </div>

      </section>


      {/* اعلان شناور پایین چپ صفحه */}
      <EntryToast toast={toast} />

    </div>

  );

}


export default InventoryEntry;