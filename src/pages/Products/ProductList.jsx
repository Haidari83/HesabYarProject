import { useEffect, useMemo, useState } from 'react';

import ProductFormModal from './ProductFormModal';
import ExcelImportModal from './ExcelImportModal';

import './product-list.css';

// نمایش اعداد با ارقام فارسی
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

// نمایش قیمت‌های ثبت‌شده برای یک نوع قیمت و واحد
function ProductPriceSummary({
  product,
  priceType,
  currencies,
}) {
  // فقط قیمت‌هایی که برای واحد پایه محصول ثبت شده‌اند
  const prices = product.prices.filter(
    (price) =>
      price.unitId === product.baseUnitId &&
      price.priceType === priceType
  );

  if (prices.length === 0) {
    return <span className="product-price-empty">ثبت نشده</span>;
  }

  return (
    <div className="product-price-list">
      {prices.map((price) => {
        const currency = currencies.find(
          (item) => item.code === price.currencyCode
        );

        return (
          <div
            className="product-price-item"
            key={`${price.currencyCode}-${price.priceType}`}
          >
            <span className="product-price-currency">
              {price.currencyCode}
            </span>

            <strong>
              {formatNumber(price.unitPrice, 6)}
            </strong>

            {currency?.symbol && (
              <small>{currency.symbol}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProductList({ currentUser }) {
  // مجوز مشاهده محصولات
  const canViewProducts =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('products.view') === true;

  const canCreateProducts =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('products.create') === true;

  const canUpdateProducts =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('products.update') === true;

  const canDeactivateProducts =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('products.deactivate') === true;

  // اطلاعات مستقل صفحه محصولات
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // وضعیت دریافت اطلاعات
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // وضعیت جست‌وجو و فیلترها
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');

  // وضعیت پنجره ثبت کالای جدید
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  // وضعیت پنجره ورود محصولات از Excel
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // محصول انتخاب‌شده برای ویرایش
  const [productToEdit, setProductToEdit] = useState(null);

  // محصول انتخاب‌شده برای تغییر وضعیت
  const [productToChangeStatus, setProductToChangeStatus] = useState(null);

  // وضعیت اجرای عملیات فعال‌سازی یا غیرفعال‌سازی
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // پیام خطای تغییر وضعیت
  const [statusChangeError, setStatusChangeError] = useState('');

  // پیام نتیجه ثبت کالا
  const [createSuccessMessage, setCreateSuccessMessage] = useState('');

  // دریافت فهرست محصولات و اطلاعات فرم از SQLite
  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      if (!canViewProducts) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        // دریافت APIهای تعریف‌شده در Preload
        const productApi = window.hesabyar?.products;

        if (
          typeof productApi?.list !== 'function' ||
          typeof productApi?.getFormOptions !== 'function'
        ) {
          throw new Error(
            'سرویس دریافت اطلاعات محصولات در دسترس نیست.'
          );
        }

        // دریافت هم‌زمان محصولات و گزینه‌های موردنیاز فرم
        const [productResult, optionResult] = await Promise.all([
          productApi.list(),
          productApi.getFormOptions(),
        ]);

        // بررسی ساختار پاسخ سرویس‌ها
        if (!Array.isArray(productResult)) {
          throw new Error(
            'فهرست محصولات دریافتی معتبر نیست.'
          );
        }

        if (
          !optionResult ||
          !Array.isArray(optionResult.categories) ||
          !Array.isArray(optionResult.units) ||
          !Array.isArray(optionResult.currencies)
        ) {
          throw new Error(
            'اطلاعات دسته‌بندی‌ها، واحدها یا ارزها معتبر نیست.'
          );
        }

        if (isActive) {
          setProducts(productResult);
          setCategories(optionResult.categories);
          setUnits(optionResult.units);
          setCurrencies(optionResult.currencies);
        }
      } catch (error) {
        if (isActive) {
          // در زمان خطا، داده آزمایشی یا اطلاعات ناقص نشان داده نمی‌شود
          setProducts([]);
          setCategories([]);
          setUnits([]);
          setCurrencies([]);

          setLoadError(
            error.message ||
            'دریافت فهرست محصولات ناموفق بود.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [loadAttempt, canViewProducts]);

  // آمار محصولات
  const statistics = useMemo(() => ({
    total: products.length,

    active: products.filter(
      (product) => product.isActive
    ).length,

    categories: new Set(
      products.map((product) => product.categoryId)
    ).size,

    packageProducts: products.filter(
      (product) =>
        product.units.some(
          (unit) => unit.unitKind === 'package'
        )
    ).length,
  }), [products]);

  // فهرست فیلترشده محصولات
  const filteredProducts = useMemo(() => {
    const searchValue = normalizeSearch(search);

    return products.filter((product) => {
      const matchesSearch =
        !searchValue ||
        normalizeSearch(product.name).includes(searchValue) ||
        normalizeSearch(product.code).includes(searchValue);

      const matchesCategory =
        categoryFilter === 'all' ||
        product.categoryId === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.isActive) ||
        (statusFilter === 'inactive' && !product.isActive);

      const matchesUnit =
        unitFilter === 'all' ||
        product.units.some(
          (unit) => unit.unitId === unitFilter
        );

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesUnit
      );
    });
  }, [
    products,
    search,
    categoryFilter,
    statusFilter,
    unitFilter,
  ]);

  // بررسی دسترسی مشاهده
  if (!canViewProducts) {
    return (
      <div className="product-page">
        <div className="product-state-message">
          <strong>دسترسی غیرمجاز</strong>
          <p>
            برای مشاهده فهرست محصولات مجوز لازم را نداری.
          </p>
        </div>
      </div>
    );
  }

  // افزودن کالای ثبت‌شده به فهرست بدون بارگذاری مجدد صفحه
  function handleProductCreated(createdProduct) {
    setProducts((previous) => [
      createdProduct,
      ...previous,
    ]);

    // بستن فرم
    setIsCreateFormOpen(false);

    // پاک‌کردن فیلترها تا کالای تازه ثبت‌شده دیده شود
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setUnitFilter('all');

    // نمایش پیام موفقیت
    setCreateSuccessMessage(
      `کالای «${createdProduct.name}» با کد ${createdProduct.code} ثبت شد.`
    );
  }

  // به‌روزرسانی محصول ویرایش‌شده در فهرست
  function handleProductUpdated(updatedProduct) {
    // جایگزینی اطلاعات قدیمی با اطلاعات جدید
    setProducts((previous) =>
      previous.map((product) =>
        product.id === updatedProduct.id
          ? updatedProduct
          : product
      )
    );

    // بستن پنجره ویرایش
    setProductToEdit(null);

    // نمایش پیام موفقیت
    setCreateSuccessMessage(
      `اطلاعات محصول «${updatedProduct.name}» با موفقیت به‌روزرسانی شد.`
    );
  }

  // بازکردن پنجره تأیید تغییر وضعیت محصول
  function openProductStatusDialog(product) {
    setStatusChangeError('');
    setProductToChangeStatus(product);
  }

  // اجرای عملیات فعال‌سازی یا غیرفعال‌سازی محصول
  async function handleConfirmProductStatusChange() {
    // جلوگیری از اجرای عملیات بدون انتخاب محصول یا در حین عملیات قبلی
    if (!productToChangeStatus || isChangingStatus) {
      return;
    }

    // تعیین وضعیت جدید محصول
    const nextIsActive = !productToChangeStatus.isActive;

    // پاک‌کردن خطای قبلی
    setStatusChangeError('');

    setIsChangingStatus(true);

    try {
      // دریافت API تغییر وضعیت محصول
      const changeProductStatus =
        window.hesabyar?.products?.setActive;

      if (typeof changeProductStatus !== 'function') {
        throw new Error(
          'سرویس تغییر وضعیت محصول در دسترس نیست.'
        );
      }

      // ارسال شناسه محصول و وضعیت جدید به Electron
      const updatedProduct = await changeProductStatus(
        productToChangeStatus.id,
        nextIsActive
      );

      // اعتبارسنجی پاسخ سرویس
      if (
        !updatedProduct?.id ||
        updatedProduct.isActive !== nextIsActive
      ) {
        throw new Error(
          'پاسخ سرویس تغییر وضعیت محصول معتبر نیست.'
        );
      }

      // به‌روزرسانی محصول در فهرست
      setProducts((previous) =>
        previous.map((product) =>
          product.id === updatedProduct.id
            ? updatedProduct
            : product
        )
      );

      // بستن پنجره تأیید
      setProductToChangeStatus(null);

      // نمایش پیام موفقیت
      setCreateSuccessMessage(
        `محصول «${updatedProduct.name}» با موفقیت ${nextIsActive ? 'فعال شد' : 'غیرفعال شد'
        }.`
      );

    } catch (error) {
      // نمایش خطای احتمالی به کاربر
      setStatusChangeError(
        error.message || 'تغییر وضعیت محصول ناموفق بود.'
      );

    } finally {
      // پایان وضعیت اجرای عملیات
      setIsChangingStatus(false);
    }
  }

  // حفظ دسته‌بندی قبلی محصول، حتی اگر اکنون غیرفعال باشد
  const editCategories =
    productToEdit &&
      !categories.some(
        (category) => category.id === productToEdit.categoryId
      )
      ? [
        ...categories,
        {
          id: productToEdit.categoryId,
          name: productToEdit.categoryName || 'دسته‌بندی قبلی',
          isActive: false,
        },
      ]
      : categories;

  return (
    <div className="product-page">

      {/* نمایش وضعیت بارگذاری */}
      {isLoading && (
        <div className="product-state-message">
          در حال دریافت اطلاعات محصولات...
        </div>
      )}

      {/* نمایش خطای دریافت اطلاعات */}
      {!isLoading && loadError && (
        <div className="product-state-message product-state-error">
          <strong>دریافت اطلاعات ناموفق بود.</strong>

          <p>{loadError}</p>

          <button
            type="button"
            className="product-retry-button"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* نمایش صفحه پس از دریافت موفق اطلاعات */}
      {!isLoading && !loadError && (
        <>
          {/* پیام موفقیت ثبت کالا */}
          {createSuccessMessage && (
            <div className="product-success-message" role="status">
              <span>✓</span>

              <p>{createSuccessMessage}</p>

              <button
                type="button"
                onClick={() => setCreateSuccessMessage('')}
                aria-label="بستن پیام"
              >
                ×
              </button>
            </div>
          )}

          {/* یادداشت دسترسی‌های کاربر */}
          {!canCreateProducts &&
            !canUpdateProducts &&
            !canDeactivateProducts && (
              <div className="product-permission-note">
                دسترسی شما فقط برای مشاهده محصولات است.
              </div>
            )}

          {/* کارت‌های آماری */}
          <section className="product-statistics">

            <article className="product-stat-card">
              <div className="product-stat-icon total-icon">▦</div>

              <div>
                <span>تعداد کل محصولات</span>
                <strong>{formatNumber(statistics.total)}</strong>
              </div>
            </article>

            <article className="product-stat-card">
              <div className="product-stat-icon active-icon">✓</div>

              <div>
                <span>محصولات فعال</span>
                <strong>{formatNumber(statistics.active)}</strong>
              </div>
            </article>

            <article className="product-stat-card">
              <div className="product-stat-icon category-icon">▤</div>

              <div>
                <span>دسته‌بندی‌های دارای محصول</span>
                <strong>{formatNumber(statistics.categories)}</strong>
              </div>
            </article>

            <article className="product-stat-card">
              <div className="product-stat-icon package-icon">▣</div>

              <div>
                <span>محصولات دارای واحد بسته‌بندی</span>
                <strong>{formatNumber(statistics.packageProducts)}</strong>
              </div>
            </article>

          </section>

          {/* جست‌وجو و فیلتر محصولات */}
          <section className="product-toolbar">

            <div className="product-search">
              <span className="product-search-icon">⌕</span>

              <input
                type="search"
                placeholder="جست‌وجوی نام یا کد محصول..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="product-filters">

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                aria-label="فیلتر دسته‌بندی"
              >
                <option value="all">همه دسته‌بندی‌ها</option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={unitFilter}
                onChange={(event) =>
                  setUnitFilter(event.target.value)
                }
                aria-label="فیلتر واحد"
              >
                <option value="all">همه واحدها</option>

                {units.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="فیلتر وضعیت محصول"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>

            </div>

            {/* عملیات ثبت دستی و ورود گروهی محصولات */}
            {canCreateProducts && (
              <>

                {/* دکمه ورود محصولات از Excel */}
                <button
                  type="button"
                  className="product-import-button"
                  onClick={() => {
                    setCreateSuccessMessage('');
                    setIsExcelImportOpen(true);
                  }}
                >
                  <span>⇧</span>
                  ورود از Excel
                </button>

                {/* دکمه ثبت دستی محصول */}
                <button
                  type="button"
                  className="product-add-button"
                  onClick={() => {
                    setCreateSuccessMessage('');
                    setIsCreateFormOpen(true);
                  }}
                >
                  <span>+</span>
                  ثبت کالای جدید
                </button>

              </>
            )}

          </section>

          {/* جدول محصولات */}
          <section className="product-table-card">

            <header className="product-table-header">
              <div>
                <h2>فهرست محصولات</h2>

                <p>
                  {formatNumber(filteredProducts.length)}
                  {' '}
                  محصول نمایش داده می‌شود
                </p>
              </div>
            </header>

            <div className="product-table-wrapper">
              <table className="product-table">

                <thead>
                  <tr>
                    <th>کد محصول</th>
                    <th>نام محصول</th>
                    <th>دسته‌بندی</th>
                    <th>واحد پایه</th>
                    <th>واحدهای دیگر</th>
                    <th>قیمت خرید پایه</th>
                    <th>قیمت فروش پایه</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const additionalUnits = product.units.filter(
                      (unit) => !unit.isBaseUnit
                    );

                    return (
                      <tr key={product.id}>

                        <td className="product-code">
                          {product.code}
                        </td>

                        <td className="product-name">
                          {product.name}
                        </td>

                        <td>
                          {product.categoryName || '—'}
                        </td>

                        <td>
                          <div className="product-base-unit">
                            <strong>{product.baseUnitName}</strong>

                            {product.baseUnitSymbol && (
                              <small>{product.baseUnitSymbol}</small>
                            )}
                          </div>
                        </td>

                        <td>
                          {additionalUnits.length > 0 ? (
                            <div className="product-unit-tags">
                              {additionalUnits.map((unit) => (
                                <span
                                  key={unit.productUnitId}
                                  className={
                                    unit.unitKind === 'package'
                                      ? 'package'
                                      : 'standard'
                                  }
                                >
                                  {unit.unitName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="product-price-empty">
                              ندارد
                            </span>
                          )}
                        </td>

                        <td className="product-price-cell">
                          <ProductPriceSummary
                            product={product}
                            priceType="purchase"
                            currencies={currencies}
                          />
                        </td>

                        <td className="product-price-cell">
                          <ProductPriceSummary
                            product={product}
                            priceType="sale"
                            currencies={currencies}
                          />
                        </td>

                        <td>
                          <span
                            className={`product-status ${product.isActive ? 'active' : 'inactive'
                              }`}
                          >
                            {product.isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        </td>

                        <td>
                          <div className="product-table-actions">

                            {/* دکمه ویرایش برای محصولات فعال */}
                            {canUpdateProducts && product.isActive && (
                              <button
                                type="button"
                                className="product-edit-action"
                                onClick={() => {
                                  setCreateSuccessMessage('');
                                  setProductToEdit(product);
                                }}
                              >
                                ویرایش
                              </button>
                            )}

                            {/* دکمه فعال‌سازی یا غیرفعال‌سازی */}
                            {canDeactivateProducts && (
                              <button
                                type="button"
                                className={
                                  product.isActive
                                    ? 'product-deactivate-action'
                                    : 'product-activate-action'
                                }
                                onClick={() => openProductStatusDialog(product)}
                              >
                                {product.isActive
                                  ? 'غیرفعال‌کردن'
                                  : 'فعال‌کردن'}
                              </button>
                            )}

                            {/* پیام برای کاربری که مجوز عملیات ندارد */}
                            {!canUpdateProducts && !canDeactivateProducts && (
                              <span className="product-price-empty">—</span>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan="9">
                        <div className="product-empty-state">
                          <span>⌕</span>

                          <strong>محصولی پیدا نشد</strong>

                          <p>
                            عبارت جست‌وجو یا فیلترها را تغییر بده.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

          </section>
        </>
      )}

      {/* پنجره مستقل ثبت کالای جدید */}
      {isCreateFormOpen && (
        <ProductFormModal
          categories={categories}
          units={units}
          currencies={currencies}
          onClose={() => setIsCreateFormOpen(false)}
          onCreated={handleProductCreated}
        />
      )}

      {/* پنجره ویرایش محصول */}
      {productToEdit && (
        <ProductFormModal
          product={productToEdit}
          categories={editCategories}
          units={units}
          onClose={() => setProductToEdit(null)}
          onUpdated={handleProductUpdated}
        />
      )}

      {/* پنجره تأیید فعال‌سازی یا غیرفعال‌سازی محصول */}
      {productToChangeStatus && (
        <div
          className="product-form-backdrop"
          onClick={(event) => {
            // بستن پنجره با کلیک بیرون از آن
            if (
              event.target === event.currentTarget &&
              !isChangingStatus
            ) {
              setProductToChangeStatus(null);
            }
          }}
        >
          <section
            className="product-status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-status-title"
          >
            {/* آیکون هشدار */}
            <div className="product-status-modal-icon">
              !
            </div>

            {/* عنوان پنجره */}
            <h2 id="product-status-title">
              {productToChangeStatus.isActive
                ? 'غیرفعال‌سازی محصول'
                : 'فعال‌سازی محصول'}
            </h2>

            {/* توضیح عملیات */}
            <p>
              آیا از{' '}
              <strong>
                {productToChangeStatus.isActive
                  ? 'غیرفعال‌کردن'
                  : 'فعال‌کردن'}
              </strong>
              {' '}محصول{' '}
              <strong>
                «{productToChangeStatus.name}»
              </strong>
              {' '}اطمینان داری؟
            </p>

            {/* توضیح پیامد عملیات */}
            <div className="product-status-warning">
              {productToChangeStatus.isActive
                ? 'غیرفعال‌سازی محصول به معنای حذف آن نیست. اطلاعات محصول و سوابق ثبت‌شده آن حفظ می‌شوند و امکان فعال‌سازی مجدد وجود دارد.'
                : 'با فعال‌سازی مجدد، محصول دوباره در فهرست محصولات فعال قرار می‌گیرد.'}
            </div>

            {/* نمایش خطای عملیات */}
            {statusChangeError && (
              <div
                className="product-form-error-message"
                role="alert"
              >
                {statusChangeError}
              </div>
            )}

            {/* دکمه‌های عملیات */}
            <div className="product-status-actions">

              <button
                type="button"
                className="product-form-cancel"
                disabled={isChangingStatus}
                onClick={() => setProductToChangeStatus(null)}
              >
                انصراف
              </button>

              <button
                type="button"
                className={
                  productToChangeStatus.isActive
                    ? 'product-confirm-deactivate'
                    : 'product-confirm-activate'
                }
                disabled={isChangingStatus}
                onClick={handleConfirmProductStatusChange}
              >
                {isChangingStatus
                  ? 'در حال انجام...'
                  : productToChangeStatus.isActive
                    ? 'بله، غیرفعال کن'
                    : 'بله، فعال کن'}
              </button>

            </div>
          </section>
        </div>
      )}

      {isExcelImportOpen && (
        <ExcelImportModal
          categories={categories}
          units={units}
          products={products}
          onClose={() => setIsExcelImportOpen(false)}
        />
      )}
    </div>

  );
}

export default ProductList;