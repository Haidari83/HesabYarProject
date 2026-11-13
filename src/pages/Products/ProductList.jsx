
import { useMemo, useState } from 'react';
import { useBusinessData } from '../../context/BusinessDataContext';
import './product-list.css';


// درصد افزایش پیش‌فرض روی قیمت خرید
const DEFAULT_PROFIT_RATE = 20;

// شمارنده شناسه ردیف‌های فرم
let rowSequence = 0;

// ساخت یک ردیف خالی برای ورود کالا
function createEmptyRow(
  profitRate = DEFAULT_PROFIT_RATE,
  categoryId = '',
  unitId = '',
) {
  rowSequence += 1;

  return {
    id: `row-${rowSequence}`,
    name: '',
    categoryId,
    unitId,
    purchasePrice: '',
    profitRate: String(profitRate),
    salePrice: '',
    salePriceMode: 'auto',
    duplicateResolution: '',
    existingProductId: '',
    updateExistingPrices: false,
    allowSameNameInBatch: false,
  };
}

// ساخت چند ردیف خالی
function createEmptyRows(
  count = 5,
  profitRate = DEFAULT_PROFIT_RATE,
  categoryId = '',
  unitId = '',
) {
  return Array.from(
    { length: count },
    () => createEmptyRow(profitRate, categoryId, unitId)
  );
}

// تبدیل اعداد به قالب فارسی
function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return '—';

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

// محاسبه قیمت فروش بر اساس درصد افزایش روی قیمت خرید
function calculateSalePrice(purchasePrice, profitRate) {
  const purchase = Number(purchasePrice);
  const rate = Number(profitRate);

  if (
    purchasePrice === '' ||
    profitRate === '' ||
    !Number.isFinite(purchase) ||
    !Number.isFinite(rate) ||
    purchase < 0 ||
    rate < 0
  ) {
    return '';
  }

  const result = purchase * (1 + rate / 100);

  // نگهداری حداکثر دو رقم اعشار
  return String(Math.round((result + Number.EPSILON) * 100) / 100);
}

// محاسبه درصد افزایش واقعی بر اساس دو قیمت
function calculateMarkup(purchasePrice, salePrice) {
  const purchase = Number(purchasePrice);
  const sale = Number(salePrice);

  if (
    purchasePrice === '' ||
    salePrice === '' ||
    !Number.isFinite(purchase) ||
    !Number.isFinite(sale) ||
    purchase <= 0
  ) {
    return '';
  }

  return String(
    Math.round((((sale - purchase) / purchase) * 100 + Number.EPSILON) * 100) / 100
  );
}

