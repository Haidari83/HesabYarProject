import { useMemo, useState } from 'react';
import './product-form-modal.css';

// ساخت شناسه موقت برای ردیف‌های واحد فرعی
let unitRowSequence = 0;

function createUnitOption(unitKind) {
  unitRowSequence += 1;

  return {
    rowId: `product-unit-${unitRowSequence}`,
    unitKind,
    unitId: '',
    inputDecimalPlaces: '0',
    conversionNum: '1',
    conversionDen: '1',
  };
}

// تبدیل ارقام فارسی و عربی به انگلیسی
function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    )
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .trim();
}

// بررسی تعداد ارقام اعشار
function isValidDecimalPlaces(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 6
  );
}

// بررسی قیمت واردشده
function isValidPrice(value) {
  return /^\d+(?:\.\d{1,6})?$/.test(
    normalizeDigits(value)
  );
}

// نمایش انتخاب دقت اعشاری
function DecimalPlacesSelect({
  label,
  value,
  onChange,
}) {
  return (
    <label className="product-form-field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {Array.from({ length: 7 }, (_, index) => (
          <option key={index} value={String(index)}>
            {index} رقم اعشار
          </option>
        ))}
      </select>
    </label>
  );
}

function ProductFormModal({
  categories,
  units,
  currencies,
  onClose,
  onCreated,
}) {
  // اطلاعات اصلی کالا
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // اطلاعات واحد پایه
  const [baseUnitId, setBaseUnitId] = useState('');
  const [baseQuantityDecimalPlaces, setBaseQuantityDecimalPlaces] =
    useState('0');
  const [baseInputDecimalPlaces, setBaseInputDecimalPlaces] =
    useState('0');

  // واحدهای فرعی و بسته‌بندی
  const [unitOptions, setUnitOptions] = useState([]);

  // قیمت‌ها به تفکیک واحد و ارز
  const [priceValues, setPriceValues] = useState({});

  // وضعیت ثبت
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // اطلاعات واحد پایه انتخاب‌شده
  const selectedBaseUnit = useMemo(
    () => units.find((unit) => unit.id === baseUnitId) || null,
    [units, baseUnitId]
  );

  // واحدهای قابل انتخاب برای هر ردیف
  function getAvailableUnits(option) {
    if (!selectedBaseUnit) return [];

    const usedUnitIds = new Set(
      unitOptions
        .filter((item) => item.rowId !== option.rowId)
        .map((item) => item.unitId)
        .filter(Boolean)
    );

    return units.filter((unit) => {
      if (
        unit.id === baseUnitId ||
        usedUnitIds.has(unit.id)
      ) {
        return false;
      }

      if (option.unitKind === 'standard') {
        return (
          unit.unitKind === 'standard' &&
          unit.dimensionCode === selectedBaseUnit.dimensionCode
        );
      }

      return unit.unitKind === 'package';
    });
  }

  // انتخاب واحد پایه
  function handleBaseUnitChange(unitId) {
    const nextBaseUnit = units.find(
      (unit) => unit.id === unitId
    );

    setBaseUnitId(unitId);
    setFormError('');

    if (!nextBaseUnit) return;

    // تنظیم دقت ورود بر اساس تنظیم پیش‌فرض واحد انتخاب‌شده
    setBaseInputDecimalPlaces(
      String(nextBaseUnit.defaultDecimalPlaces)
    );

    // با تغییر بُعد واحد پایه، واحدهای استاندارد ناسازگار حذف می‌شوند
    const incompatibleRows = unitOptions.filter((option) => {
      const unit = units.find(
        (item) => item.id === option.unitId
      );

      return (
        unit?.unitKind === 'standard' &&
        unit.dimensionCode !== nextBaseUnit.dimensionCode
      );
    });

    const removedUnitIds = new Set(
      incompatibleRows.map((option) => option.unitId)
    );

    setUnitOptions((previous) =>
      previous.filter((option) => {
        const unit = units.find(
          (item) => item.id === option.unitId
        );

        return (
          !unit ||
          unit.unitKind === 'package' ||
          unit.dimensionCode === nextBaseUnit.dimensionCode
        );
      })
    );

    // قیمت‌های واحدهایی که دیگر معتبر نیستند کنار گذاشته می‌شوند
    if (removedUnitIds.size > 0) {
      setPriceValues((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => {
            const unitIdFromKey = key.split('::')[0];
            return !removedUnitIds.has(unitIdFromKey);
          })
        )
      );

      setFormError(
        'واحدهای استاندارد ناسازگار با واحد پایه جدید حذف شدند.'
      );
    }
  }

  // افزودن واحد استاندارد یا بسته‌بندی
  function addUnitOption(unitKind) {
    if (!baseUnitId) {
      setFormError('ابتدا واحد پایه کالا را انتخاب کن.');
      return;
    }

    setUnitOptions((previous) => [
      ...previous,
      createUnitOption(unitKind),
    ]);

    setFormError('');
  }

  // تغییر مشخصات یک واحد فرعی
  function updateUnitOption(rowId, changes) {
    setUnitOptions((previous) =>
      previous.map((option) => {
        if (option.rowId !== rowId) return option;

        const nextOption = {
          ...option,
          ...changes,
        };

        // هنگام انتخاب واحد، دقت پیش‌فرض آن تنظیم می‌شود
        if (Object.hasOwn(changes, 'unitId')) {
          const selectedUnit = units.find(
            (unit) => unit.id === changes.unitId
          );

          nextOption.inputDecimalPlaces = String(
            selectedUnit?.defaultDecimalPlaces ?? 0
          );
        }

        return nextOption;
      })
    );

    setFormError('');
  }

  // حذف واحد فرعی
  function removeUnitOption(rowId) {
    setUnitOptions((previous) =>
      previous.filter((option) => option.rowId !== rowId)
    );

    setFormError('');
  }

  // تغییر قیمت یک واحد و ارز
  function updatePrice(unitId, currencyCode, priceType, value) {
    const key = `${unitId}::${currencyCode}`;

    setPriceValues((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] || {}),
        [priceType]: value,
      },
    }));

    setFormError('');
  }

  // آماده‌سازی واحدهای قابل قیمت‌گذاری
  const priceRows = useMemo(() => {
    if (!selectedBaseUnit) return [];

    const rows = [
      {
        unitId: selectedBaseUnit.id,
        unitName: selectedBaseUnit.name,
        unitSymbol: selectedBaseUnit.symbol,
        isBaseUnit: true,
      },
    ];

    for (const option of unitOptions) {
      const unit = units.find(
        (item) => item.id === option.unitId
      );

      if (!unit) continue;

      rows.push({
        unitId: unit.id,
        unitName: unit.name,
        unitSymbol: unit.symbol,
        isBaseUnit: false,
      });
    }

    return rows;
  }, [selectedBaseUnit, unitOptions, units]);

  // اعتبارسنجی و ثبت کالا
  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    setFormError('');

    // بررسی اطلاعات اصلی
    if (!name.trim()) {
      setFormError('نام کالا را وارد کن.');
      return;
    }

    if (name.trim().length > 150) {
      setFormError('نام کالا نمی‌تواند بیشتر از ۱۵۰ نویسه باشد.');
      return;
    }

    if (!categories.some((item) => item.id === categoryId)) {
      setFormError('یک دسته‌بندی فعال انتخاب کن.');
      return;
    }

    // بررسی واحد پایه
    if (
      !selectedBaseUnit ||
      selectedBaseUnit.unitKind !== 'standard'
    ) {
      setFormError('واحد پایه باید از میان واحدهای استاندارد انتخاب شود.');
      return;
    }

    // دقت مقدار پایه و دقت ورود آن مستقل هستند
    if (
      !isValidDecimalPlaces(baseQuantityDecimalPlaces) ||
      !isValidDecimalPlaces(baseInputDecimalPlaces)
    ) {
      setFormError('دقت اعشاری واحد پایه معتبر نیست.');
      return;
    }

    // هیچ ردیف نیمه‌کاره‌ای نباید ثبت شود
    if (unitOptions.some((option) => !option.unitId)) {
      setFormError('واحدهای فرعی انتخاب‌نشده را تکمیل یا حذف کن.');
      return;
    }

    // بررسی تکراری نبودن واحدهای فرعی
    const selectedUnitIds = unitOptions.map(
      (option) => option.unitId
    );

    if (new Set(selectedUnitIds).size !== selectedUnitIds.length) {
      setFormError('یک واحد بیش از یک بار انتخاب شده است.');
      return;
    }

    // ساخت اطلاعات واحدهای فرعی مطابق قرارداد backend
    const preparedUnitOptions = [];

    for (const option of unitOptions) {
      const unit = units.find(
        (item) => item.id === option.unitId
      );

      if (!unit) {
        setFormError('یکی از واحدهای انتخاب‌شده معتبر نیست.');
        return;
      }

      if (!isValidDecimalPlaces(option.inputDecimalPlaces)) {
        setFormError(
          `دقت ورود واحد «${unit.name}» باید بین صفر تا شش باشد.`
        );
        return;
      }

      const preparedOption = {
        unitId: unit.id,
        inputDecimalPlaces: Number(option.inputDecimalPlaces),
      };

      if (unit.unitKind === 'standard') {
        if (
          unit.dimensionCode !== selectedBaseUnit.dimensionCode
        ) {
          setFormError(
            `واحد استاندارد «${unit.name}» با واحد پایه هم‌بُعد نیست.`
          );
          return;
        }
      } else {
        const numerator = Number(option.conversionNum);
        const denominator = Number(option.conversionDen);

        if (
          !Number.isSafeInteger(numerator) ||
          numerator <= 0 ||
          !Number.isSafeInteger(denominator) ||
          denominator <= 0
        ) {
          setFormError(
            `ضریب تبدیل واحد بسته‌بندی «${unit.name}» باید شامل دو عدد صحیح مثبت باشد.`
          );
          return;
        }

        preparedOption.conversionNum = numerator;
        preparedOption.conversionDen = denominator;
      }

      preparedUnitOptions.push(preparedOption);
    }

    // جمع‌آوری قیمت‌های واردشده
    const preparedPrices = [];

    for (const row of priceRows) {
      for (const currency of currencies) {
        const key = `${row.unitId}::${currency.code}`;
        const values = priceValues[key] || {};

        for (const priceType of ['purchase', 'sale']) {
          const rawValue = values[priceType] ?? '';

          // قیمت خالی به معنی ثبت‌نشدن آن است
          if (rawValue.trim() === '') continue;

          const normalizedValue = normalizeDigits(rawValue);

          if (!isValidPrice(normalizedValue)) {
            const typeLabel =
              priceType === 'purchase' ? 'خرید' : 'فروش';

            setFormError(
              `قیمت ${typeLabel} «${row.unitName}» به ارز ${currency.code} معتبر نیست. حداکثر شش رقم اعشار مجاز است.`
            );

            return;
          }

          preparedPrices.push({
            unitId: row.unitId,
            currencyCode: currency.code,
            priceType,
            unitPrice: normalizedValue,
          });
        }
      }
    }

    // داده نهایی مطابق ورودی مورد انتظار productService
    const payload = {
      name: name.trim(),
      categoryId,
      baseUnitId,
      baseQuantityDecimalPlaces: Number(
        baseQuantityDecimalPlaces
      ),
      baseInputDecimalPlaces: Number(
        baseInputDecimalPlaces
      ),
      unitOptions: preparedUnitOptions,
      prices: preparedPrices,
    };

    setIsSaving(true);

    try {
      const createProduct =
        window.hesabyar?.products?.create;

      if (typeof createProduct !== 'function') {
        throw new Error(
          'سرویس ثبت کالا در دسترس نیست.'
        );
      }

      // ثبت محصول در Main Process و پایگاه داده SQLite
      const createdProduct = await createProduct(payload);

      if (!createdProduct?.id) {
        throw new Error(
          'پاسخ سرویس ثبت کالا معتبر نیست.'
        );
      }

      onCreated(createdProduct);
    } catch (error) {
      setFormError(
        error.message || 'ثبت کالا ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="product-form-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="product-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <header className="product-form-header">
          <div>
            <h2 id="product-form-title">ثبت کالای جدید</h2>
            <p>
              مشخصات پایه، واحدها و قیمت‌های کالا را وارد کن.
            </p>
          </div>

          <button
            type="button"
            className="product-form-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="بستن فرم"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="product-form-body">

            {/* بخش اول: اطلاعات اصلی کالا */}
            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>۱</span>
                <div>
                  <h3>اطلاعات اصلی</h3>
                  <p>نام و دسته‌بندی کالا را مشخص کن.</p>
                </div>
              </div>

              <div className="product-form-grid">
                <label className="product-form-field">
                  <span>نام کالا *</span>

                  <input
                    type="text"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setFormError('');
                    }}
                    maxLength={150}
                    placeholder="مثلاً برنج پاکستانی"
                    autoFocus
                  />
                </label>

                <label className="product-form-field">
                  <span>دسته‌بندی *</span>

                  <select
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setFormError('');
                    }}
                  >
                    <option value="">انتخاب دسته‌بندی</option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {categories.length === 0 && (
                <p className="product-form-inline-warning">
                  ابتدا باید حداقل یک دسته‌بندی فعال ثبت شود.
                </p>
              )}
            </section>

            {/* بخش دوم: واحد پایه */}
            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>۲</span>
                <div>
                  <h3>واحد پایه کالا</h3>
                  <p>
                    تمام مقدارهای انبار در نهایت بر اساس این واحد
                    محاسبه خواهند شد.
                  </p>
                </div>
              </div>

              <div className="product-form-grid">
                <label className="product-form-field">
                  <span>واحد پایه *</span>

                  <select
                    value={baseUnitId}
                    onChange={(event) =>
                      handleBaseUnitChange(event.target.value)
                    }
                  >
                    <option value="">انتخاب واحد پایه</option>

                    {units
                      .filter((unit) => unit.unitKind === 'standard')
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                          {unit.symbol ? ` (${unit.symbol})` : ''}
                        </option>
                      ))}
                  </select>
                </label>

                <DecimalPlacesSelect
                  label="دقت اعشاری مقدار پایه *"
                  value={baseQuantityDecimalPlaces}
                  onChange={setBaseQuantityDecimalPlaces}
                />

                <DecimalPlacesSelect
                  label="دقت ورود با واحد پایه *"
                  value={baseInputDecimalPlaces}
                  onChange={setBaseInputDecimalPlaces}
                />
              </div>

              <p className="product-form-help">
                دقت مقدار پایه، دقت ذخیره مقدار کالا بر حسب واحد پایه
                است؛ دقت ورود فقط تعداد ارقام مجاز هنگام واردکردن مقدار
                با واحد پایه را تعیین می‌کند.
              </p>

              {units.filter((unit) => unit.unitKind === 'standard').length === 0 && (
                <p className="product-form-inline-warning">
                  هیچ واحد استاندارد فعالی وجود ندارد.
                </p>
              )}
            </section>

            {/* بخش سوم: واحدهای فرعی و بسته‌بندی */}
            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>۳</span>
                <div>
                  <h3>واحدهای دیگر کالا</h3>
                  <p>
                    در صورت نیاز، واحد استاندارد هم‌بُعد یا واحد
                    بسته‌بندی اختصاصی کالا را اضافه کن.
                  </p>
                </div>
              </div>

              <div className="product-form-unit-actions">
                <button
                  type="button"
                  onClick={() => addUnitOption('standard')}
                  disabled={!selectedBaseUnit}
                >
                  افزودن واحد استاندارد
                </button>

                <button
                  type="button"
                  onClick={() => addUnitOption('package')}
                  disabled={!selectedBaseUnit}
                >
                  افزودن واحد بسته‌بندی
                </button>
              </div>

              {!selectedBaseUnit && (
                <p className="product-form-help">
                  برای افزودن واحدهای دیگر، ابتدا واحد پایه را انتخاب کن.
                </p>
              )}

              {unitOptions.length === 0 && (
                <div className="product-form-empty-units">
                  واحد فرعی یا بسته‌بندی اضافه نشده است.
                </div>
              )}

              {unitOptions.map((option, index) => {
                const availableUnits = getAvailableUnits(option);
                const selectedUnit = units.find(
                  (unit) => unit.id === option.unitId
                );

                return (
                  <div
                    className="product-form-unit-row"
                    key={option.rowId}
                  >
                    <div className="product-form-unit-row-heading">
                      <strong>
                        {option.unitKind === 'standard'
                          ? 'واحد استاندارد'
                          : 'واحد بسته‌بندی'}
                        {' '}
                        {index + 1}
                      </strong>

                      <button
                        type="button"
                        onClick={() => removeUnitOption(option.rowId)}
                      >
                        حذف
                      </button>
                    </div>

                    <div className="product-form-grid">
                      <label className="product-form-field">
                        <span>انتخاب واحد *</span>

                        <select
                          value={option.unitId}
                          onChange={(event) =>
                            updateUnitOption(option.rowId, {
                              unitId: event.target.value,
                            })
                          }
                        >
                          <option value="">انتخاب واحد</option>

                          {availableUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name}
                              {unit.symbol ? ` (${unit.symbol})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      <DecimalPlacesSelect
                        label="دقت ورود مقدار"
                        value={option.inputDecimalPlaces}
                        onChange={(value) =>
                          updateUnitOption(option.rowId, {
                            inputDecimalPlaces: value,
                          })
                        }
                      />
                    </div>

                    {selectedUnit?.unitKind === 'package' && (
                      <>
                        <p className="product-form-help">
                          مقدار این بسته را بر حسب واحد پایه مشخص کن.
                          مثلاً اگر یک کارتن شامل ۱۲ عدد است، نسبت ۱۲ به ۱
                          خواهد بود.
                        </p>

                        <div className="product-form-ratio">
                          <label className="product-form-field">
                            <span>صورت ضریب تبدیل *</span>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={option.conversionNum}
                              onChange={(event) =>
                                updateUnitOption(option.rowId, {
                                  conversionNum: event.target.value,
                                })
                              }
                            />
                          </label>

                          <span className="product-form-ratio-divider">
                            /
                          </span>

                          <label className="product-form-field">
                            <span>مخرج ضریب تبدیل *</span>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={option.conversionDen}
                              onChange={(event) =>
                                updateUnitOption(option.rowId, {
                                  conversionDen: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      </>
                    )}

                    {selectedUnit?.unitKind === 'standard' && (
                      <p className="product-form-help">
                        نسبت این واحد به واحد پایه از تعریف استاندارد
                        واحدهای اندازه‌گیری محاسبه می‌شود.
                      </p>
                    )}

                    {option.unitId && availableUnits.length === 0 && (
                      <p className="product-form-inline-warning">
                        واحد دیگری از این نوع برای انتخاب باقی نمانده است.
                      </p>
                    )}
                  </div>
                );
              })}
            </section>

            {/* بخش چهارم: قیمت‌گذاری */}
            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>۴</span>
                <div>
                  <h3>قیمت‌گذاری</h3>
                  <p>
                    قیمت خرید و فروش هر واحد را به تفکیک ارز وارد کن.
                  </p>
                </div>
              </div>

              <p className="product-form-help">
                واردکردن قیمت الزامی نیست. قیمت‌های خالی ذخیره نمی‌شوند.
                برای اعشار از نقطه استفاده کن؛ مانند ۱۲۵.۵.
              </p>

              {priceRows.length > 0 && currencies.length > 0 ? (
                <div className="product-form-price-table-wrapper">
                  <table className="product-form-price-table">
                    <thead>
                      <tr>
                        <th>واحد</th>
                        <th>ارز</th>
                        <th>قیمت خرید</th>
                        <th>قیمت فروش</th>
                      </tr>
                    </thead>

                    <tbody>
                      {priceRows.flatMap((row) =>
                        currencies.map((currency) => {
                          const key =
                            `${row.unitId}::${currency.code}`;

                          const values = priceValues[key] || {};

                          return (
                            <tr key={key}>
                              <td>
                                <strong>{row.unitName}</strong>

                                <small>
                                  {row.isBaseUnit
                                    ? 'واحد پایه'
                                    : row.unitSymbol || 'واحد فرعی'}
                                </small>
                              </td>

                              <td>
                                <strong>{currency.code}</strong>

                                <small>{currency.name}</small>
                              </td>

                              <td>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="قیمت خرید"
                                  value={values.purchase || ''}
                                  onChange={(event) =>
                                    updatePrice(
                                      row.unitId,
                                      currency.code,
                                      'purchase',
                                      event.target.value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="قیمت فروش"
                                  value={values.sale || ''}
                                  onChange={(event) =>
                                    updatePrice(
                                      row.unitId,
                                      currency.code,
                                      'sale',
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="product-form-empty-units">
                  ابتدا واحد پایه را انتخاب کن تا جدول قیمت‌گذاری نمایش داده شود.
                </div>
              )}
            </section>

            {formError && (
              <div className="product-form-error-message">
                {formError}
              </div>
            )}
          </div>

          <footer className="product-form-footer">
            <button
              type="button"
              className="product-form-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              انصراف
            </button>

            <button
              type="submit"
              className="product-form-submit"
              disabled={isSaving || categories.length === 0}
            >
              {isSaving ? 'در حال ثبت...' : 'ثبت کالا'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ProductFormModal;