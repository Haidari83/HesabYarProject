import { useEffect, useMemo, useState } from 'react';

import ProductFormModal from './ProductFormModal';
import ExcelImportModal from './ExcelImportModal';
import { normalizePersianText as normalizeSearch, } from '../../utils/persianText';

import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import KeyboardSelect from '../../components/ui/KeyboardSelect';

// قاب مشترک جدول‌ها
import DataTableShell from '../../components/ui/DataTableShell';

// نمایش مشترک فهرست خالی
import EmptyState from '../../components/ui/EmptyState';

import { formatNumber } from '../../utils/numberFormat';

import './product-list.css';

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
              {formatNumber(price.unitPrice, {
                maximumFractionDigits: 2,
              })}
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

  // دریافت محصولات ثبت‌شده از واردسازی Excel
  function handleExcelProductsImported(importedProducts) {
    // فقط پاسخ معتبر و غیرخالی پذیرفته می‌شود
    if (
      !Array.isArray(importedProducts) ||
      importedProducts.length === 0
    ) {
      return;
    }

    // اضافه‌کردن محصولات جدید به ابتدای فهرست
    setProducts((previous) => [
      ...importedProducts,
      ...previous,
    ]);

    // پاک‌کردن فیلترها تا محصولات تازه ثبت‌شده دیده شوند
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setUnitFilter('all');

    // نمایش نتیجه عملیات در صفحه محصولات
    setCreateSuccessMessage(
      `${importedProducts.length.toLocaleString('fa-IR')} محصول از فایل Excel با موفقیت ثبت شد.`
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

          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => {
              // درخواست مجدد برای بارگذاری فهرست کالاها
              setLoadAttempt((value) => value + 1);
            }}
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* نمایش صفحه پس از دریافت موفق اطلاعات */}
      {!isLoading && !loadError && (
        <>
          {/* پیام موفقیت ثبت کالا */}

          {createSuccessMessage && (
            <Alert
              variant="success"
              inline
              closable
              onClose={() => setCreateSuccessMessage('')}
            >
              {createSuccessMessage}
            </Alert>
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

              <div className="product-filters">

                <KeyboardSelect
                  value={categoryFilter}
                  options={[
                    {
                      value: 'all',
                      label: 'همه دسته‌بندی‌ها',
                    },
                    ...categories.map((category) => ({
                      value: String(category.id),
                      label: category.name,
                    })),
                  ]}
                  onChange={setCategoryFilter}
                  ariaLabel="فیلتر دسته‌بندی"
                />

                <KeyboardSelect
                  value={unitFilter}
                  options={[
                    {
                      value: 'all',
                      label: 'همه واحدها',
                    },
                    ...units.map((unit) => ({
                      value: String(unit.id),
                      label: unit.name,
                    })),
                  ]}
                  onChange={setUnitFilter}
                  ariaLabel="فیلتر واحد"
                />

                <KeyboardSelect
                  value={statusFilter}
                  options={[
                    {
                      value: 'all',
                      label: 'همه وضعیت‌ها',
                    },
                    {
                      value: 'active',
                      label: 'فعال',
                    },
                    {
                      value: 'inactive',
                      label: 'غیرفعال',
                    },
                  ]}
                  onChange={setStatusFilter}
                  ariaLabel="فیلتر وضعیت محصول"
                />

              </div>

            </div>

            {/* عملیات ثبت دستی و ورود گروهی محصولات */}
            {canCreateProducts && (
              <>

                {/* دکمه ورود محصولات از Excel */}
                <Button
                  type="button"
                  variant="secondary"
                  startIcon="⇧"
                  onClick={() => {
                    // پاک‌کردن پیام قبلی و بازکردن پنجره ورود گروهی
                    setCreateSuccessMessage('');
                    setIsExcelImportOpen(true);
                  }}
                >
                  ورود از Excel
                </Button>

                {/* دکمه ثبت دستی محصول */}
                <Button
                  type="button"
                  variant="primary"
                  startIcon="+"
                  onClick={() => {
                    // پاک‌کردن پیام موفقیت قبلی و بازکردن فرم ثبت کالا
                    setCreateSuccessMessage('');
                    setIsCreateFormOpen(true);
                  }}
                >
                  ثبت کالای جدید
                </Button>

              </>
            )}

          </section>

          {/* قاب مشترک فهرست محصولات */}
          <DataTableShell
            title="فهرست محصولات"
            description={`${formatNumber(filteredProducts.length)} محصول نمایش داده می‌شود`}
          >
            <table className="ui-data-table product-table">
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
                            <Button
                              type="button"
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                // پیام قبلی پاک می‌شود و کالای انتخاب‌شده وارد فرم ویرایش می‌شود.
                                setCreateSuccessMessage('');
                                setProductToEdit(product);
                              }}
                            >
                              ویرایش
                            </Button>
                          )}

                          {/* دکمه فعال‌سازی یا غیرفعال‌سازی */}
                          {canDeactivateProducts && (
                            <Button
                              type="button"
                              variant={product.isActive ? 'warning' : 'success'}
                              size="small"
                              onClick={() => openProductStatusDialog(product)}
                            >
                              {product.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
                            </Button>
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
                      <EmptyState
                        variant="table"
                        icon="⌕"
                        title="محصولی پیدا نشد"
                        description="عبارت جست‌وجو یا فیلترها را تغییر بده."
                      />
                    </td>
                  </tr>
                )}

              </tbody>
            </table>


          </DataTableShell>
        </>
      )
      }

      {/* پنجره مستقل ثبت کالای جدید */}
      {
        isCreateFormOpen && (
          <ProductFormModal
            categories={categories}
            units={units}
            currencies={currencies}
            onClose={() => setIsCreateFormOpen(false)}
            onCreated={handleProductCreated}
          />
        )
      }

      {/* پنجره ویرایش محصول */}
      {
        productToEdit && (
          <ProductFormModal
            product={productToEdit}
            categories={editCategories}
            units={units}
            onClose={() => setProductToEdit(null)}
            onUpdated={handleProductUpdated}
          />
        )
      }

      {/* پنجره تأیید فعال‌سازی یا غیرفعال‌سازی محصول */}
      {
        productToChangeStatus && (
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
                <Alert
                  variant="danger"
                  role="alert"
                  className="product-status-change-error"
                >
                  {statusChangeError}
                </Alert>
              )}

              {/* دکمه‌های عملیات */}
              <div className="product-status-actions">

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isChangingStatus}
                  onClick={() => setProductToChangeStatus(null)}
                >
                  انصراف
                </Button>

                <Button
                  type="button"
                  variant={
                    productToChangeStatus.isActive
                      ? 'warning'
                      : 'success'
                  }
                  disabled={isChangingStatus}
                  loading={isChangingStatus}
                  onClick={handleConfirmProductStatusChange}
                >
                  {isChangingStatus
                    ? 'در حال انجام...'
                    : productToChangeStatus.isActive
                      ? 'بله، غیرفعال کن'
                      : 'بله، فعال کن'}
                </Button>

              </div>
            </section>
          </div>
        )
      }
      {
        isExcelImportOpen && (
          <ExcelImportModal
            categories={categories}
            units={units}
            products={products}
            onClose={() => setIsExcelImportOpen(false)}
            onImported={handleExcelProductsImported}
          />
        )
      }
    </div >

  );
}

export default ProductList;