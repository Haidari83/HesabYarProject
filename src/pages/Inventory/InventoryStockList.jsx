
import { useMemo, useState } from 'react';
import { useBusinessData } from '../../context/BusinessDataContext';

import { formatNumber } from '../../utils/numberFormat';
import { normalizePersianText as normalizeName } from '../../utils/persianText';
import Button from '../../components/ui/Button';

// import Alert from '../../components/ui/Alert';

import './inventory-stock-list.css';

// تشخیص وضعیت موجودی کالا
function getStockStatus(product) {
  const stock = Number(product.stock);
  const minStock = Number(product.minStock);

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

  if (
    product.minStock !== undefined &&
    product.minStock !== null &&
    Number.isFinite(minStock) &&
    stock <= minStock
  ) {
    return {
      label: 'کم‌موجود',
      className: 'low',
    };
  }

  return {
    label: 'موجود',
    className: 'available',
  };
}

function InventoryStockList() {
  const { products, categories, units } = useBusinessData();

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

  // دریافت نام دسته‌بندی
  function getCategoryName(categoryId) {
    return (
      categories.find((category) => category.id === categoryId)?.name ||
      'بدون دسته‌بندی'
    );
  }

  // دریافت اطلاعات واحد اندازه‌گیری
  function getUnit(unitId) {
    return units.find((unit) => unit.id === unitId);
  }

  // اعمال جست‌وجو، فیلتر و مرتب‌سازی
  const filteredProducts = useMemo(() => {
    const searchValue = normalizeName(search);

    const result = products.filter((product) => {
      const matchesSearch =
        !searchValue ||
        normalizeName(product.name).includes(searchValue) ||
        normalizeName(product.code).includes(searchValue);

      const matchesCategory =
        categoryFilter === 'all' ||
        product.categoryId === categoryFilter;

      const stockStatus = getStockStatus(product);

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'available' &&
          stockStatus.className === 'available') ||
        (stockFilter === 'low' &&
          stockStatus.className === 'low') ||
        (stockFilter === 'out' &&
          stockStatus.className === 'out') ||
        (stockFilter === 'negative' &&
          stockStatus.className === 'negative');

      const matchesActivity =
        activityFilter === 'all' ||
        (activityFilter === 'active' && product.isActive) ||
        (activityFilter === 'inactive' && !product.isActive);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock &&
        matchesActivity
      );
    });

    result.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'name') {
        comparison = String(a.name || '').localeCompare(
          String(b.name || ''),
          'fa'
        );
      } else if (sortBy === 'stock') {
        comparison = Number(a.stock) - Number(b.stock);
      } else if (sortBy === 'minStock') {
        comparison = Number(a.minStock ?? -1) -
          Number(b.minStock ?? -1);
      } else if (sortBy === 'purchasePrice') {
        comparison = Number(a.purchasePrice) -
          Number(b.purchasePrice);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
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
  function renderProductDetails(product, index) {
    const unit = getUnit(product.unitId);
    const stockStatus = getStockStatus(product);

    return (
      <tr key={product.id}>
        <td>{formatNumber(
          (safeCurrentPage - 1) * pageSize + index + 1
        )}</td>

        <td>
          <div className="stock-product-name">
            <strong>{product.name}</strong>
            <span>{product.code || 'بدون کد'}</span>
          </div>
        </td>

        <td>{getCategoryName(product.categoryId)}</td>

        <td>{unit?.symbol || unit?.name || '—'}</td>

        <td className="stock-number">
          {formatNumber(product.stock, {
            maximumFractionDigits: unit?.decimalPlaces ?? 2,
          })}
        </td>

        <td className="stock-number">
          {formatNumber(product.minStock, {
            maximumFractionDigits: unit?.decimalPlaces ?? 2,
          })}
        </td>

        <td className="stock-number">
          {formatNumber(product.purchasePrice)}
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

          <label className="stock-filter-field">
            <span>دسته‌بندی</span>

            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">همه دسته‌بندی‌ها</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="stock-filter-field">
            <span>وضعیت کالا</span>

            <select
              value={activityFilter}
              onChange={(event) => {
                setActivityFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">فعال و غیرفعال</option>
              <option value="active">فقط فعال</option>
              <option value="inactive">فقط غیرفعال</option>
            </select>
          </label>

          <label className="stock-filter-field">
            <span>مرتب‌سازی</span>

            <select
              value={sortBy}
              onChange={(event) =>
                handleSortChange(event.target.value)
              }
            >
              <option value="name">نام کالا</option>
              <option value="stock">موجودی فعلی</option>
              <option value="minStock">حداقل موجودی</option>
              <option value="purchasePrice">قیمت خرید</option>
            </select>
          </label>

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
            { value: 'negative', label: 'موجودی منفی' },
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

      {/* خلاصه تعداد نتایج */}
      <div className="stock-list-summary">
        <span>
          نمایش {formatNumber(filteredProducts.length)} کالا
        </span>

        <span>
          از مجموع {formatNumber(products.length)} کالا
        </span>
      </div>

      {/* جدول دسکتاپ */}
      <section className="stock-table-wrapper">
        <table className="stock-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>نام کالا</th>
              <th>دسته‌بندی</th>
              <th>واحد</th>
              <th>موجودی فعلی</th>
              <th>حداقل موجودی</th>
              <th>قیمت خرید ثبت‌شده</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>

          <tbody>
            {paginatedProducts.map(renderProductDetails)}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="stock-empty-state">
            <span>⌕</span>
            <strong>کالایی پیدا نشد</strong>
            <p>عبارت جست‌وجو یا فیلترهای انتخاب‌شده را بررسی کن.</p>

            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={resetFilters}
            >
              پاک‌کردن فیلترها
            </Button>
          </div>
        )}
      </section>

      {/* نمایش کارت‌ها در موبایل */}
      <section className="stock-mobile-list">
        {paginatedProducts.map((product) => {
          const unit = getUnit(product.unitId);
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
                  <strong>{getCategoryName(product.categoryId)}</strong>
                </div>

                <div>
                  <span>واحد</span>
                  <strong>{unit?.symbol || unit?.name || '—'}</strong>
                </div>

                <div>
                  <span>موجودی فعلی</span>
                  <strong>
                    {formatNumber(product.stock, {
                      // تعداد رقم اعشار مطابق واحد همین کالا تعیین می‌شود.
                      maximumFractionDigits: unit?.decimalPlaces ?? 2,
                    })}
                  </strong>
                </div>

                <div>
                  <span>حداقل موجودی</span>
                  <strong>
                    {formatNumber(product.minStock, {
                      // تعداد رقم اعشار مطابق واحد همین کالا تعیین می‌شود.
                      maximumFractionDigits: unit?.decimalPlaces ?? 2,
                    })}
                  </strong>
                </div>

                <div>
                  <span>قیمت خرید ثبت‌شده</span>
                  <strong>{formatNumber(product.purchasePrice)}</strong>
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
          <div className="stock-empty-state">
            <strong>کالایی پیدا نشد</strong>
            <p>عبارت جست‌وجو یا فیلترها را بررسی کن.</p>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={resetFilters}
            >
              پاک‌کردن فیلترها
            </Button>
          </div>
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
                  {getCategoryName(selectedProduct.categoryId)}
                </strong>
              </div>

              <div>
                <span>واحد اندازه‌گیری</span>
                <strong>
                  {getUnit(selectedProduct.unitId)?.name || '—'}
                </strong>
              </div>

              <div>
                <span>موجودی فعلی</span>
                <strong>{formatNumber(selectedProduct.stock)}</strong>
              </div>

              <div>
                <span>حداقل موجودی</span>
                <strong>{formatNumber(selectedProduct.minStock)}</strong>
              </div>

              <div>
                <span>قیمت خرید ثبت‌شده</span>
                <strong>
                  {formatNumber(selectedProduct.purchasePrice)}
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

    </div>
  );
}

export default InventoryStockList;
