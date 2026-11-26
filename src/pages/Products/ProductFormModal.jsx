import { useMemo, useState } from 'react';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';

import './product-form-modal.css';

// ساخت شناسه موقت برای ردیف‌های واحد فرعی
let unitRowSequence = 0;

function createUnitOption(unitKind) {
  unitRowSequence += 1;

  return {
    rowId: `product-unit-${unitRowSequence}`,
    unitKind,
    unitId: '',
    conversionNum: '1',
    conversionDen: '1',
  };
}

function ProductFormModal({
  categories,
  units,
  onClose,
  onCreated,
  product = null,
  onUpdated,
}) {
  // تعیین حالت فرم: ثبت محصول یا ویرایش محصول
  const isEditMode = Boolean(product);

  // مقداردهی اولیه اطلاعات محصول در حالت ویرایش
  const [name, setName] = useState(
    () => product?.name || ''
  );

  const [categoryId, setCategoryId] = useState(
    () => product?.categoryId || ''
  );

  // مقداردهی اولیه واحد پایه
  const [baseUnitId, setBaseUnitId] = useState(
    () => product?.baseUnitId || ''
  );

  // بازیابی واحدهای فرعی محصول برای نمایش در فرم ویرایش
  const [unitOptions, setUnitOptions] = useState(() => {
    const existingUnits = Array.isArray(product?.units)
      ? product.units
      : [];

    return existingUnits
      .filter((unit) => !unit.isBaseUnit)
      .map((unit) => ({
        ...createUnitOption(unit.unitKind),

        unitId: unit.unitId,

        conversionNum: String(
          unit.conversionNum ?? 1
        ),

        conversionDen: String(
          unit.conversionDen ?? 1
        ),
      }));
  });

  // وضعیت ثبت و ویرایش
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

    // شناسایی واحدهای استاندارد ناسازگار با واحد پایه جدید
    const incompatibleRows = unitOptions.filter((option) => {
      const unit = units.find(
        (item) => item.id === option.unitId
      );

      return (
        unit?.unitKind === 'standard' &&
        unit.dimensionCode !== nextBaseUnit.dimensionCode
      );
    });

    // حذف واحدهای استاندارد ناسازگار
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

    // اطلاع‌رسانی درباره حذف واحدهای ناسازگار
    if (incompatibleRows.length > 0) {
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
      previous.map((option) =>
        option.rowId === rowId
          ? {
            ...option,
            ...changes,
          }
          : option
      )
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

      const preparedOption = {
        unitId: unit.id,
        inputDecimalPlaces: 2,
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

    // آماده‌سازی اطلاعات کالا بدون ثبت قیمت
    const payload = {
      name: name.trim(),
      categoryId,
      baseUnitId,
      baseQuantityDecimalPlaces: 2,
      baseInputDecimalPlaces: 2,
      unitOptions: preparedUnitOptions,

      // آرایه خالی برای سازگاری با قرارداد سرویس ثبت کالا
      prices: [],
    };

    setIsSaving(true);

    try {
      // دریافت APIهای مدیریت محصولات
      const productApi = window.hesabyar?.products;

      // انتخاب سرویس مناسب بر اساس حالت فرم
      const saveProduct = isEditMode
        ? productApi?.update
        : productApi?.create;

      if (typeof saveProduct !== 'function') {
        throw new Error(
          'سرویس ذخیره اطلاعات محصول در دسترس نیست.'
        );
      }

      // اجرای عملیات ثبت یا ویرایش
      const savedProduct = isEditMode
        ? await saveProduct(product.id, payload)
        : await saveProduct(payload);

      if (!savedProduct?.id) {
        throw new Error(
          'پاسخ سرویس ذخیره محصول معتبر نیست.'
        );
      }

      // ارسال نتیجه به صفحه محصولات
      if (isEditMode) {
        onUpdated(savedProduct);
      } else {
        onCreated(savedProduct);
      }

    } catch (error) {
      setFormError(
        error.message || 'ذخیره اطلاعات محصول ناموفق بود.'
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
            <h2 id="product-form-title">
              {isEditMode ? 'ویرایش محصول' : 'ثبت کالای جدید'}
            </h2>

            <p>
              مشخصات اصلی و واحدهای اندازه‌گیری کالا را وارد کن.            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="small"
            iconOnly
            onClick={onClose}
            disabled={isSaving}
            aria-label="بستن فرم"
          >
            ×
          </Button>
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
                <FormField
                  className="product-form-field"
                  label="نام کالا *"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => {
                      // به‌روزرسانی نام کالا و پاک‌کردن خطای قبلی فرم
                      setName(event.target.value);
                      setFormError('');
                    }}
                    maxLength={150}
                    placeholder="مثلاً برنج پاکستانی"
                    autoFocus
                  />
                </FormField>

                <label className="product-form-field">

                  <FormField
                    className="product-form-field"
                    label="دسته‌بندی *"
                  >
                    <select
                      value={categoryId}
                      onChange={(event) => {
                        // ثبت دسته‌بندی انتخاب‌شده
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
                          {category.isActive === false
                            ? ' (غیرفعال؛ دسته‌بندی فعلی)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>
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
                <FormField
                  className="product-form-field"
                  label="واحد پایه *"
                >
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
                </FormField>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => addUnitOption('standard')}
                  disabled={!selectedBaseUnit}
                >
                  افزودن واحد استاندارد
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => addUnitOption('package')}
                  disabled={!selectedBaseUnit}
                >
                  افزودن واحد بسته‌بندی
                </Button>
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

                      <Button
                        type="button"
                        variant="danger"
                        size="small"
                        onClick={() => removeUnitOption(option.rowId)}
                      >
                        حذف
                      </Button>
                    </div>

                    <div className="product-form-grid">
                      <FormField
                        className="product-form-field"
                        label="انتخاب واحد *"
                      >
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
                      </FormField>
                    </div>

                    {selectedUnit?.unitKind === 'package' && (
                      <>
                        <p className="product-form-help">
                          مقدار این بسته را بر حسب واحد پایه مشخص کن.
                          مثلاً اگر یک کارتن شامل ۱۲ عدد است، نسبت ۱۲ به ۱
                          خواهد بود.
                        </p>

                        <div className="product-form-ratio">
                          <FormField
                            className="product-form-field"
                            label="صورت ضریب تبدیل *"
                          >
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
                              required
                            />
                          </FormField>

                          <span className="product-form-ratio-divider">
                            /
                          </span>

                          <FormField
                            className="product-form-field"
                            label="مخرج ضریب تبدیل *"
                          >
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
                              required
                            />
                          </FormField>
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

            {formError && (
              <Alert
                variant="danger"
                role="alert"
                className="product-form-error-message"
              >
                {formError}
              </Alert>
            )}
          </div>

          <footer className="product-form-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              انصراف
            </Button>

            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
              disabled={categories.length === 0}
            >
              {isSaving
                ? 'در حال ذخیره...'
                : isEditMode
                  ? 'ذخیره تغییرات'
                  : 'ثبت کالا'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ProductFormModal;