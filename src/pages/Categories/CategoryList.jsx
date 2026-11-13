
import { useMemo, useState } from 'react';
import { useBusinessData } from '../../context/BusinessDataContext';
import './category-list.css';

// یکسان‌سازی نام‌ها برای شناسایی موارد تکراری
function normalizeName(value) {
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

// قالب نمایش اعداد
function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

// تولید شناسه آزمایشی دسته‌بندی
function generateCategoryId() {
  return `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ساخت ردیف خالی برای ثبت گروهی
function createEmptyRow() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    description: '',
  };
}

// ساخت چند ردیف خالی
function createEmptyRows(count = 5) {
  return Array.from({ length: count }, createEmptyRow);
}

function CategoryList() {
  const {
    categories,
    setCategories,
    products,
  } = useBusinessData();

  // وضعیت جست‌وجو و فیلتر
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // وضعیت پنجره ثبت و ویرایش
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('single');
  const [editingId, setEditingId] = useState(null);

  // اطلاعات فرم تکی
  const [singleForm, setSingleForm] = useState({
    name: '',
    description: '',
  });

  // اطلاعات فرم گروهی
  const [bulkRows, setBulkRows] = useState(() => createEmptyRows(5));

  // خطاها
  const [singleError, setSingleError] = useState('');
  const [bulkErrors, setBulkErrors] = useState({});
  const [bulkError, setBulkError] = useState('');

  // پنجره‌های تأیید عملیات
  const [confirmAction, setConfirmAction] = useState(null);

  // پیام موفقیت
  const [successMessage, setSuccessMessage] = useState('');

  // محاسبه تعداد کالاهای هر دسته‌بندی
  const productCounts = useMemo(() => {
    const counts = new Map();

    products.forEach((product) => {
      if (!product.categoryId) return;

      counts.set(
        product.categoryId,
        (counts.get(product.categoryId) || 0) + 1
      );
    });

    return counts;
  }, [products]);

  // محاسبه آمار دسته‌بندی‌ها
  const statistics = useMemo(() => {
    return {
      total: categories.length,

      active: categories.filter(
        (category) => category.isActive
      ).length,

      inactive: categories.filter(
        (category) => !category.isActive
      ).length,

      used: categories.filter(
        (category) => (productCounts.get(category.id) || 0) > 0
      ).length,
    };
  }, [categories, productCounts]);

  // فهرست فیلترشده دسته‌بندی‌ها
  const filteredCategories = useMemo(() => {
    const searchValue = normalizeName(search);

    return categories.filter((category) => {
      const matchesSearch =
        !searchValue ||
        normalizeName(category.name).includes(searchValue) ||
        normalizeName(category.description).includes(searchValue);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && category.isActive) ||
        (statusFilter === 'inactive' && !category.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  // دریافت تعداد کالاهای هر دسته‌بندی
  function getProductCount(categoryId) {
    return productCounts.get(categoryId) || 0;
  }

  // بررسی تکراری نبودن نام نسبت به دسته‌بندی‌های قبلی
  function isDuplicateCategoryName(name, excludedId = null) {
    const normalized = normalizeName(name);

    return categories.some(
      (category) =>
        category.id !== excludedId &&
        normalizeName(category.name) === normalized
    );
  }

  // بازکردن فرم ثبت تکی
  function openSingleForm() {
    setFormMode('single');
    setEditingId(null);

    setSingleForm({
      name: '',
      description: '',
    });

    setSingleError('');
    setBulkError('');
    setBulkErrors({});
    setIsFormOpen(true);
  }

  // بازکردن فرم ثبت گروهی
  function openBulkForm() {
    setFormMode('bulk');
    setEditingId(null);
    setBulkRows(createEmptyRows(5));
    setBulkError('');
    setBulkErrors({});
    setSingleError('');
    setIsFormOpen(true);
  }

  // بازکردن فرم ویرایش
  function openEditForm(category) {
    setFormMode('single');
    setEditingId(category.id);

    setSingleForm({
      name: category.name,
      description: category.description || '',
    });

    setSingleError('');
    setIsFormOpen(true);
  }

  // بستن پنجره
  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setSingleError('');
    setBulkError('');
    setBulkErrors({});
  }

  // تغییر اطلاعات فرم تکی
  function handleSingleChange(event) {
    const { name, value } = event.target;

    setSingleForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSingleError('');
  }

  // ثبت یا ویرایش یک دسته‌بندی
  function handleSingleSubmit(event) {
    event.preventDefault();

    const name = singleForm.name.trim();
    const description = singleForm.description.trim();

    if (!name) {
      setSingleError('نام دسته‌بندی را وارد کن.');
      return;
    }

    if (isDuplicateCategoryName(name, editingId)) {
      setSingleError('این نام قبلاً برای دسته‌بندی دیگری ثبت شده است.');
      return;
    }

    if (editingId) {
      setCategories((previous) =>
        previous.map((category) =>
          category.id === editingId
            ? {
              ...category,
              name,
              description,
            }
            : category
        )
      );

      setSuccessMessage(
        `دسته‌بندی «${name}» با موفقیت ویرایش شد.`
      );
    } else {
      const newCategory = {
        id: generateCategoryId(),
        name,
        description,
        isActive: true,
      };

      setCategories((previous) => [
        ...previous,
        newCategory,
      ]);

      setSuccessMessage(
        `دسته‌بندی «${name}» با موفقیت ثبت شد.`
      );
    }

    closeForm();
  }

  // تغییر اطلاعات یک ردیف از فرم گروهی
  function updateBulkRow(rowId, changes) {
    setBulkRows((previous) =>
      previous.map((row) =>
        row.rowId === rowId
          ? { ...row, ...changes }
          : row
      )
    );

    setBulkErrors({});
    setBulkError('');
  }

  // افزودن ردیف جدید
  function addBulkRows(count = 1) {
    setBulkRows((previous) => [
      ...previous,
      ...createEmptyRows(count),
    ]);
  }

  // حذف ردیف
  function removeBulkRow(rowId) {
    setBulkRows((previous) => {
      if (previous.length === 1) {
        return createEmptyRows(1);
      }

      return previous.filter(
        (row) => row.rowId !== rowId
      );
    });

    setBulkErrors((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  }

  // بررسی نام‌های تکراری بین ردیف‌های جدید
  function findBatchDuplicates(rows) {
    const groups = new Map();

    rows.forEach((row) => {
      const normalized = normalizeName(row.name);

      if (!normalized) return;

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }

      groups.get(normalized).push(row.rowId);
    });

    const duplicates = new Set();

    groups.forEach((rowIds) => {
      if (rowIds.length > 1) {
        rowIds.forEach((id) => duplicates.add(id));
      }
    });

    return duplicates;
  }

  // اعتبارسنجی و ثبت تمام دسته‌بندی‌ها
  function handleBulkSubmit(event) {
    event.preventDefault();

    // ردیف‌های کاملاً خالی نادیده گرفته می‌شوند
    const filledRows = bulkRows.filter(
      (row) =>
        row.name.trim() ||
        row.description.trim()
    );

    if (filledRows.length === 0) {
      setBulkError('حداقل نام یک دسته‌بندی را وارد کن.');
      return;
    }

    const errors = {};

    // بررسی تک‌تک ردیف‌ها
    filledRows.forEach((row) => {
      const rowErrors = [];
      const name = row.name.trim();

      if (!name) {
        rowErrors.push('نام دسته‌بندی الزامی است.');
      } else if (isDuplicateCategoryName(name)) {
        rowErrors.push('این نام قبلاً ثبت شده است.');
      }

      if (rowErrors.length > 0) {
        errors[row.rowId] = rowErrors;
      }
    });

    // بررسی تکراری بودن بین ردیف‌های همین فرم
    const duplicateRows = findBatchDuplicates(filledRows);

    duplicateRows.forEach((rowId) => {
      errors[rowId] = [
        ...(errors[rowId] || []),
        'این نام در یکی دیگر از ردیف‌ها نیز وجود دارد.',
      ];
    });

    // در صورت وجود حتی یک خطا، هیچ ردیفی ثبت نمی‌شود
    if (Object.keys(errors).length > 0) {
      setBulkErrors(errors);
      setBulkError(
        'چند ردیف دارای خطا هستند. موارد مشخص‌شده را اصلاح کن.'
      );
      return;
    }

    // تولید شناسه برای تمام دسته‌بندی‌های معتبر
    const newCategories = filledRows.map((row) => ({
      id: generateCategoryId(),
      name: row.name.trim(),
      description: row.description.trim(),
      isActive: true,
    }));

    // ثبت گروهی همه دسته‌بندی‌ها
    setCategories((previous) => [
      ...previous,
      ...newCategories,
    ]);

    setSuccessMessage(
      `${formatNumber(newCategories.length)} دسته‌بندی با موفقیت ثبت شد.`
    );

    closeForm();
  }

  // درخواست تغییر وضعیت دسته‌بندی
  function requestStatusChange(category) {
    setConfirmAction({
      type: 'status',
      category,
    });
  }

  // درخواست حذف دسته‌بندی
  function requestDelete(category) {
    if (getProductCount(category.id) > 0) {
      setSuccessMessage(
        'این دسته‌بندی دارای کالای وابسته است و امکان حذف آن وجود ندارد.'
      );
      return;
    }

    setConfirmAction({
      type: 'delete',
      category,
    });
  }

  // تأیید نهایی عملیات
  function handleConfirmAction() {
    if (!confirmAction) return;

    const { type, category } = confirmAction;

    if (type === 'status') {
      setCategories((previous) =>
        previous.map((item) =>
          item.id === category.id
            ? {
              ...item,
              isActive: !item.isActive,
            }
            : item
        )
      );

      setSuccessMessage(
        category.isActive
          ? `دسته‌بندی «${category.name}» غیرفعال شد.`
          : `دسته‌بندی «${category.name}» فعال شد.`
      );
    }

    if (type === 'delete') {
      // بررسی مجدد وابستگی کالا قبل از حذف
      const hasProducts = products.some(
        (product) => product.categoryId === category.id
      );

      if (hasProducts) {
        setSuccessMessage(
          'امکان حذف این دسته‌بندی وجود ندارد؛ زیرا دارای کالای وابسته است.'
        );
      } else {
        setCategories((previous) =>
          previous.filter(
            (item) => item.id !== category.id
          )
        );

        setSuccessMessage(
          `دسته‌بندی «${category.name}» حذف شد.`
        );
      }
    }

    setConfirmAction(null);
  }

  return (
    <div className="category-page">

      {/* پیام نتیجه عملیات */}
      {successMessage && (
        <div className="category-success-message" role="status">
          <span>✓</span>
          <p>{successMessage}</p>

          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="بستن پیام"
          >
            ×
          </button>
        </div>
      )}

      {/* آمار دسته‌بندی‌ها */}
      <section className="category-statistics">

        <article className="category-stat-card">
          <span className="category-stat-icon total">▤</span>
          <div>
            <p>کل دسته‌بندی‌ها</p>
            <strong>{formatNumber(statistics.total)}</strong>
          </div>
        </article>

        <article className="category-stat-card">
          <span className="category-stat-icon active">✓</span>
          <div>
            <p>دسته‌بندی‌های فعال</p>
            <strong>{formatNumber(statistics.active)}</strong>
          </div>
        </article>

        <article className="category-stat-card">
          <span className="category-stat-icon inactive">–</span>
          <div>
            <p>دسته‌بندی‌های غیرفعال</p>
            <strong>{formatNumber(statistics.inactive)}</strong>
          </div>
        </article>

        <article className="category-stat-card">
          <span className="category-stat-icon used">▦</span>
          <div>
            <p>دارای کالای ثبت‌شده</p>
            <strong>{formatNumber(statistics.used)}</strong>
          </div>
        </article>

      </section>

      {/* جست‌وجو و دکمه‌های افزودن */}
      <section className="category-toolbar">

        <div className="category-search">
          <span>⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی نام یا توضیحات..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="فیلتر وضعیت دسته‌بندی"
        >
          <option value="all">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </select>

        <div className="category-add-actions">

          <button
            type="button"
            className="category-add-single"
            onClick={openSingleForm}
          >
            <span>+</span>
            افزودن تکی
          </button>

          <button
            type="button"
            className="category-add-bulk"
            onClick={openBulkForm}
          >
            <span>+</span>
            افزودن گروهی
          </button>

        </div>

      </section>

      {/* جدول دسته‌بندی‌ها */}
      <section className="category-table-card">

        <header className="category-table-header">
          <div>
            <h2>فهرست دسته‌بندی‌ها</h2>
            <p>
              {formatNumber(filteredCategories.length)} دسته‌بندی
            </p>
          </div>
        </header>

        <div className="category-table-wrapper">
          <table className="category-table">

            <thead>
              <tr>
                <th>ردیف</th>
                <th>نام دسته‌بندی</th>
                <th>توضیحات</th>
                <th>تعداد کالاها</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>
              {filteredCategories.map((category, index) => {
                const count = getProductCount(category.id);

                return (
                  <tr key={category.id}>

                    <td>{formatNumber(index + 1)}</td>

                    <td className="category-name">
                      {category.name}
                    </td>

                    <td className="category-description">
                      {category.description || '—'}
                    </td>

                    <td>
                      <span className="category-product-count">
                        {formatNumber(count)} کالا
                      </span>
                    </td>

                    <td>
                      <span
                        className={`category-status ${category.isActive ? 'active' : 'inactive'
                          }`}
                      >
                        {category.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>

                    <td>
                      <div className="category-actions">

                        <button
                          type="button"
                          className="category-edit-action"
                          onClick={() => openEditForm(category)}
                        >
                          ویرایش
                        </button>

                        <button
                          type="button"
                          className={
                            category.isActive
                              ? 'category-deactivate-action'
                              : 'category-activate-action'
                          }
                          onClick={() => requestStatusChange(category)}
                        >
                          {category.isActive
                            ? 'غیرفعال‌سازی'
                            : 'فعال‌سازی'}
                        </button>

                        <button
                          type="button"
                          className="category-delete-action"
                          disabled={count > 0}
                          onClick={() => requestDelete(category)}
                          title={
                            count > 0
                              ? 'این دسته‌بندی دارای کالاست.'
                              : 'حذف دسته‌بندی'
                          }
                        >
                          حذف
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="category-empty-state">
                      <strong>دسته‌بندی‌ای پیدا نشد</strong>
                      <p>جست‌وجو یا فیلتر را تغییر بده.</p>
                    </div>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

      </section>

      {/* پنجره ثبت تکی یا گروهی */}
      {isFormOpen && (
        <div
          className="category-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className={
              formMode === 'bulk'
                ? 'category-modal category-bulk-modal'
                : 'category-modal'
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-form-title"
          >

            <header className="category-modal-header">
              <div>
                <h2 id="category-form-title">
                  {editingId
                    ? 'ویرایش دسته‌بندی'
                    : formMode === 'single'
                      ? 'افزودن یک دسته‌بندی'
                      : 'افزودن چندین دسته‌بندی'}
                </h2>

                <p>
                  {editingId
                    ? 'مشخصات دسته‌بندی را ویرایش کن.'
                    : formMode === 'single'
                      ? 'اطلاعات یک دسته‌بندی را وارد کن.'
                      : 'چند دسته‌بندی را در ردیف‌های مختلف وارد کن و همه را یک‌جا ثبت کن.'}
                </p>
              </div>

              <button
                type="button"
                className="category-modal-close"
                onClick={closeForm}
                aria-label="بستن پنجره"
              >
                ×
              </button>
            </header>

            {/* حالت ثبت تکی */}
            {formMode === 'single' && (
              <form
                className="category-single-form"
                onSubmit={handleSingleSubmit}
              >

                <div className="category-form-fields">

                  <label className="category-form-field">
                    <span>نام دسته‌بندی</span>

                    <input
                      name="name"
                      value={singleForm.name}
                      onChange={handleSingleChange}
                      placeholder="مثلاً مواد غذایی"
                      required
                      autoFocus
                    />
                  </label>

                  <label className="category-form-field">
                    <span>توضیحات</span>

                    <textarea
                      name="description"
                      value={singleForm.description}
                      onChange={handleSingleChange}
                      placeholder="توضیح کوتاهی درباره دسته‌بندی..."
                      rows="3"
                    />
                  </label>

                </div>

                {singleError && (
                  <div className="category-form-error" role="alert">
                    {singleError}
                  </div>
                )}

                <footer className="category-modal-actions">
                  <button
                    type="button"
                    className="category-cancel-button"
                    onClick={closeForm}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="category-submit-button"
                  >
                    {editingId ? 'ذخیره تغییرات' : 'ثبت دسته‌بندی'}
                  </button>
                </footer>

              </form>
            )}

            {/* حالت ثبت گروهی */}
            {formMode === 'bulk' && (
              <form
                className="category-bulk-form"
                onSubmit={handleBulkSubmit}
              >

                <div className="category-bulk-info">
                  <span>ⓘ</span>
                  <p>
                    نام دسته‌بندی الزامی است و توضیحات اختیاری است.
                    ردیف‌های کاملاً خالی نادیده گرفته می‌شوند.
                  </p>
                </div>

                <div className="category-bulk-table-wrapper">

                  <table className="category-bulk-table">

                    <thead>
                      <tr>
                        <th className="category-bulk-number">ردیف</th>
                        <th>نام دسته‌بندی</th>
                        <th>توضیحات</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr
                          key={row.rowId}
                          className={
                            bulkErrors[row.rowId]
                              ? 'category-row-invalid'
                              : ''
                          }
                        >

                          <td className="category-bulk-number">
                            {formatNumber(index + 1)}
                          </td>

                          <td>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(event) =>
                                updateBulkRow(row.rowId, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="نام دسته‌بندی..."
                              aria-label={`نام دسته‌بندی ردیف ${index + 1}`}
                            />

                            {bulkErrors[row.rowId] && (
                              <ul className="category-row-errors">
                                {bulkErrors[row.rowId].map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(event) =>
                                updateBulkRow(row.rowId, {
                                  description: event.target.value,
                                })
                              }
                              placeholder="توضیحات اختیاری..."
                              aria-label={`توضیحات ردیف ${index + 1}`}
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="category-row-remove"
                              onClick={() => removeBulkRow(row.rowId)}
                              title="حذف ردیف"
                              aria-label={`حذف ردیف ${index + 1}`}
                            >
                              ×
                            </button>
                          </td>

                        </tr>
                      ))}
                    </tbody>

                  </table>

                </div>

                <div className="category-bulk-add-row">
                  <div>
                    <button
                      type="button"
                      onClick={() => addBulkRows(1)}
                    >
                      + یک ردیف
                    </button>

                    <button
                      type="button"
                      onClick={() => addBulkRows(5)}
                    >
                      + پنج ردیف
                    </button>
                  </div>

                  <span>
                    {formatNumber(bulkRows.length)} ردیف
                  </span>
                </div>

                {bulkError && (
                  <div className="category-form-error" role="alert">
                    {bulkError}
                  </div>
                )}

                <footer className="category-modal-actions">
                  <button
                    type="button"
                    className="category-cancel-button"
                    onClick={closeForm}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="category-submit-button"
                  >
                    ثبت همه دسته‌بندی‌ها
                  </button>
                </footer>

              </form>
            )}

          </section>
        </div>
      )}

      {/* پنجره تأیید تغییر وضعیت یا حذف */}
      {confirmAction && (
        <div
          className="category-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmAction(null);
            }
          }}
        >
          <section
            className="category-confirm-modal"
            role="alertdialog"
            aria-modal="true"
          >

            <h2>
              {confirmAction.type === 'delete'
                ? 'حذف دسته‌بندی'
                : confirmAction.category.isActive
                  ? 'غیرفعال‌کردن دسته‌بندی'
                  : 'فعال‌کردن دسته‌بندی'}
            </h2>

            <p>
              آیا از انجام این عملیات برای دسته‌بندی
              {' '}
              <strong>«{confirmAction.category.name}»</strong>
              {' '}
              مطمئنی؟
            </p>

            {confirmAction.type === 'status' &&
              confirmAction.category.isActive && (
                <div className="category-confirm-hint">
                  کالاهای قبلی حذف نمی‌شوند؛ اما این دسته‌بندی برای
                  ثبت کالاهای جدید قابل انتخاب نخواهد بود.
                </div>
              )}

            <div className="category-confirm-actions">
              <button
                type="button"
                className="category-cancel-button"
                onClick={() => setConfirmAction(null)}
              >
                انصراف
              </button>

              <button
                type="button"
                className={
                  confirmAction.type === 'delete'
                    ? 'category-delete-confirm'
                    : 'category-submit-button'
                }
                onClick={handleConfirmAction}
              >
                {confirmAction.type === 'delete'
                  ? 'حذف دسته‌بندی'
                  : 'تأیید'}
              </button>
            </div>

          </section>
        </div>
      )}

    </div>
  );
}

export default CategoryList;
