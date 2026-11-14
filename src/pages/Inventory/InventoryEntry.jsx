
import { useMemo, useRef, useState } from 'react';

import { useBusinessData } from '../../context/BusinessDataContext';

import './inventory-entry.css';


// قالب‌بندی اعداد با ارقام فارسی
function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === '') {
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


// پیدا کردن واحدهای قابل استفاده برای یک کالا
function getProductUnitOptions(product, units, unitConversions) {

  const baseUnit = units.find(
    (unit) => unit.id === product.unitId
  );

  // اگر واحد اصلی کالا پیدا نشود، امکان انتخاب واحد وجود ندارد
  if (!baseUnit) {
    return [];
  }

  // واحد اصلی همیشه در فهرست باقی می‌ماند
  const compatibleUnitIds = new Set([baseUnit.id]);

  // فقط تبدیل‌های مستقیم به واحد اصلی یا از واحد اصلی پذیرفته می‌شوند
  unitConversions.forEach((conversion) => {

    if (conversion.fromUnitId === baseUnit.id) {
      compatibleUnitIds.add(conversion.toUnitId);
    }

    if (conversion.toUnitId === baseUnit.id) {
      compatibleUnitIds.add(conversion.fromUnitId);
    }

  });

  const otherUnits = units.filter(
    (unit) =>
      compatibleUnitIds.has(unit.id) &&
      unit.id !== baseUnit.id &&
      unit.dimension === baseUnit.dimension &&
      unit.isActive
  );

  return [baseUnit, ...otherUnits];
}


// پیدا کردن تبدیل میان واحد انتخاب‌شده و واحد اصلی
function getUnitConversion(baseUnitId, selectedUnitId, unitConversions) {

  if (baseUnitId === selectedUnitId) {
    return null;
  }

  return unitConversions.find(
    (conversion) =>
      (
        conversion.fromUnitId === baseUnitId &&
        conversion.toUnitId === selectedUnitId
      ) ||
      (
        conversion.fromUnitId === selectedUnitId &&
        conversion.toUnitId === baseUnitId
      )
  ) || null;
}


// تبدیل مقدار واردشده به واحد اصلی کالا
function convertToBaseUnit(
  quantity,
  baseUnitId,
  selectedUnitId,
  conversion
) {

  if (
    quantity === '' ||
    !Number.isFinite(Number(quantity)) ||
    !conversion
  ) {
    return null;
  }

  const value = Number(quantity);

  if (selectedUnitId === baseUnitId) {
    return value;
  }

  // اگر یک واحد اصلی برابر چند واحد انتخاب‌شده باشد
  if (
    conversion.fromUnitId === baseUnitId &&
    conversion.toUnitId === selectedUnitId
  ) {
    return value / conversion.factor;
  }

  // اگر یک واحد انتخاب‌شده برابر چند واحد اصلی باشد
  if (
    conversion.fromUnitId === selectedUnitId &&
    conversion.toUnitId === baseUnitId
  ) {
    return value * conversion.factor;
  }

  return null;
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
                  قیمت ثبت‌شده: {formatNumber(product.purchasePrice)}
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

  const {
    products,
    units,
    unitConversions,
  } = useBusinessData();


  // انتخاب نوع ورود کالا
  const [entryType, setEntryType] = useState('purchase');


  // ردیف‌های اقلام ورودی
  const [items, setItems] = useState([]);


  // تولید شناسه مستقل برای هر ردیف
  const nextItemId = useRef(1);


  // فقط کالاهای فعال قابل انتخاب هستند
  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );


  // افزودن ردیف جدید
  function addItemRow() {

    const newItem = {
      id: nextItemId.current++,
      productId: '',
      productSearch: '',
      unitId: '',
      quantity: '',
      unitPrice: '',
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
      unitId: '',
      quantity: '',
      unitPrice: '',
    });

  }


  // انتخاب کالا
  function handleProductSelect(rowId, product) {

    updateItem(rowId, {
      productId: product.id,
      productSearch: product.name,
      unitId: product.unitId,
      quantity: '',
      unitPrice: '',
    });

  }


  // تغییر واحد اندازه‌گیری
  function handleUnitChange(rowId, unitId) {

    updateItem(rowId, {
      unitId,
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


  // بررسی کامل بودن همه ردیف‌ها
  const allItemsComplete = items.length > 0 &&
    items.every((item) => {

      const productExists = products.some(
        (product) => product.id === item.productId
      );

      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      return (
        productExists &&
        item.unitId &&
        item.quantity !== '' &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        item.unitPrice !== '' &&
        Number.isFinite(unitPrice) &&
        unitPrice >= 0
      );

    });


  // محاسبه مبلغ کل فقط در صورت تکمیل تمام ردیف‌ها
  const totalAmount = allItemsComplete
    ? items.reduce(
      (total, item) => total + getLineAmount(item),
      0
    )
    : null;


  return (

    <div className="inventory-entry">

      {/* اطلاعات عمومی سند */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>اطلاعات سند</h2>
            <p>اطلاعات عمومی ورود کالا به انبار</p>
          </div>

          <span className="entry-status">پیش‌نویس</span>
        </div>

        <div className="entry-form-grid">

          <label className="entry-field">
            <span>شماره سند</span>

            <input
              type="text"
              value="خودکار پس از ایجاد سند"
              disabled
            />
          </label>

          <label className="entry-field">
            <span>تاریخ ورود</span>

            <input type="date" />
          </label>

          <label className="entry-field entry-field-full">
            <span>نوع ورود کالا</span>

            <select
              value={entryType}
              onChange={(event) =>
                setEntryType(event.target.value)
              }
            >
              <option value="purchase">خرید</option>
              <option value="sales-return">برگشت از فروش</option>
              <option value="opening">موجودی اولیه</option>
              <option value="other">سایر</option>
            </select>
          </label>

        </div>

      </section>


      {/* اطلاعات منبع ورود */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>اطلاعات منبع ورود</h2>
            <p>اطلاعات تکمیلی درباره منشأ کالاهای ورودی</p>
          </div>
        </div>

        <div className="entry-form-grid">

          {entryType === 'purchase' && (
            <>
              <label className="entry-field">
                <span>تأمین‌کننده</span>

                <input
                  type="text"
                  placeholder="جست‌وجوی تأمین‌کننده..."
                />
              </label>

              <label className="entry-field">
                <span>شماره فاکتور خرید</span>

                <input
                  type="text"
                  placeholder="شماره فاکتور (اختیاری)"
                />
              </label>
            </>
          )}

          {entryType === 'sales-return' && (
            <>
              <label className="entry-field">
                <span>مشتری</span>

                <input
                  type="text"
                  placeholder="جست‌وجوی مشتری..."
                />
              </label>

              <label className="entry-field">
                <span>شماره فاکتور فروش</span>

                <input
                  type="text"
                  placeholder="شماره فاکتور (اختیاری)"
                />
              </label>
            </>
          )}

          {entryType === 'opening' && (
            <label className="entry-field">
              <span>تاریخ مبنای موجودی</span>
              <input type="date" />
            </label>
          )}

          {entryType === 'other' && (
            <label className="entry-field entry-field-full">
              <span>علت ورود کالا</span>

              <input
                type="text"
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
            <p>کالاها، مقادیر و قیمت‌های ورود به انبار</p>
          </div>

          <div className="entry-items-header-actions">

            <span className="entry-item-count">
              {formatNumber(items.length)} ردیف
            </span>

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

            <strong>هنوز کالایی به سند اضافه نشده است.</strong>

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

          <div className="entry-items-table-scroll">

            <table className="entry-items-table">

              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار ورودی</th>
                  <th>قیمت خرید واحد</th>
                  <th>مبلغ ردیف</th>
                  <th>عملیات</th>
                </tr>
              </thead>


              <tbody>

                {items.map((item, index) => {

                  const product = products.find(
                    (product) => product.id === item.productId
                  );

                  const baseUnit = product
                    ? units.find(
                      (unit) => unit.id === product.unitId
                    )
                    : null;

                  const selectedUnit = units.find(
                    (unit) => unit.id === item.unitId
                  );

                  const availableUnits = product
                    ? getProductUnitOptions(
                      product,
                      units,
                      unitConversions
                    )
                    : [];

                  const conversion = product
                    ? getUnitConversion(
                      product.unitId,
                      item.unitId,
                      unitConversions
                    )
                    : null;

                  const lineAmount = getLineAmount(item);

                  const duplicateProduct = Boolean(
                    item.productId &&
                    items.some(
                      (otherItem) =>
                        otherItem.id !== item.id &&
                        otherItem.productId === item.productId
                    )
                  );

                  const baseQuantity = product && item.quantity
                    ? convertToBaseUnit(
                      item.quantity,
                      product.unitId,
                      item.unitId,
                      conversion
                    )
                    : null;


                  return (

                    <tr key={item.id}>

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

                        {product && !baseUnit && (
                          <small className="entry-item-error">
                            واحد اصلی این کالا در سیستم پیدا نشد.
                          </small>
                        )}

                      </td>


                      {/* انتخاب واحد */}
                      <td data-label="واحد">

                        <select
                          value={item.unitId}
                          onChange={(event) =>
                            handleUnitChange(
                              item.id,
                              event.target.value
                            )
                          }
                          disabled={
                            !product ||
                            availableUnits.length === 0
                          }
                        >

                          {!product && (
                            <option value="">
                              ابتدا کالا را انتخاب کن
                            </option>
                          )}

                          {product && availableUnits.map((unit) => (

                            <option
                              key={unit.id}
                              value={unit.id}
                            >
                              {unit.name} ({unit.symbol})
                              {unit.id === product.unitId
                                ? ' - واحد اصلی'
                                : ''}
                            </option>

                          ))}

                        </select>

                        {product && conversion && (
                          <small className="entry-unit-hint">
                            ۱ {units.find(
                              (unit) =>
                                unit.id === conversion.fromUnitId
                            )?.symbol}
                            {' = '}
                            {formatNumber(conversion.factor)}
                            {' '}
                            {units.find(
                              (unit) =>
                                unit.id === conversion.toUnitId
                            )?.symbol}
                          </small>
                        )}

                      </td>


                      {/* مقدار ورودی */}
                      <td data-label="مقدار ورودی">

                        <input
                          type="number"
                          min="0"
                          step={
                            selectedUnit?.decimalPlaces === 0
                              ? '1'
                              : 'any'
                          }
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: event.target.value,
                            })
                          }
                          disabled={!product || !item.unitId}
                          placeholder="مقدار"
                          className="entry-number-input"
                        />

                        {baseQuantity !== null && selectedUnit &&
                          item.unitId !== product.unitId && (
                            <small className="entry-unit-hint">
                              معادل پایه: {formatNumber(baseQuantity)}
                              {' '}
                              {baseUnit?.symbol}
                            </small>
                          )}

                      </td>


                      {/* قیمت خرید واحد */}
                      <td data-label="قیمت خرید واحد">

                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitPrice: event.target.value,
                            })
                          }
                          disabled={!product || !item.unitId}
                          placeholder="قیمت واحد"
                          className="entry-number-input"
                        />

                        {selectedUnit && (
                          <small className="entry-unit-hint">
                            به ازای هر {selectedUnit.name}
                          </small>
                        )}

                      </td>


                      {/* مبلغ ردیف */}
                      <td data-label="مبلغ ردیف">

                        <strong className="entry-line-amount">
                          {lineAmount !== null
                            ? formatNumber(lineAmount)
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

        )}

      </section>


      {/* خلاصه سند */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>خلاصه سند</h2>
            <p>خلاصه تعداد ردیف‌ها و مبلغ ورود کالا</p>
          </div>
        </div>

        <div className="entry-summary">

          <div className="entry-summary-item">
            <span>تعداد ردیف کالا</span>
            <strong>{formatNumber(items.length)}</strong>
          </div>

          <div className="entry-summary-item">
            <span>مبلغ کل سند</span>
            <strong>
              {totalAmount !== null
                ? formatNumber(totalAmount)
                : '—'}
            </strong>
          </div>

        </div>

        {!allItemsComplete && items.length > 0 && (
          <p className="entry-summary-note">
            برای محاسبه مبلغ کل، کالا، واحد، مقدار و قیمت تمام
            ردیف‌ها باید تکمیل شوند.
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
            placeholder="توضیحات اختیاری درباره این سند..."
          />
        </label>

        <div className="entry-form-actions">

          <button
            type="button"
            className="entry-submit-button"
            disabled
          >
            ثبت نهایی سند
          </button>

          <button
            type="button"
            className="entry-draft-button"
            disabled
          >
            ذخیره پیش‌نویس
          </button>

        </div>

      </section>

    </div>

  );

}

export default InventoryEntry;