// یکسان‌سازی نام برای تشخیص تکراری بودن کالا
function normalizeProductName(value) {
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

// تولید کد جدید بر اساس بزرگ‌ترین شماره موجود
function getNextProductNumber(products) {
  const numbers = products.map((product) => {
    const match = String(product.code).match(/^PR-(\d+)$/);
    return match ? Number(match[1]) : 0;
  });

  return Math.max(0, ...numbers) + 1;
}

// تولید کد کالا
function generateProductCode(number) {
  return `PR-${String(number).padStart(6, '0')}`;
}

// نمایش درصد افزایش قیمت
function getProductMarkup(product) {
  return calculateMarkup(product.purchasePrice, product.salePrice);
}

function ProductList() {
  const {
    products,
    setProducts,
    categories,
    units,
  } = useBusinessData();

  // وضعیت فرم ویرایش کالا
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');

  // کالای انتخاب‌شده برای تغییر وضعیت
  const [statusTarget, setStatusTarget] = useState(null);

  // وضعیت جست‌وجو و فیلترها
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // وضعیت پنجره ثبت گروهی
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rows, setRows] = useState(() => createEmptyRows());
  const [defaultProfitRate, setDefaultProfitRate] = useState(
    String(DEFAULT_PROFIT_RATE)
  );

  // پیام‌های خطا و موفقیت
  const [rowErrors, setRowErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // محاسبه آمار کالاها
  const statistics = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((product) => product.isActive).length,
      categories: new Set(
        products.map((product) => product.categoryId).filter(Boolean)
      ).size,
    };
  }, [products]);

  // تمام دسته‌بندی‌ها
  const availableCategories = categories;

  // فقط دسته‌بندی‌های فعال
  const activeCategories = categories.filter(
    (category) => category.isActive
  );

  // فیلترکردن فهرست کالاها
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchValue = normalizeProductName(search);
      const productName = normalizeProductName(product.name);

      const matchesSearch =
        !searchValue ||
        productName.includes(searchValue) ||
        product.code.toLowerCase().includes(searchValue);

      const matchesCategory =
        categoryFilter === 'all' ||
        product.categoryId === categoryFilter;

      let matchesStatus = true;

      if (statusFilter === 'active') {
        matchesStatus = product.isActive;
      } else if (statusFilter === 'inactive') {
        matchesStatus = !product.isActive;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);


  // بررسی نام‌های مشابه با کالاهای دیگر هنگام ویرایش
  const editDuplicateProducts =
    editingProduct && editForm
      ? products.filter(
        (product) =>
          product.id !== editingProduct.id &&
          normalizeProductName(editForm.name) !== '' &&
          normalizeProductName(product.name) ===
          normalizeProductName(editForm.name)
      )
      : [];

  // واحدها
  const activeUnits = units.filter((unit) => unit.isActive);

  // دریافت نام واحد از شناسه آن
  function getUnitName(unitId) {
    return (
      units.find((unit) => unit.id === unitId)?.name ||
      'واحد نامشخص'
    );
  }

  // یافتن کالاهای ثبت‌شده با نام یکسان
  function findDuplicateProducts(name) {
    const normalizedName = normalizeProductName(name);

    if (!normalizedName) return [];

    return products.filter(
      (product) =>
        normalizeProductName(product.name) === normalizedName
    );
  }

  // یافتن نام‌های تکراری میان ردیف‌های فعلی فرم
  function findDuplicateRows(row) {
    const normalizedName = normalizeProductName(row.name);

    if (!normalizedName) return [];

    return rows.filter(
      (otherRow) =>
        otherRow.id !== row.id &&
        normalizeProductName(otherRow.name) === normalizedName
    );
  }

  // تغییر یک ردیف و به‌روزرسانی محاسبات وابسته
  function updateRow(rowId, changes) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;

        const nextRow = { ...row, ...changes };

        // با تغییر نام، انتخاب قبلی مربوط به تکراری بودن حذف شود
        if (Object.hasOwn(changes, 'name')) {
          nextRow.duplicateResolution = '';
          nextRow.existingProductId = '';
          nextRow.updateExistingPrices = false;
          nextRow.allowSameNameInBatch = false;
        }

        // اگر قیمت فروش دستی تغییر کرد، درصد افزایش واقعی محاسبه شود
        if (Object.hasOwn(changes, 'salePrice')) {
          nextRow.salePriceMode = 'manual';
          nextRow.profitRate = calculateMarkup(
            nextRow.purchasePrice,
            nextRow.salePrice
          );
        }

        // با تغییر درصد افزایش، قیمت فروش به حالت خودکار برمی‌گردد
        if (Object.hasOwn(changes, 'profitRate')) {
          nextRow.salePriceMode = 'auto';
          nextRow.salePrice = calculateSalePrice(
            nextRow.purchasePrice,
            nextRow.profitRate
          );
        }

        // تغییر قیمت خرید در حالت خودکار، قیمت فروش را نیز تغییر می‌دهد
        if (Object.hasOwn(changes, 'purchasePrice')) {
          if (nextRow.salePriceMode === 'auto') {
            nextRow.salePrice = calculateSalePrice(
              nextRow.purchasePrice,
              nextRow.profitRate
            );
          } else {
            nextRow.profitRate = calculateMarkup(
              nextRow.purchasePrice,
              nextRow.salePrice
            );
          }
        }

        return nextRow;
      })
    );

    setRowErrors({});
    setSubmitError('');
  }

  // تغییر حالت قیمت فروش به خودکار یا دستی
  function setSalePriceMode(rowId, mode) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;

        if (mode === 'auto') {
          return {
            ...row,
            salePriceMode: 'auto',
            salePrice: calculateSalePrice(
              row.purchasePrice,
              row.profitRate
            ),
          };
        }

        return {
          ...row,
          salePriceMode: 'manual',
        };
      })
    );

    setRowErrors({});
  }

  // بازکردن فرم ثبت گروهی
  function openBulkForm() {
    setRows(
      createEmptyRows(
        5,
        defaultProfitRate,
        activeCategories[0]?.id || '',
        activeUnits[0]?.id || '',
      )
    );

    setRowErrors({});
    setSubmitError('');
    setIsModalOpen(true);
  }

  // بستن فرم
  function closeBulkForm() {
    setIsModalOpen(false);
    setRowErrors({});
    setSubmitError('');
  }

  // افزودن ردیف جدید
  function addRows(count = 1) {
    setRows((currentRows) => [
      ...currentRows,
      ...createEmptyRows(
        count,
        defaultProfitRate,
        activeCategories[0]?.id || '',
        activeUnits[0]?.id || '',
      ),
    ]);
  }

  // حذف ردیف
  function removeRow(rowId) {
    setRows((currentRows) => {
      if (currentRows.length === 1) {
        return createEmptyRows(1, defaultProfitRate);
      }

      return currentRows.filter((row) => row.id !== rowId);
    });

    setRowErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[rowId];
      return nextErrors;
    });
  }

  // اعمال درصد پیش‌فرض به تمام ردیف‌ها
  function applyDefaultProfitRate() {
    const rate = Number(defaultProfitRate);

    if (!Number.isFinite(rate) || rate < 0 || defaultProfitRate.trim() === '') {
      setSubmitError('درصد پیش‌فرض سود باید یک عدد معتبر و غیرمنفی باشد.');
      return;
    }

    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        profitRate: String(rate),
        salePriceMode: 'auto',
        salePrice: calculateSalePrice(row.purchasePrice, rate),
      }))
    );

    setSubmitError('');
    setRowErrors({});
  }

  // تعیین نحوه استفاده از کالای تکراری
  function chooseDuplicateResolution(row, resolution, matches) {
    updateRow(row.id, {
      duplicateResolution: resolution,
      existingProductId:
        resolution === 'existing' && matches.length === 1
          ? String(matches[0].id)
          : '',
      updateExistingPrices: false,
    });
  }

  // اعتبارسنجی یک ردیف
  function validateRow(row) {
    const errors = [];

    if (!row.name.trim()) {
      errors.push('نام کالا را وارد کن.');
    }

    if (row.purchasePrice === '' || !Number.isFinite(Number(row.purchasePrice))) {
      errors.push('قیمت خرید معتبر نیست.');
    } else if (Number(row.purchasePrice) < 0) {
      errors.push('قیمت خرید نمی‌تواند منفی باشد.');
    }

    if (row.salePrice === '' || !Number.isFinite(Number(row.salePrice))) {
      errors.push('قیمت فروش معتبر نیست.');
    } else if (Number(row.salePrice) < 0) {
      errors.push('قیمت فروش نمی‌تواند منفی باشد.');
    }

    if (
      row.profitRate === '' ||
      !Number.isFinite(Number(row.profitRate)) ||
      Number(row.profitRate) < 0
    ) {
      errors.push('درصد افزایش معتبر نیست.');
    }

    const selectedCategory = categories.find(
      (category) => category.id === row.categoryId
    );

    if (!selectedCategory || !selectedCategory.isActive) {
      errors.push('یک دسته‌بندی فعال انتخاب کن.');
    }

    const matches = findDuplicateProducts(row.name);

    if (matches.length > 0) {
      if (!row.duplicateResolution) {
        errors.push('مشخص کن از کالای قبلی استفاده می‌کنی یا کالای جدید می‌سازی.');
      }

      if (
        row.duplicateResolution === 'existing' &&
        !matches.some(
          (product) => String(product.id) === row.existingProductId
        )
      ) {
        errors.push('کالای قبلی موردنظر را انتخاب کن.');
      }
    }

    const batchMatches = findDuplicateRows(row);

    if (batchMatches.length > 0 && !row.allowSameNameInBatch) {
      errors.push(
        'این نام در ردیف دیگری هم وارد شده است؛ مستقل بودن این کالا را تأیید کن.'
      );
    }

    const selectedUnit = units.find(
      (unit) => unit.id === row.unitId
    );

    if (!selectedUnit || !selectedUnit.isActive) {
      errors.push('یک واحد اندازه‌گیری فعال انتخاب کن.');
    }
    return errors;
  }

  // ثبت نهایی همه کالاها
  function handleBulkSubmit(event) {
    event.preventDefault();

    // ردیف‌های کاملاً خالی نادیده گرفته می‌شوند
    const filledRows = rows.filter(
      (row) =>
        row.name.trim() ||
        row.purchasePrice !== '' ||
        row.salePrice !== ''
    );

    if (filledRows.length === 0) {
      setSubmitError('حداقل اطلاعات یک کالا را وارد کن.');
      return;
    }

    const nextErrors = {};

    filledRows.forEach((row) => {
      const errors = validateRow(row);

      if (errors.length > 0) {
        nextErrors[row.id] = errors;
      }
    });

    // جلوگیری از انتخاب یک کالای قبلی در چند ردیف
    const selectedExistingIds = filledRows
      .filter(
        (row) => row.duplicateResolution === 'existing'
      )
      .map((row) => row.existingProductId)
      .filter(Boolean);

    const repeatedSelections = new Set(
      selectedExistingIds.filter(
        (id, index) => selectedExistingIds.indexOf(id) !== index
      )
    );

    filledRows.forEach((row) => {
      if (
        row.duplicateResolution === 'existing' &&
        repeatedSelections.has(row.existingProductId)
      ) {
        nextErrors[row.id] = [
          ...(nextErrors[row.id] || []),
          'این کالای قبلی در ردیف دیگری نیز انتخاب شده است.',
        ];
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setRowErrors(nextErrors);
      setSubmitError(
        'برخی ردیف‌ها نیازمند اصلاح یا تعیین تکلیف کالای تکراری هستند.'
      );
      return;
    }

    // ایجاد فهرست جدید با حفظ اطلاعات قبلی
    const nextProducts = [...products];
    let nextNumber = getNextProductNumber(nextProducts);

    let addedCount = 0;
    let updatedCount = 0;
    let reusedCount = 0;

    filledRows.forEach((row) => {
      const matches = findDuplicateProducts(row.name);

      // استفاده از کالای قبلی با همان کد
      if (
        matches.length > 0 &&
        row.duplicateResolution === 'existing'
      ) {
        const existingIndex = nextProducts.findIndex(
          (product) => String(product.id) === row.existingProductId
        );

        if (existingIndex !== -1) {
          if (row.updateExistingPrices) {
            nextProducts[existingIndex] = {
              ...nextProducts[existingIndex],
              purchasePrice: Number(row.purchasePrice),
              salePrice: Number(row.salePrice),
              categoryId: row.categoryId,
              unitId: row.unitId,
            };

            updatedCount += 1;
          } else {
            reusedCount += 1;
          }
        }

        return;
      }

      // ایجاد کالای جدید با کد خودکار
      const newProduct = {
        id: Date.now() + nextNumber,
        code: generateProductCode(nextNumber),
        name: row.name.trim(),
        categoryId: row.categoryId,
        unitId: row.unitId,
        purchasePrice: Number(row.purchasePrice),
        salePrice: Number(row.salePrice),
        stock: 0,
        isActive: true,
      };

      nextProducts.unshift(newProduct);
      nextNumber += 1;
      addedCount += 1;
    });

    setProducts(nextProducts);

    const messages = [];

    if (addedCount > 0) messages.push(`${formatNumber(addedCount)} کالای جدید`);
    if (updatedCount > 0) messages.push(`${formatNumber(updatedCount)} کالای به‌روزشده`);
    if (reusedCount > 0) messages.push(`${formatNumber(reusedCount)} کالای قبلی`);

    setSuccessMessage(
      `عملیات با موفقیت انجام شد: ${messages.join('، ')}.`
    );

    setIsModalOpen(false);
    setRows(createEmptyRows(5, defaultProfitRate));
    setRowErrors({});
    setSubmitError('');
  }

  // بازکردن فرم ویرایش کالا
  function openEditForm(product) {
    setEditingProduct(product);

    setEditForm({
      name: product.name,
      categoryId: product.categoryId,
      unitId: product.unitId,
      purchasePrice: String(product.purchasePrice),
      salePrice: String(product.salePrice),
      profitRate:
        calculateMarkup(product.purchasePrice, product.salePrice) ||
        defaultProfitRate,
      salePriceMode: 'manual',
      allowDuplicateName: false,
    });

    setEditError('');
  }

  // بستن فرم ویرایش
  function closeEditForm() {
    setEditingProduct(null);
    setEditForm(null);
    setEditError('');
  }

  // مدیریت تغییر فیلدهای فرم ویرایش
  function updateEditForm(changes) {
    setEditForm((previous) => {
      if (!previous) return previous;

      const next = { ...previous, ...changes };

      // با تغییر نام، تأیید قبلی نام تکراری باطل می‌شود
      if (Object.hasOwn(changes, 'name')) {
        next.allowDuplicateName = false;
      }

      // با تغییر مستقیم قیمت فروش، محاسبه به حالت دستی می‌رود
      if (Object.hasOwn(changes, 'salePrice')) {
        next.salePriceMode = 'manual';
        next.profitRate = calculateMarkup(
          next.purchasePrice,
          next.salePrice
        );
      }

      // تغییر درصد افزایش، قیمت فروش را دوباره محاسبه می‌کند
      if (Object.hasOwn(changes, 'profitRate')) {
        next.salePriceMode = 'auto';
        next.salePrice = calculateSalePrice(
          next.purchasePrice,
          next.profitRate
        );
      }

      // تغییر قیمت خرید متناسب با حالت محاسبه
      if (Object.hasOwn(changes, 'purchasePrice')) {
        if (next.salePriceMode === 'auto') {
          next.salePrice = calculateSalePrice(
            next.purchasePrice,
            next.profitRate
          );
        } else {
          next.profitRate = calculateMarkup(
            next.purchasePrice,
            next.salePrice
          );
        }
      }

      return next;
    });

    setEditError('');
  }

  // تغییر حالت محاسبه قیمت فروش
  function setEditSalePriceMode(mode) {
    setEditForm((previous) => {
      if (!previous) return previous;

      if (mode === 'auto') {
        return {
          ...previous,
          salePriceMode: 'auto',
          salePrice: calculateSalePrice(
            previous.purchasePrice,
            previous.profitRate
          ),
        };
      }

      return {
        ...previous,
        salePriceMode: 'manual',
      };
    });

    setEditError('');
  }

  // ثبت تغییرات کالا
  function handleEditSubmit(event) {
    event.preventDefault();

    if (!editingProduct || !editForm) return;

    const purchasePrice = Number(editForm.purchasePrice);
    const salePrice = Number(editForm.salePrice);
    const profitRate = Number(editForm.profitRate);

    // بررسی نام کالا
    if (!editForm.name.trim()) {
      setEditError('نام کالا را وارد کن.');
      return;
    }

    // بررسی قیمت خرید و فروش
    if (
      editForm.purchasePrice === '' ||
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0
    ) {
      setEditError('قیمت خرید معتبر نیست.');
      return;
    }

    if (
      editForm.salePrice === '' ||
      !Number.isFinite(salePrice) ||
      salePrice < 0
    ) {
      setEditError('قیمت فروش معتبر نیست.');
      return;
    }

    if (!Number.isFinite(profitRate) || profitRate < 0) {
      setEditError('درصد افزایش قیمت معتبر نیست.');
      return;
    }

    // جلوگیری از تغییر نام به نام کالای موجود بدون تأیید
    if (
      editDuplicateProducts.length > 0 &&
      !editForm.allowDuplicateName
    ) {
      setEditError(
        'نام این کالا مشابه کالای دیگری است. پس از بررسی، مستقل بودن آن را تأیید کن.'
      );
      return;
    }

    // بررسی معتبر بودن واحد انتخاب‌شده
    const selectedUnit = units.find(
      (unit) => unit.id === editForm.unitId
    );

    if (!selectedUnit) {
      setEditError('واحد انتخاب‌شده معتبر نیست.');
      return;
    }

    if (
      !selectedUnit.isActive &&
      selectedUnit.id !== editingProduct.unitId
    ) {
      setEditError('نمی‌توان کالا را به یک واحد غیرفعال منتقل کرد.');
      return;
    }

    // ذخیره تغییرات
    setProducts((previous) =>
      previous.map((product) =>
        product.id === editingProduct.id
          ? {
            ...product,
            name: editForm.name.trim(),
            categoryId: editForm.categoryId,
            unitId: editForm.unitId,
            purchasePrice,
            salePrice,
          }
          : product
      )
    );

    const selectedCategory = categories.find(
      (category) => category.id === editForm.categoryId
    );

    if (!selectedCategory) {
      setEditError('دسته‌بندی انتخاب‌شده معتبر نیست.');
      return;
    }

    if (
      !selectedCategory.isActive &&
      selectedCategory.id !== editingProduct.categoryId
    ) {
      setEditError('امکان انتقال کالا به یک دسته‌بندی غیرفعال وجود ندارد.');
      return;
    }

    // پیام موفقیت ثبت تغیرات
    setSuccessMessage(
      `اطلاعات کالای «${editForm.name.trim()}» با موفقیت ویرایش شد.`
    );

    // بستن فورم
    closeEditForm();
  }

  // بازکردن تأیید تغییر وضعیت
  function requestStatusChange(product) {
    setStatusTarget(product);
  }

  // تأیید تغییر وضعیت
  function confirmStatusChange() {
    if (!statusTarget) return;

    const nextStatus = !statusTarget.isActive;

    setProducts((previous) =>
      previous.map((product) =>
        product.id === statusTarget.id
          ? { ...product, isActive: nextStatus }
          : product
      )
    );

    setSuccessMessage(
      nextStatus
        ? `کالای «${statusTarget.name}» فعال شد.`
        : `کالای «${statusTarget.name}» غیرفعال شد.`
    );

    setStatusTarget(null);
  }

  return (
    <div className="product-page">

      {/* پیام موفقیت ثبت گروهی */}
      {successMessage && (
        <div className="product-success-message" role="status">
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

      {/* کارت‌های آماری */}
      <section className="product-statistics">

        <article className="product-stat-card">
          <div className="product-stat-icon total-icon">▦</div>
          <div>
            <span>تعداد کل کالاها</span>
            <strong>{formatNumber(statistics.total)}</strong>
          </div>
        </article>

        <article className="product-stat-card">
          <div className="product-stat-icon active-icon">✓</div>
          <div>
            <span>کالاهای فعال</span>
            <strong>{formatNumber(statistics.active)}</strong>
          </div>
        </article>

        <article className="product-stat-card">
          <div className="product-stat-icon category-icon">▤</div>
          <div>
            <span>تعداد دسته‌بندی‌ها</span>
            <strong>{formatNumber(statistics.categories)}</strong>
          </div>
        </article>

      </section>

      {/* ابزارهای جست‌وجو و فیلتر */}
      <section className="product-toolbar">

        <div className="product-search">
          <span className="product-search-icon">⌕</span>

          <input
            type="search"
            placeholder="جست‌وجوی نام یا کد کالا..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="product-filters">

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="فیلتر دسته‌بندی"
          >
            <option value="all">همه دسته‌بندی‌ها</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.isActive ? ' (غیرفعال)' : ''}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="فیلتر وضعیت کالا"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>

        </div>

        <button
          type="button"
          className="product-add-button"
          onClick={openBulkForm}
        >
          <span>+</span>
          ثبت گروهی کالاها
        </button>

      </section>

      {/* فهرست کالاها */}
      <section className="product-table-card">

        <div className="product-table-header">
          <div>
            <h2>فهرست کالاها</h2>
            <p>
              {formatNumber(filteredProducts.length)} کالا نمایش داده می‌شود
            </p>
          </div>
        </div>

        <div className="product-table-wrapper">
          <table className="product-table">
            <thead>
              <tr>
                <th>کد کالا</th>
                <th>نام کالا</th>
                <th>دسته‌بندی</th>
                <th>واحد</th>
                <th>قیمت خرید</th>
                <th>قیمت فروش</th>
                <th>موجودی فعلی</th>
                <th>افزایش قیمت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="product-code">{product.code}</td>
                  <td className="product-name">{product.name}</td>
                  <td>
                    {categories.find(
                      (category) => category.id === product.categoryId
                    )?.name || 'دسته‌بندی نامشخص'}
                  </td>
                  <td>{getUnitName(product.unitId)}</td>
                  <td>{formatNumber(product.purchasePrice)}</td>
                  <td>{formatNumber(product.salePrice)}</td>

                  <td>
                    <span
                      className={`product-stock-value ${Number(product.stock ?? 0) <= 0 ? 'empty' : ''
                        }`}
                    >
                      {formatNumber(product.stock ?? 0)}
                      {' '}
                      {
                        units.find((unit) => unit.id === product.unitId)?.name ||
                        'واحد نامشخص'
                      }
                    </span>
                  </td>

                  <td>
                    {getProductMarkup(product) === ''
                      ? '—'
                      : `${formatNumber(Number(getProductMarkup(product)))}٪`}
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
                      <button
                        type="button"
                        className="product-edit-action"
                        onClick={() => openEditForm(product)}
                      >
                        ویرایش
                      </button>

                      <button
                        type="button"
                        className={
                          product.isActive
                            ? 'product-deactivate-action'
                            : 'product-activate-action'
                        }
                        onClick={() => requestStatusChange(product)}
                      >
                        {product.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="10">
                    <div className="product-empty-state">
                      <span>⌕</span>
                      <strong>کالایی پیدا نشد</strong>
                      <p>عبارت جست‌وجو یا فیلترها را تغییر بده.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </section>

      {/* پنجره ثبت گروهی کالاها */}
      {isModalOpen && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBulkForm();
            }
          }}
        >
          <section
            className="product-bulk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >

            {/* سربرگ پنجره */}
            <header className="product-modal-header">
              <div>
                <h2 id="product-modal-title">ثبت گروهی کالاها</h2>
                <p>
                  کالاها را در ردیف‌های مختلف وارد کن و در پایان یک‌بار ثبت کن.
                </p>
              </div>

              <button
                type="button"
                className="product-modal-close"
                onClick={closeBulkForm}
                aria-label="بستن پنجره"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleBulkSubmit}>

              {/* تنظیم درصد پیش‌فرض */}
              <div className="product-bulk-settings">

                <div className="product-profit-default">
                  <label htmlFor="default-profit-rate">
                    درصد افزایش پیش‌فرض
                  </label>

                  <div className="product-percent-input">
                    <input
                      id="default-profit-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={defaultProfitRate}
                      onChange={(event) =>
                        setDefaultProfitRate(event.target.value)
                      }
                    />
                    <span>٪</span>
                  </div>

                  <span className="product-setting-hint">
                    برای ردیف‌های جدید
                  </span>
                </div>

                <button
                  type="button"
                  className="product-apply-default"
                  onClick={applyDefaultProfitRate}
                >
                  اعمال درصد به همه ردیف‌ها
                </button>

              </div>

              <div className="product-bulk-help">
                <span>ⓘ</span>
                <p>
                  کد کالا به‌صورت خودکار تولید می‌شود. موجودی اولیه را بعداً
                  از بخش انبار ثبت کن.
                </p>
              </div>

              {/* جدول ورود گروهی */}
              <div className="product-bulk-table-wrapper">
                <table className="product-bulk-table">

                  <thead>
                    <tr>
                      <th className="bulk-row-number">ردیف</th>
                      <th>نام کالا</th>
                      <th>کد کالا</th>
                      <th>دسته‌بندی</th>
                      <th>واحد</th>
                      <th>قیمت خرید</th>
                      <th>درصد افزایش</th>
                      <th>قیمت فروش</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => {
                      const duplicateMatches = findDuplicateProducts(row.name);
                      const batchMatches = findDuplicateRows(row);
                      const errors = rowErrors[row.id] || [];

                      return (
                        <tr key={row.id} className="product-bulk-row">

                          <td className="bulk-row-number">
                            {formatNumber(index + 1)}
                          </td>

                          {/* نام و بررسی تکراری بودن */}
                          <td className="bulk-name-cell">

                            <input
                              type="text"
                              value={row.name}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="نام کالا..."
                              aria-label={`نام کالا در ردیف ${index + 1}`}
                            />

                            {duplicateMatches.length > 0 && (
                              <div className="product-duplicate-box">
                                <strong>
                                  کالایی با این نام قبلاً ثبت شده است.
                                </strong>

                                <label className="product-choice">
                                  <input
                                    type="radio"
                                    name={`duplicate-${row.id}`}
                                    checked={
                                      row.duplicateResolution === 'existing'
                                    }
                                    onChange={() =>
                                      chooseDuplicateResolution(
                                        row,
                                        'existing',
                                        duplicateMatches
                                      )
                                    }
                                  />
                                  استفاده از کالای قبلی
                                </label>

                                {row.duplicateResolution === 'existing' && (
                                  <>
                                    {duplicateMatches.length > 1 && (
                                      <select
                                        value={row.existingProductId}
                                        onChange={(event) =>
                                          updateRow(row.id, {
                                            existingProductId: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="">
                                          انتخاب کالای قبلی
                                        </option>

                                        {duplicateMatches.map((product) => (
                                          <option
                                            key={product.id}
                                            value={String(product.id)}
                                          >
                                            {product.code} ـ {product.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    <label className="product-choice">
                                      <input
                                        type="checkbox"
                                        checked={row.updateExistingPrices}
                                        onChange={(event) =>
                                          updateRow(row.id, {
                                            updateExistingPrices: event.target.checked,
                                          })
                                        }
                                      />
                                      به‌روزرسانی قیمت‌های کالای قبلی
                                    </label>

                                    {!row.updateExistingPrices && (
                                      <small>
                                        قیمت‌های قبلی بدون تغییر باقی می‌مانند.
                                      </small>
                                    )}
                                  </>
                                )}

                                <label className="product-choice">
                                  <input
                                    type="radio"
                                    name={`duplicate-${row.id}`}
                                    checked={
                                      row.duplicateResolution === 'new'
                                    }
                                    onChange={() =>
                                      chooseDuplicateResolution(
                                        row,
                                        'new',
                                        duplicateMatches
                                      )
                                    }
                                  />
                                  ثبت به‌عنوان کالای جدید با کد مستقل
                                </label>
                              </div>
                            )}

                            {batchMatches.length > 0 && (
                              <div className="product-batch-duplicate">
                                <strong>
                                  این نام در {formatNumber(batchMatches.length)} ردیف دیگر نیز وجود دارد.
                                </strong>

                                <label className="product-choice">
                                  <input
                                    type="checkbox"
                                    checked={row.allowSameNameInBatch}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        allowSameNameInBatch: event.target.checked,
                                      })
                                    }
                                  />
                                  تأیید می‌کنم این کالا مستقل است.
                                </label>
                              </div>
                            )}

                            {errors.length > 0 && (
                              <ul className="product-row-errors">
                                {errors.map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            )}

                          </td>

                          {/* کد خودکار */}
                          <td>
                            <span className="product-auto-code">
                              خودکار
                            </span>
                          </td>

                          {/* دسته‌بندی */}
                          <td>
                            <select
                              value={row.categoryId}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  categoryId: event.target.value,
                                })
                              }
                            >
                              <option value="">انتخاب دسته‌بندی</option>

                              {activeCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* واحد */}
                          <td>
                            <select
                              value={row.unitId}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  unitId: event.target.value,
                                })
                              }
                            >
                              <option value="">انتخاب واحد</option>

                              {activeUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* قیمت خرید */}
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.purchasePrice}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  purchasePrice: event.target.value,
                                })
                              }
                              placeholder="۰"
                              aria-label={`قیمت خرید ردیف ${index + 1}`}
                            />
                          </td>

                          {/* درصد افزایش */}
                          <td>
                            <div className="product-table-percent">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.profitRate}
                                onChange={(event) =>
                                  updateRow(row.id, {
                                    profitRate: event.target.value,
                                  })
                                }
                                aria-label={`درصد افزایش ردیف ${index + 1}`}
                              />
                              <span>٪</span>
                            </div>
                          </td>

                          {/* قیمت فروش */}
                          <td>
                            <div className="product-sale-mode">
                              <button
                                type="button"
                                className={
                                  row.salePriceMode === 'auto' ? 'selected' : ''
                                }
                                onClick={() =>
                                  setSalePriceMode(row.id, 'auto')
                                }
                              >
                                خودکار
                              </button>

                              <button
                                type="button"
                                className={
                                  row.salePriceMode === 'manual' ? 'selected' : ''
                                }
                                onClick={() =>
                                  setSalePriceMode(row.id, 'manual')
                                }
                              >
                                دستی
                              </button>
                            </div>

                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.salePrice}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  salePrice: event.target.value,
                                })
                              }
                              placeholder="۰"
                              aria-label={`قیمت فروش ردیف ${index + 1}`}
                            />
                          </td>

                          {/* حذف ردیف */}
                          <td>
                            <button
                              type="button"
                              className="product-row-remove"
                              onClick={() => removeRow(row.id)}
                              aria-label={`حذف ردیف ${index + 1}`}
                              title="حذف ردیف"
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

              {/* افزودن ردیف و تعداد کالاها */}
              <div className="product-bulk-add-row">
                <div className="product-add-row-buttons">
                  <button
                    type="button"
                    onClick={() => addRows(1)}
                  >
                    + افزودن یک ردیف
                  </button>

                  <button
                    type="button"
                    onClick={() => addRows(5)}
                  >
                    + افزودن پنج ردیف
                  </button>
                </div>

                <span>
                  {formatNumber(rows.length)} ردیف
                </span>
              </div>

              {submitError && (
                <div className="product-form-error" role="alert">
                  {submitError}
                </div>
              )}

              {/* دکمه‌های نهایی */}
              <footer className="product-bulk-footer">
                <button
                  type="button"
                  className="product-cancel-button"
                  onClick={closeBulkForm}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="product-submit-button"
                >
                  ثبت همه کالاها
                </button>
              </footer>

            </form>
          </section>
        </div>
      )}


      {/* پنجره ویرایش کالا */}
      {editingProduct && editForm && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditForm();
            }
          }}
        >
          <section
            className="product-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-edit-title"
          >

            <header className="product-modal-header">
              <div>
                <h2 id="product-edit-title">ویرایش اطلاعات کالا</h2>
                <p>کد کالا: {editingProduct.code}</p>
              </div>

              <button
                type="button"
                className="product-modal-close"
                onClick={closeEditForm}
                aria-label="بستن پنجره"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleEditSubmit}>

              <div className="product-edit-form">

                <label className="product-edit-field">
                  <span>نام کالا</span>
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      updateEditForm({ name: event.target.value })
                    }
                    required
                  />
                </label>

                <label className="product-edit-field">
                  <span>دسته‌بندی</span>
                  <select
                    value={editForm.categoryId}
                    onChange={(event) =>
                      updateEditForm({ categoryId: event.target.value })
                    }
                  >
                    {availableCategories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="product-edit-field">
                  <span>واحد اندازه‌گیری</span>
                  <select
                    value={editForm.unitId}
                    onChange={(event) =>
                      updateEditForm({ unitId: event.target.value })
                    }
                  >
                    {units
                      .filter(
                        (unit) =>
                          unit.isActive ||
                          unit.id === editForm.unitId
                      )
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                          {!unit.isActive ? '(غیرفعال)' : ''}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="product-edit-field">
                  <span>قیمت خرید</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.purchasePrice}
                    onChange={(event) =>
                      updateEditForm({ purchasePrice: event.target.value })
                    }
                    required
                  />
                </label>

                <label className="product-edit-field">
                  <span>درصد افزایش قیمت</span>
                  <div className="product-edit-percent">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.profitRate}
                      onChange={(event) =>
                        updateEditForm({ profitRate: event.target.value })
                      }
                    />
                    <span>٪</span>
                  </div>
                </label>

                <label className="product-edit-field">
                  <span>قیمت فروش</span>

                  <div className="product-sale-mode">
                    <button
                      type="button"
                      className={
                        editForm.salePriceMode === 'auto' ? 'selected' : ''
                      }
                      onClick={() => setEditSalePriceMode('auto')}
                    >
                      خودکار
                    </button>

                    <button
                      type="button"
                      className={
                        editForm.salePriceMode === 'manual' ? 'selected' : ''
                      }
                      onClick={() => setEditSalePriceMode('manual')}
                    >
                      دستی
                    </button>
                  </div>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.salePrice}
                    onChange={(event) =>
                      updateEditForm({ salePrice: event.target.value })
                    }
                    required
                  />
                </label>

              </div>

              {editDuplicateProducts.length > 0 && (
                <div className="product-edit-duplicate">
                  <strong>
                    کالای دیگری با همین نام وجود دارد.
                  </strong>

                  {editDuplicateProducts.map((product) => (
                    <span key={product.id}>
                      {product.name} ـ {product.code}
                    </span>
                  ))}

                  <label className="product-choice">
                    <input
                      type="checkbox"
                      checked={editForm.allowDuplicateName}
                      onChange={(event) =>
                        updateEditForm({
                          allowDuplicateName: event.target.checked,
                        })
                      }
                    />
                    تأیید می‌کنم این کالا مستقل از کالای مشابه است.
                  </label>
                </div>
              )}

              {editError && (
                <div className="product-form-error" role="alert">
                  {editError}
                </div>
              )}

              <footer className="product-bulk-footer">
                <button
                  type="button"
                  className="product-cancel-button"
                  onClick={closeEditForm}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="product-submit-button"
                >
                  ذخیره تغییرات
                </button>
              </footer>

            </form>
          </section>
        </div>
      )}


      {/* پنجره تأیید تغییر وضعیت کالا */}
      {statusTarget && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStatusTarget(null);
            }
          }}
        >
          <section
            className="product-status-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="product-status-title"
          >

            <div className="product-status-modal-icon">
              {statusTarget.isActive ? '!' : '✓'}
            </div>

            <h2 id="product-status-title">
              {statusTarget.isActive
                ? 'غیرفعال‌کردن کالا'
                : 'فعال‌کردن کالا'}
            </h2>

            <p>
              آیا مطمئنی می‌خواهی کالای
              {' '}
              <strong>«{statusTarget.name}»</strong>
              {' '}
              را {statusTarget.isActive ? 'غیرفعال' : 'فعال'} کنی؟
            </p>

            {statusTarget.isActive && (
              <div className="product-status-warning">
                غیرفعال‌کردن کالا به معنای حذف آن نیست.
                اطلاعات کالا و سوابق اسناد قبلی حفظ خواهند شد.
              </div>
            )}

            <div className="product-status-actions">
              <button
                type="button"
                className="product-cancel-button"
                onClick={() => setStatusTarget(null)}
              >
                انصراف
              </button>

              <button
                type="button"
                className={
                  statusTarget.isActive
                    ? 'product-confirm-deactivate'
                    : 'product-confirm-activate'
                }
                onClick={confirmStatusChange}
              >
                {statusTarget.isActive ? 'بله، غیرفعال کن' : 'بله، فعال کن'}
              </button>
            </div>

          </section>
        </div>
      )}


    </div>
  );
}

export default ProductList;
