import { useEffect, useMemo, useState } from 'react';

import Alert from '../../components/ui/Alert';
import { formatNumber } from '../../utils/numberFormat';
import { normalizePersianText as normalizeName } from '../../utils/persianText';
import DataTableShell from '../../components/ui/DataTableShell';
import EmptyState from '../../components/ui/EmptyState';

// import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import KeyboardSelect from '../../components/ui/KeyboardSelect';

import FormField from '../../components/ui/FormField';

import './inventory-stock-list.css';

// تشخیص وضعیت موجودی کالا
// تشخیص وضعیت موجودی کالا بر اساس مقدار واقعی انبار
function getStockStatus(product) {
  const stock = Number(product.stock);

  if (stock < 0) {
    return {
      label: 'موجودی منفی',
      className: 'negative',
    };
  }

  if (stock === 0) {
    return {
      label: 'ناموجود',
      className: 'out',
    };
  }

  return {
    label: 'موجود',
    className: 'available',
  };
}


// قالب‌بندی موجودی بر اساس تعداد ارقام اعشار واحد پایه کالا
function formatStockQuantity(product) {
  return formatNumber(product.stock, {
    maximumFractionDigits:
      product.baseQuantityDecimalPlaces ?? 2,
  });
}


function InventoryStockList() {

  // فهرست کالاهای دریافت‌شده از پایگاه داده
  const [products, setProducts] = useState([]);

  // وضعیت دریافت اطلاعات
  const [isLoading, setIsLoading] = useState(true);

  // خطای احتمالی دریافت اطلاعات
  const [loadError, setLoadError] = useState('');

  // شناسه درخواست مجدد اطلاعات
  const [reloadToken, setReloadToken] = useState(0);


  // وضعیت جست‌وجو و فیلترها
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');


  // مرتب‌سازی جدول
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');


  // صفحه‌بندی
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;


  // کالای انتخاب‌شده برای مشاهده جزئیات
  const [selectedProduct, setSelectedProduct] = useState(null);


  // دریافت فهرست موجودی از SQLite
  useEffect(() => {

    let isCurrent = true;


    async function loadStockList() {

      try {

        // دریافت تابع ارتباط با سرویس موجودی
        const listStock =
          window.hesabyar?.inventory?.listStock;


        // بررسی در دسترس بودن API
        if (typeof listStock !== 'function') {
          throw new Error(
            'ارتباط با سرویس فهرست موجودی برقرار نیست.'
          );
        }


        // دریافت اطلاعات واقعی کالاها
        const result = await listStock();


        // جلوگیری از پردازش پاسخ درخواست قدیمی
        if (!isCurrent) {
          return;
        }


        // بررسی اعتبار پاسخ دریافتی
        if (
          !result ||
          !Array.isArray(result.products) ||
          typeof result.baseCurrencyCode !== 'string'
        ) {
          throw new Error(
            'اطلاعات دریافتی فهرست موجودی معتبر نیست.'
          );
        }


        // ثبت اطلاعات واقعی کالاها
        setProducts(result.products);

        // پاک‌کردن خطای قبلی
        setLoadError('');


      } catch (error) {

        if (isCurrent) {

          setLoadError(
            error?.message ||
            'دریافت فهرست موجودی ناموفق بود.'
          );

        }

      } finally {

        if (isCurrent) {
          setIsLoading(false);
        }

      }

    }


    // اجرای درخواست دریافت اطلاعات
    void loadStockList();


    // جلوگیری از تغییر وضعیت پس از خروج از صفحه
    return () => {
      isCurrent = false;
    };

  }, [reloadToken]);


  // استخراج دسته‌بندی‌ها از اطلاعات واقعی کالاها
  const categoryOptions = useMemo(() => {

    const uniqueCategories = new Map();


    products.forEach((product) => {

      if (
        product.categoryId === null ||
        product.categoryId === undefined
      ) {
        return;
      }

      uniqueCategories.set(
        String(product.categoryId),
        product.categoryName || 'بدون دسته‌بندی'
      );

    });


    return Array.from(
      uniqueCategories.entries(),
      ([value, label]) => ({
        value,
        label,
      })
    ).sort(
      (first, second) =>
        first.label.localeCompare(second.label, 'fa')
    );

  }, [products]);


  // دریافت دوباره اطلاعات موجودی
  function handleRetry() {

    setLoadError('');

    setIsLoading(true);

    setReloadToken((previous) => previous + 1);

  }

  const filteredProducts = useMemo(() => {

    const searchValue = normalizeName(search);


    const result = products.filter((product) => {

      // جست‌وجو بر اساس نام یا کد کالا
      const matchesSearch =
        !searchValue ||
        normalizeName(product.name).includes(searchValue) ||
        normalizeName(product.code).includes(searchValue);


      // فیلتر دسته‌بندی
      const matchesCategory =
        categoryFilter === 'all' ||
        String(product.categoryId) === categoryFilter;


      // وضعیت موجودی
      const stockStatus = getStockStatus(product);


      const matchesStock =
        stockFilter === 'all' ||
        (
          stockFilter === 'available' &&
          stockStatus.className === 'available'
        ) ||
        (
          stockFilter === 'out' &&
          stockStatus.className === 'out'
        ) ||
        (
          stockFilter === 'negative' &&
          stockStatus.className === 'negative'
        );


      // فیلتر وضعیت فعالیت کالا
      const matchesActivity =
        activityFilter === 'all' ||
        (
          activityFilter === 'active' &&
          product.isActive
        ) ||
        (
          activityFilter === 'inactive' &&
          !product.isActive
        );


      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock &&
        matchesActivity
      );

    });


    // مرتب‌سازی نتایج
    result.sort((a, b) => {

      let comparison = 0;


      if (sortBy === 'name') {

        comparison = String(a.name || '').localeCompare(
          String(b.name || ''),
          'fa'
        );

      } else if (sortBy === 'stock') {

        comparison =
          Number(a.stock) - Number(b.stock);

      } else if (sortBy === 'purchasePrice') {

        const priceA =
          a.purchasePrice === null ||
            a.purchasePrice === undefined
            ? -1
            : Number(a.purchasePrice);

        const priceB =
          b.purchasePrice === null ||
            b.purchasePrice === undefined
            ? -1
            : Number(b.purchasePrice);

        comparison = priceA - priceB;

      }


      return sortDirection === 'asc'
        ? comparison
        : -comparison;

    });


    return result;

  }, [
    products,
    search,
    categoryFilter,
    stockFilter,
    activityFilter,
    sortBy,
    sortDirection,
  ]);

  // محاسبه تعداد صفحات
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / pageSize)
  );

  // جلوگیری از باقی‌ماندن روی صفحه نامعتبر
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // کالاهای قابل نمایش در صفحه فعلی
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  // تغییر مرتب‌سازی
  function handleSortChange(value) {
    setSortBy(value);
    setSortDirection('asc');
    setCurrentPage(1);
  }

  // پاک‌کردن همه فیلترها
  function resetFilters() {
    setSearch('');
    setCategoryFilter('all');
    setStockFilter('all');
    setActivityFilter('all');
    setSortBy('name');
    setSortDirection('asc');
    setCurrentPage(1);
  }

  // تغییر جهت مرتب‌سازی
  function toggleSortDirection() {
    setSortDirection((previous) =>
      previous === 'asc' ? 'desc' : 'asc'
    );
    setCurrentPage(1);
  }

  // نمایش یک ردیف کالا
  // نمایش یک ردیف کالا
  function renderProductDetails(product, index) {

    const stockStatus = getStockStatus(product);


    return (

      <tr key={product.id}>

        <td>
          {formatNumber(
            (safeCurrentPage - 1) * pageSize + index + 1
          )}
        </td>


        <td>
          <div className="stock-product-name">
            <strong>{product.name}</strong>
            <span>{product.code}</span>
          </div>
        </td>


        <td>
          <strong>
            {product.categoryName}
          </strong>
        </td>


        <td>
          {product.unitName}
        </td>


        <td className="stock-number">
          {formatStockQuantity(product)}
        </td>

        <td>
          <div className="stock-status-group">

            <span className={`stock-status ${stockStatus.className}`}>
              {stockStatus.label}
            </span>

            {!product.isActive && (
              <span className="stock-status inactive">
                غیرفعال
              </span>
            )}

          </div>
        </td>


        <td>
          <Button
            type="button"
            variant="secondary"
            size="small"
            className="stock-detail-button"
            onClick={() => setSelectedProduct(product)}
          >
            جزئیات
          </Button>
        </td>

      </tr>

    );

  }
  return (
    <div className="inventory-stock-list">

      {isLoading ? (

        <Alert
          variant="info"
          className="stock-load-alert"
        >
          در حال دریافت فهرست موجودی کالاها از پایگاه داده...
        </Alert>

      ) : loadError ? (

        <div className="stock-load-error">

          <Alert
            variant="danger"
            role="alert"
          >
            {loadError}
          </Alert>

          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={handleRetry}
          >
            تلاش دوباره
          </Button>

        </div>

      ) : (

        <>

          {/* نوار جست‌وجو و فیلترها */}
          <section className="stock-toolbar">

            <div className="stock-search">
              <span className="stock-search-icon">⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="جست‌وجوی نام یا کد کالا..."
                aria-label="جست‌وجوی کالا"
              />

              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  iconOnly
                  onClick={() => {
                    // پاک‌کردن عبارت جست‌وجو و بازگشت به صفحه اول
                    setSearch('');
                    setCurrentPage(1);
                  }}
                  aria-label="پاک‌کردن جست‌وجو"
                >
                  ×
                </Button>
              )}
            </div>

            <div className="stock-filter-row">

              <FormField
                className="ui-field stock-filter-field"
                label="دسته‌بندی"
              >
                <KeyboardSelect
                  value={categoryFilter}
                  options={[
                    {
                      value: 'all',
                      label: 'همه دسته‌بندی‌ها',
                    },
                    ...categoryOptions,
                  ]}
                  onChange={(value) => {
                    // به‌روزرسانی دسته‌بندی و بازگشت به صفحه اول
                    setCategoryFilter(value);
                    setCurrentPage(1);
                  }}
                />
              </FormField>

              <FormField
                className="ui-field"
                label="وضعیت کالا"
              >
                <KeyboardSelect
                  value={activityFilter}
                  options={[
                    {
                      value: 'all',
                      label: 'فعال و غیرفعال',
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
                  onChange={(value) => {
                    // تغییر وضعیت کالا و بازگشت به صفحه اول
                    setActivityFilter(value);
                    setCurrentPage(1);
                  }}
                />
              </FormField>

              <FormField
                className="ui-field"
                label="مرتب‌سازی"
              >
                <KeyboardSelect
                  value={sortBy}
                  options={[
                    {
                      value: 'name',
                      label: 'نام کالا',
                    },
                    {
                      value: 'stock',
                      label: 'موجودی فعلی',
                    },
                    {
                      value: 'purchasePrice',
                      label: 'قیمت خرید',
                    },
                  ]}
                  onChange={handleSortChange}
                />
              </FormField>

              <Button
                type="button"
                variant="ghost"
                size="small"
                iconOnly
                onClick={toggleSortDirection}
                title={
                  sortDirection === 'asc'
                    ? 'مرتب‌سازی نزولی'
                    : 'مرتب‌سازی صعودی'
                }
                aria-label={
                  sortDirection === 'asc'
                    ? 'تغییر مرتب‌سازی به حالت نزولی'
                    : 'تغییر مرتب‌سازی به حالت صعودی'
                }
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="small"
                className="stock-reset-button"
                onClick={resetFilters}
              >
                پاک‌کردن فیلترها
              </Button>

            </div>

            {/* فیلتر وضعیت موجودی */}
            <div className="stock-status-filters">
              {[
                { value: 'all', label: 'همه کالاها' },
                { value: 'available', label: 'موجود' },
                { value: 'low', label: 'کم‌موجود' },
                { value: 'out', label: 'ناموجود' },
              ].map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={
                    stockFilter === filter.value ? 'active' : ''
                  }
                  onClick={() => {
                    setStockFilter(filter.value);
                    setCurrentPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

          </section>

          {/* =========================================
    قاب مشترک جدول موجودی در دسکتاپ
========================================= */}

          <DataTableShell
            title="فهرست موجودی کالا"
            className="stock-table-shell"
            bordered
          >

            {filteredProducts.length > 0 ? (

              /* جدول دسکتاپ */
              <table className="ui-data-table stock-table">

                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>نام کالا</th>
                    <th>دسته‌بندی</th>
                    <th>واحد</th>
                    <th>موجودی فعلی</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>


                <tbody>
                  {paginatedProducts.map(renderProductDetails)}
                </tbody>

              </table>

            ) : (

              /* وضعیت خالی جدول دسکتاپ */
              <EmptyState
                className="stock-empty-state"
                variant="table"
                icon="⌕"
                title="کالایی پیدا نشد"
                description="عبارت جست‌وجو یا فیلترهای انتخاب‌شده را بررسی کن."
              >

                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={resetFilters}
                >
                  پاک‌کردن فیلترها
                </Button>

              </EmptyState>

            )}

          </DataTableShell>

          {/* نمایش کارت‌ها در موبایل */}
          <section className="stock-mobile-list">
            {paginatedProducts.map((product) => {
              const status = getStockStatus(product);

              return (
                <article className="stock-mobile-card" key={product.id}>
                  <div className="stock-mobile-card-header">
                    <div className="stock-product-name">
                      <strong>{product.name}</strong>
                      <span>{product.code || 'بدون کد'}</span>
                    </div>

                    <span className={`stock-status ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="stock-mobile-card-details">

                    <div>
                      <span>دسته‌بندی</span>
                      <strong>
                        {product.categoryName || 'بدون دسته‌بندی'}
                      </strong>
                    </div>

                    <div>
                      <span>واحد</span>
                      <strong>
                        {product.unitSymbol || product.unitName || '—'}
                      </strong>
                    </div>

                    <div>
                      <span>موجودی فعلی</span>
                      <strong>
                        {formatStockQuantity(product)}
                      </strong>
                    </div>

                    <div>
                      <span>وضعیت کالا</span>
                      <strong>
                        {product.isActive ? 'فعال' : 'غیرفعال'}
                      </strong>
                    </div>

                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    className="stock-detail-button"
                    onClick={() => setSelectedProduct(product)}
                  >
                    مشاهده جزئیات
                  </Button>
                </article>
              );
            })}

            {filteredProducts.length === 0 && (

              <EmptyState
                className="stock-empty-state"
                variant="table"
                icon="⌕"
                title="کالایی پیدا نشد"
                description="عبارت جست‌وجو یا فیلترها را بررسی کن."
              >

                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={resetFilters}
                >
                  پاک‌کردن فیلترها
                </Button>

              </EmptyState>

            )}
          </section>

          {/* صفحه‌بندی */}
          {filteredProducts.length > pageSize && (
            <div className="stock-pagination">
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                قبلی
              </Button>

              <span>
                صفحه {formatNumber(safeCurrentPage)}
                {' '}
                از {formatNumber(totalPages)}
              </span>

              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                بعدی
              </Button>
            </div>
          )}

          {/* پنجره مشاهده جزئیات کالا */}
          {selectedProduct && (
            <div
              className="stock-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedProduct(null);
                }
              }}
            >
              <section
                className="stock-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="stock-detail-title"
              >
                <header className="stock-detail-modal-header">
                  <div>
                    <h2 id="stock-detail-title">جزئیات کالا</h2>
                    <p>اطلاعات ثبت‌شده این کالا در حساب‌یار</p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    iconOnly
                    onClick={() => setSelectedProduct(null)}
                    aria-label="بستن"
                  >
                    ×
                  </Button>
                </header>

                <div className="stock-detail-modal-content">

                  <div>
                    <span>نام کالا</span>
                    <strong>{selectedProduct.name}</strong>
                  </div>


                  <div>
                    <span>کد کالا</span>
                    <strong>{selectedProduct.code || '—'}</strong>
                  </div>


                  <div>
                    <span>دسته‌بندی</span>
                    <strong>
                      {selectedProduct.categoryName || 'بدون دسته‌بندی'}
                    </strong>
                  </div>


                  <div>
                    <span>واحد اندازه‌گیری</span>
                    <strong>
                      {selectedProduct.unitName ||
                        selectedProduct.unitSymbol ||
                        '—'}
                    </strong>
                  </div>


                  <div>
                    <span>موجودی فعلی</span>
                    <strong>
                      {formatStockQuantity(selectedProduct)}
                    </strong>
                  </div>


                  <div>
                    <span>وضعیت کالا</span>
                    <strong>
                      {selectedProduct.isActive ? 'فعال' : 'غیرفعال'}
                    </strong>
                  </div>

                </div>

                <footer className="stock-detail-modal-footer">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => setSelectedProduct(null)}
                  >
                    بستن
                  </Button>
                </footer>
              </section>
            </div>
          )}

        </>

      )}

    </div>
  );
}

export default InventoryStockList;
