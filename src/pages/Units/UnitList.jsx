
import { useMemo, useState } from 'react';
import { useBusinessData } from '../../context/BusinessDataContext.jsx';
import './unit-list.css';

// انواع کمیت‌های قابل تعریف
const dimensions = [
  { value: 'count', label: 'شمارشی' },
  { value: 'mass', label: 'وزن' },
  { value: 'volume', label: 'حجم' },
  { value: 'length', label: 'طول' },
  { value: 'package', label: 'بسته‌بندی' },
];

// تبدیل کد نوع کمیت به عنوان فارسی
function getDimensionLabel(value) {
  return dimensions.find((item) => item.value === value)?.label || 'نامشخص';
}

// یکسان‌سازی متن برای تشخیص موارد تکراری
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

// نمایش اعداد فارسی
function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

// تولید شناسه آزمایشی واحد
function createUnitId() {
  return `UNIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// تولید شناسه آزمایشی تبدیل
function createConversionId() {
  return `CONV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ساخت ردیف خالی برای ثبت گروهی
function createEmptyRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    symbol: '',
    dimension: 'count',
    decimalPlaces: '0',
  };
}

function createEmptyRows(count = 5) {
  return Array.from({ length: count }, createEmptyRow);
}

const emptyUnitForm = {
  name: '',
  symbol: '',
  dimension: 'count',
  decimalPlaces: '0',
};

const emptyConversionForm = {
  fromUnitId: '',
  toUnitId: '',
  factor: '',
};

function UnitList() {
  const {
    units,
    setUnits,
    unitConversions,
    setUnitConversions,
    products,
  } = useBusinessData();

  // انتخاب بخش واحدها یا تبدیل‌ها
  const [activeTab, setActiveTab] = useState('units');

  // جست‌وجو و فیلتر واحدها
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // وضعیت فرم واحد
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitFormMode, setUnitFormMode] = useState('single');
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [unitRows, setUnitRows] = useState(() => createEmptyRows());
  const [unitError, setUnitError] = useState('');
  const [unitRowErrors, setUnitRowErrors] = useState({});

  // وضعیت فرم تبدیل
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [editingConversionId, setEditingConversionId] = useState(null);
  const [conversionForm, setConversionForm] = useState(emptyConversionForm);
  const [conversionError, setConversionError] = useState('');

  // پنجره تأیید عملیات
  const [confirmAction, setConfirmAction] = useState(null);

  // پیام نتیجه عملیات
  const [successMessage, setSuccessMessage] = useState('');

  // محاسبه تعداد کالاهای وابسته به هر واحد
  const unitProductCounts = useMemo(() => {
    const counts = new Map();

    products.forEach((product) => {
      if (!product.unitId) return;

      counts.set(
        product.unitId,
        (counts.get(product.unitId) || 0) + 1
      );
    });

    return counts;
  }, [products]);

  // شناسه واحدهایی که در تبدیل‌ها استفاده شده‌اند
  const conversionUnitIds = useMemo(() => {
    const ids = new Set();

    unitConversions.forEach((conversion) => {
      ids.add(conversion.fromUnitId);
      ids.add(conversion.toUnitId);
    });

    return ids;
  }, [unitConversions]);

  // فقط واحدهای فعال
  const activeUnits = useMemo(
    () => units.filter((unit) => unit.isActive),
    [units]
  );

  // فهرست واحدهای فیلترشده
  const filteredUnits = useMemo(() => {
    const searchValue = normalizeName(search);

    return units.filter((unit) => {
      const matchesSearch =
        !searchValue ||
        normalizeName(unit.name).includes(searchValue) ||
        normalizeName(unit.symbol).includes(searchValue);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && unit.isActive) ||
        (statusFilter === 'inactive' && !unit.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [units, search, statusFilter]);

  // آمار واحدها
  const statistics = useMemo(() => ({
    total: units.length,
    active: units.filter((unit) => unit.isActive).length,
    inactive: units.filter((unit) => !unit.isActive).length,
    used: units.filter(
      (unit) => (unitProductCounts.get(unit.id) || 0) > 0
    ).length,
    conversions: unitConversions.length,
  }), [units, unitProductCounts, unitConversions]);

  // تعداد کالاهای استفاده‌کننده از واحد
  function getUnitProductCount(unitId) {
    return unitProductCounts.get(unitId) || 0;
  }

  // بررسی ارتباط واحد با کالا یا تبدیل
  function isUnitReferenced(unitId) {
    return (
      getUnitProductCount(unitId) > 0 ||
      conversionUnitIds.has(unitId)
    );
  }

  // بررسی نام و نماد تکراری
  function findUnitDuplicate(name, symbol, excludedId = null) {
    const normalizedName = normalizeName(name);
    const normalizedSymbol = normalizeName(symbol);

    return units.some((unit) => {
      if (unit.id === excludedId) return false;

      return (
        normalizeName(unit.name) === normalizedName ||
        normalizeName(unit.symbol) === normalizedSymbol
      );
    });
  }

  // بازکردن فرم ثبت تکی
  function openSingleUnitForm() {
    setUnitFormMode('single');
    setEditingUnitId(null);
    setUnitForm({ ...emptyUnitForm });
    setUnitError('');
    setIsUnitModalOpen(true);
  }

  // بازکردن فرم ثبت گروهی
  function openBulkUnitForm() {
    setUnitFormMode('bulk');
    setEditingUnitId(null);
    setUnitRows(createEmptyRows());
    setUnitRowErrors({});
    setUnitError('');
    setIsUnitModalOpen(true);
  }

  // بازکردن فرم ویرایش واحد
  function openEditUnitForm(unit) {
    setUnitFormMode('single');
    setEditingUnitId(unit.id);

    setUnitForm({
      name: unit.name,
      symbol: unit.symbol,
      dimension: unit.dimension,
      decimalPlaces: String(unit.decimalPlaces),
    });

    setUnitError('');
    setIsUnitModalOpen(true);
  }

  // بستن فرم واحد
  function closeUnitForm() {
    setIsUnitModalOpen(false);
    setEditingUnitId(null);
    setUnitError('');
    setUnitRowErrors({});
  }

  // تغییر اطلاعات فرم تکی
  function handleUnitFormChange(event) {
    const { name, value } = event.target;

    setUnitForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setUnitError('');
  }

  // ثبت یا ویرایش واحد
  function handleSingleUnitSubmit(event) {
    event.preventDefault();

    const name = unitForm.name.trim();
    const symbol = unitForm.symbol.trim();
    const decimalPlaces = Number(unitForm.decimalPlaces);

    if (!name || !symbol) {
      setUnitError('نام و نماد واحد الزامی است.');
      return;
    }

    if (
      !Number.isInteger(decimalPlaces) ||
      decimalPlaces < 0 ||
      decimalPlaces > 6
    ) {
      setUnitError('دقت اعشاری باید عدد صحیحی بین صفر تا شش باشد.');
      return;
    }

    if (findUnitDuplicate(name, symbol, editingUnitId)) {
      setUnitError('نام یا نماد این واحد قبلاً ثبت شده است.');
      return;
    }

    if (editingUnitId) {
      const oldUnit = units.find((unit) => unit.id === editingUnitId);

      if (
        isUnitReferenced(editingUnitId) &&
        oldUnit.dimension !== unitForm.dimension
      ) {
        setUnitError(
          'نوع کمیت این واحد به دلیل استفاده در کالاها یا تبدیل‌ها قابل تغییر نیست.'
        );
        return;
      }

      setUnits((previous) =>
        previous.map((unit) =>
          unit.id === editingUnitId
            ? {
              ...unit,
              name,
              symbol,
              dimension: unitForm.dimension,
              decimalPlaces,
            }
            : unit
        )
      );

      setSuccessMessage(`واحد «${name}» با موفقیت ویرایش شد.`);
    } else {
      setUnits((previous) => [
        ...previous,
        {
          id: createUnitId(),
          name,
          symbol,
          dimension: unitForm.dimension,
          decimalPlaces,
          isActive: true,
        },
      ]);

      setSuccessMessage(`واحد «${name}» با موفقیت ثبت شد.`);
    }

    closeUnitForm();
  }

  // تغییر یک ردیف ثبت گروهی
  function updateUnitRow(rowId, changes) {
    setUnitRows((previous) =>
      previous.map((row) =>
        row.id === rowId ? { ...row, ...changes } : row
      )
    );

    setUnitRowErrors({});
    setUnitError('');
  }

  // افزودن ردیف
  function addUnitRows(count = 1) {
    setUnitRows((previous) => [
      ...previous,
      ...createEmptyRows(count),
    ]);
  }

  // حذف ردیف
  function removeUnitRow(rowId) {
    setUnitRows((previous) => {
      if (previous.length === 1) return createEmptyRows(1);

      return previous.filter((row) => row.id !== rowId);
    });

    setUnitRowErrors((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  }

  // ثبت گروهی واحدها
  function handleBulkUnitSubmit(event) {
    event.preventDefault();

    const filledRows = unitRows.filter(
      (row) => row.name.trim() || row.symbol.trim()
    );

    if (filledRows.length === 0) {
      setUnitError('حداقل یک واحد را وارد کن.');
      return;
    }

    const errors = {};
    const seenNames = new Map();
    const seenSymbols = new Map();

    filledRows.forEach((row) => {
      const rowErrors = [];
      const name = normalizeName(row.name);
      const symbol = normalizeName(row.symbol);
      const decimalPlaces = Number(row.decimalPlaces);

      if (!name) {
        rowErrors.push('نام واحد الزامی است.');
      } else {
        if (findUnitDuplicate(name, symbol)) {
          rowErrors.push('نام یا نماد این واحد قبلاً ثبت شده است.');
        }

        if (seenNames.has(name)) {
          rowErrors.push('نام این واحد در ردیف دیگری نیز تکرار شده است.');
          const previousId = seenNames.get(name);
          errors[previousId] = [
            ...(errors[previousId] || []),
            'نام این واحد در ردیف دیگری نیز تکرار شده است.',
          ];
        } else {
          seenNames.set(name, row.id);
        }
      }

      if (!symbol) {
        rowErrors.push('نماد واحد الزامی است.');
      } else {
        if (seenSymbols.has(symbol)) {
          rowErrors.push('نماد این واحد در ردیف دیگری نیز تکرار شده است.');
          const previousId = seenSymbols.get(symbol);
          errors[previousId] = [
            ...(errors[previousId] || []),
            'نماد این واحد در ردیف دیگری نیز تکرار شده است.',
          ];
        } else {
          seenSymbols.set(symbol, row.id);
        }
      }

      if (
        !Number.isInteger(decimalPlaces) ||
        decimalPlaces < 0 ||
        decimalPlaces > 6
      ) {
        rowErrors.push('دقت اعشاری باید بین صفر تا شش باشد.');
      }

      if (rowErrors.length > 0) {
        errors[row.id] = [
          ...(errors[row.id] || []),
          ...rowErrors,
        ];
      }
    });

    // در صورت وجود خطا، هیچ واحدی ثبت نمی‌شود
    if (Object.keys(errors).length > 0) {
      setUnitRowErrors(errors);
      setUnitError('ردیف‌های مشخص‌شده را اصلاح کن.');
      return;
    }

    const newUnits = filledRows.map((row) => ({
      id: createUnitId(),
      name: row.name.trim(),
      symbol: row.symbol.trim(),
      dimension: row.dimension,
      decimalPlaces: Number(row.decimalPlaces),
      isActive: true,
    }));

    setUnits((previous) => [...previous, ...newUnits]);

    setSuccessMessage(
      `${formatNumber(newUnits.length)} واحد با موفقیت ثبت شد.`
    );

    closeUnitForm();
  }

  // درخواست فعال‌سازی یا غیرفعال‌سازی
  function requestUnitStatusChange(unit) {
    setConfirmAction({
      type: 'unit-status',
      unit,
    });
  }

  // درخواست حذف واحد
  function requestUnitDelete(unit) {
    if (isUnitReferenced(unit.id)) return;

    setConfirmAction({
      type: 'unit-delete',
      unit,
    });
  }

  // واحدهای سازگار با واحد مبدأ تبدیل
  function getCompatibleUnits(fromUnitId) {
    const fromUnit = units.find((unit) => unit.id === fromUnitId);

    if (!fromUnit || fromUnit.dimension === 'package') return [];

    return units.filter(
      (unit) =>
        unit.id !== fromUnitId &&
        unit.dimension === fromUnit.dimension &&
        unit.dimension !== 'package' &&
        unit.isActive
    );
  }

  // بازکردن فرم تعریف تبدیل
  function openAddConversionForm() {
    const firstUnit = activeUnits.find(
      (unit) => unit.dimension === 'mass'
    ) || activeUnits.find(
      (unit) => unit.dimension !== 'package'
    );

    if (!firstUnit) {
      setSuccessMessage('برای تعریف تبدیل، ابتدا واحدهای فعال و هم‌نوع ایجاد کن.');
      return;
    }

    const targets = getCompatibleUnits(firstUnit.id);

    if (targets.length === 0) {
      setSuccessMessage('برای این واحد، واحد دیگری با نوع کمیت یکسان وجود ندارد.');
      return;
    }

    setEditingConversionId(null);

    setConversionForm({
      fromUnitId: firstUnit.id,
      toUnitId: targets[0].id,
      factor:
        firstUnit.id === 'UNIT-002' && targets[0].id === 'UNIT-003'
          ? '1000'
          : '1',
    });

    setConversionError('');
    setIsConversionModalOpen(true);
  }

  // بازکردن فرم ویرایش تبدیل
  function openEditConversionForm(conversion) {
    setEditingConversionId(conversion.id);

    setConversionForm({
      fromUnitId: conversion.fromUnitId,
      toUnitId: conversion.toUnitId,
      factor: String(conversion.factor),
    });

    setConversionError('');
    setIsConversionModalOpen(true);
  }

  // بستن فرم تبدیل
  function closeConversionForm() {
    setIsConversionModalOpen(false);
    setEditingConversionId(null);
    setConversionError('');
  }

  // تغییر واحد مبدأ و انتخاب مقصد سازگار
  function handleFromUnitChange(fromUnitId) {
    const targets = getCompatibleUnits(fromUnitId);

    setConversionForm((previous) => ({
      ...previous,
      fromUnitId,
      toUnitId: targets[0]?.id || '',
    }));

    setConversionError('');
  }

  // ثبت یا ویرایش تبدیل
  function handleConversionSubmit(event) {
    event.preventDefault();

    const fromUnit = units.find(
      (unit) => unit.id === conversionForm.fromUnitId
    );

    const toUnit = units.find(
      (unit) => unit.id === conversionForm.toUnitId
    );

    const factor = Number(conversionForm.factor);

    if (!fromUnit || !toUnit) {
      setConversionError('واحد مبدأ و مقصد را انتخاب کن.');
      return;
    }

    if (
      fromUnit.id === toUnit.id ||
      fromUnit.dimension !== toUnit.dimension ||
      fromUnit.dimension === 'package'
    ) {
      setConversionError('تبدیل فقط بین واحدهای متفاوت و هم‌نوع مجاز است.');
      return;
    }

    if (
      !editingConversionId &&
      (!fromUnit.isActive || !toUnit.isActive)
    ) {
      setConversionError('برای تبدیل جدید باید هر دو واحد فعال باشند.');
      return;
    }

    if (!Number.isFinite(factor) || factor <= 0) {
      setConversionError('ضریب تبدیل باید عددی بزرگ‌تر از صفر باشد.');
      return;
    }

    // جلوگیری از تعریف مجدد همان تبدیل یا تبدیل معکوس
    const duplicate = unitConversions.some((item) => {
      if (item.id === editingConversionId) return false;

      const sameDirection =
        item.fromUnitId === fromUnit.id &&
        item.toUnitId === toUnit.id;

      const reverseDirection =
        item.fromUnitId === toUnit.id &&
        item.toUnitId === fromUnit.id;

      return sameDirection || reverseDirection;
    });

    if (duplicate) {
      setConversionError('برای این دو واحد قبلاً تبدیل تعریف شده است.');
      return;
    }

    const conversionData = {
      id: editingConversionId || createConversionId(),
      fromUnitId: fromUnit.id,
      toUnitId: toUnit.id,
      factor,
    };

    if (editingConversionId) {
      setUnitConversions((previous) =>
        previous.map((item) =>
          item.id === editingConversionId ? conversionData : item
        )
      );

      setSuccessMessage('تبدیل واحد با موفقیت ویرایش شد.');
    } else {
      setUnitConversions((previous) => [
        ...previous,
        conversionData,
      ]);

      setSuccessMessage('تبدیل واحد با موفقیت ثبت شد.');
    }

    closeConversionForm();
  }

  // درخواست حذف تبدیل
  function requestConversionDelete(conversion) {
    setConfirmAction({
      type: 'conversion-delete',
      conversion,
    });
  }

  // اجرای عملیات تأییدشده
  function handleConfirmAction() {
    if (!confirmAction) return;

    if (confirmAction.type === 'unit-status') {
      const { unit } = confirmAction;
      const nextStatus = !unit.isActive;

      setUnits((previous) =>
        previous.map((item) =>
          item.id === unit.id
            ? { ...item, isActive: nextStatus }
            : item
        )
      );

      setSuccessMessage(
        nextStatus
          ? `واحد «${unit.name}» فعال شد.`
          : `واحد «${unit.name}» غیرفعال شد.`
      );
    }

    if (confirmAction.type === 'unit-delete') {
      const { unit } = confirmAction;

      // بررسی مجدد وابستگی پیش از حذف
      if (isUnitReferenced(unit.id)) {
        setSuccessMessage('این واحد در کالاها یا تبدیل‌ها استفاده شده است و قابل حذف نیست.');
      } else {
        setUnits((previous) =>
          previous.filter((item) => item.id !== unit.id)
        );

        setSuccessMessage(`واحد «${unit.name}» حذف شد.`);
      }
    }

    if (confirmAction.type === 'conversion-delete') {
      const { conversion } = confirmAction;

      setUnitConversions((previous) =>
        previous.filter((item) => item.id !== conversion.id)
      );

      setSuccessMessage('تبدیل واحد حذف شد.');
    }

    setConfirmAction(null);
  }

  // دریافت نام واحد از شناسه
  function getUnitName(unitId) {
    return units.find((unit) => unit.id === unitId)?.name || 'واحد نامشخص';
  }

  // دریافت نماد واحد از شناسه
  function getUnitSymbol(unitId) {
    return units.find((unit) => unit.id === unitId)?.symbol || '—';
  }

  // واحدهای مقصد مجاز در فرم تبدیل
  const conversionTargets = units.filter((unit) => {
    const fromUnit = units.find(
      (item) => item.id === conversionForm.fromUnitId
    );

    return (
      fromUnit &&
      unit.id !== fromUnit.id &&
      unit.dimension === fromUnit.dimension &&
      unit.dimension !== 'package' &&
      (unit.isActive || unit.id === conversionForm.toUnitId)
    );
  });

  return (
    <div className="unit-page">

      {/* پیام نتیجه عملیات */}
      {successMessage && (
        <div className="unit-success-message" role="status">
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
      <section className="unit-statistics">

        <article className="unit-stat-card">
          <span className="unit-stat-icon total">▤</span>
          <div>
            <p>کل واحدها</p>
            <strong>{formatNumber(statistics.total)}</strong>
          </div>
        </article>

        <article className="unit-stat-card">
          <span className="unit-stat-icon active">✓</span>
          <div>
            <p>واحدهای فعال</p>
            <strong>{formatNumber(statistics.active)}</strong>
          </div>
        </article>

        <article className="unit-stat-card">
          <span className="unit-stat-icon used">▦</span>
          <div>
            <p>واحدهای استفاده‌شده</p>
            <strong>{formatNumber(statistics.used)}</strong>
          </div>
        </article>

        <article className="unit-stat-card">
          <span className="unit-stat-icon conversion">⇄</span>
          <div>
            <p>تبدیل‌های تعریف‌شده</p>
            <strong>{formatNumber(statistics.conversions)}</strong>
          </div>
        </article>

      </section>

      {/* انتخاب بخش‌ها */}
      <div className="unit-tabs">
        <button
          type="button"
          className={activeTab === 'units' ? 'active' : ''}
          onClick={() => setActiveTab('units')}
        >
          واحدهای اندازه‌گیری
        </button>

        <button
          type="button"
          className={activeTab === 'conversions' ? 'active' : ''}
          onClick={() => setActiveTab('conversions')}
        >
          تبدیل واحدها
        </button>
      </div>

      {/* بخش مدیریت واحدها */}
      {activeTab === 'units' && (
        <>
          <section className="unit-toolbar">

            <div className="unit-search">
              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجوی نام یا نماد واحد..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="فیلتر وضعیت واحد"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>

            <div className="unit-add-actions">
              <button
                type="button"
                className="unit-add-single"
                onClick={openSingleUnitForm}
              >
                + افزودن تکی
              </button>

              <button
                type="button"
                className="unit-add-bulk"
                onClick={openBulkUnitForm}
              >
                + افزودن گروهی
              </button>
            </div>

          </section>

          <section className="unit-table-card">

            <header className="unit-table-header">
              <div>
                <h2>فهرست واحدهای اندازه‌گیری</h2>
                <p>
                  {formatNumber(filteredUnits.length)} واحد
                </p>
              </div>
            </header>

            <div className="unit-table-wrapper">
              <table className="unit-table">

                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>نام واحد</th>
                    <th>نماد</th>
                    <th>نوع کمیت</th>
                    <th>دقت اعشاری</th>
                    <th>تعداد کالاها</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUnits.map((unit, index) => {
                    const productCount = getUnitProductCount(unit.id);
                    const isReferenced = isUnitReferenced(unit.id);

                    return (
                      <tr key={unit.id}>

                        <td>{formatNumber(index + 1)}</td>

                        <td className="unit-name">{unit.name}</td>

                        <td className="unit-symbol">{unit.symbol}</td>

                        <td>{getDimensionLabel(unit.dimension)}</td>

                        <td>{formatNumber(unit.decimalPlaces)}</td>

                        <td>
                          <span className="unit-product-count">
                            {formatNumber(productCount)} کالا
                          </span>
                        </td>

                        <td>
                          <span
                            className={`unit-status ${unit.isActive ? 'active' : 'inactive'
                              }`}
                          >
                            {unit.isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        </td>

                        <td>
                          <div className="unit-actions">

                            <button
                              type="button"
                              className="unit-edit-action"
                              onClick={() => openEditUnitForm(unit)}
                            >
                              ویرایش
                            </button>

                            <button
                              type="button"
                              className={
                                unit.isActive
                                  ? 'unit-deactivate-action'
                                  : 'unit-activate-action'
                              }
                              onClick={() => requestUnitStatusChange(unit)}
                            >
                              {unit.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                            </button>

                            <button
                              type="button"
                              className="unit-delete-action"
                              disabled={isReferenced}
                              title={
                                isReferenced
                                  ? 'این واحد در کالاها یا تبدیل‌ها استفاده شده است.'
                                  : 'حذف واحد'
                              }
                              onClick={() => requestUnitDelete(unit)}
                            >
                              حذف
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {filteredUnits.length === 0 && (
                    <tr>
                      <td colSpan="8">
                        <div className="unit-empty-state">
                          <strong>واحدی پیدا نشد</strong>
                          <p>جست‌وجو یا فیلتر را تغییر بده.</p>
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

      {/* بخش مدیریت تبدیل‌ها */}
      {activeTab === 'conversions' && (
        <section className="unit-table-card">

          <header className="unit-table-header">
            <div>
              <h2>تبدیل واحدها</h2>
              <p>
                تبدیل بین واحدهای هم‌نوع را تعریف و مدیریت کن.
              </p>
            </div>

            <button
              type="button"
              className="unit-add-conversion"
              onClick={openAddConversionForm}
            >
              + افزودن تبدیل
            </button>
          </header>

          <div className="unit-conversion-info">
            تبدیل‌ها جهت‌دار هستند. مثلاً یک کیلوگرام برابر با ۱۰۰۰ گرام است.
            تبدیل‌های بسته‌بندی باید در سطح هر کالا تعریف شوند.
          </div>

          <div className="unit-table-wrapper">
            <table className="unit-table">

              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>واحد مبدأ</th>
                  <th>واحد مقصد</th>
                  <th>ضریب تبدیل</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {unitConversions.map((conversion, index) => (
                  <tr key={conversion.id}>

                    <td>{formatNumber(index + 1)}</td>

                    <td>
                      {getUnitName(conversion.fromUnitId)}
                      {' '}
                      ({getUnitSymbol(conversion.fromUnitId)})
                    </td>

                    <td>
                      {getUnitName(conversion.toUnitId)}
                      {' '}
                      ({getUnitSymbol(conversion.toUnitId)})
                    </td>

                    <td className="unit-conversion-factor">
                      ۱ = {formatNumber(conversion.factor)}
                    </td>

                    <td>
                      <div className="unit-actions">

                        <button
                          type="button"
                          className="unit-edit-action"
                          onClick={() => openEditConversionForm(conversion)}
                        >
                          ویرایش
                        </button>

                        <button
                          type="button"
                          className="unit-delete-action"
                          onClick={() => requestConversionDelete(conversion)}
                        >
                          حذف
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}

                {unitConversions.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="unit-empty-state">
                        <strong>هنوز تبدیلی تعریف نشده است.</strong>
                        <p>برای شروع، یک تبدیل جدید اضافه کن.</p>
                      </div>
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

        </section>
      )}

      {/* فرم افزودن یا ویرایش واحد */}
      {isUnitModalOpen && (
        <div
          className="unit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUnitForm();
          }}
        >
          <section
            className={`unit-modal ${unitFormMode === 'bulk' ? 'unit-bulk-modal' : ''
              }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-modal-title"
          >

            <header className="unit-modal-header">
              <div>
                <h2 id="unit-modal-title">
                  {editingUnitId
                    ? 'ویرایش واحد اندازه‌گیری'
                    : unitFormMode === 'single'
                      ? 'افزودن واحد جدید'
                      : 'افزودن گروهی واحدها'}
                </h2>

                <p>
                  {unitFormMode === 'bulk'
                    ? 'اطلاعات چند واحد را وارد کن و همه را یک‌جا ثبت کن.'
                    : 'مشخصات واحد اندازه‌گیری را وارد کن.'}
                </p>
              </div>

              <button
                type="button"
                className="unit-modal-close"
                onClick={closeUnitForm}
                aria-label="بستن"
              >
                ×
              </button>
            </header>

            {/* فرم ثبت تکی یا ویرایش */}
            {unitFormMode === 'single' && (
              <form
                className="unit-single-form"
                onSubmit={handleSingleUnitSubmit}
              >

                <div className="unit-form-grid">

                  <label className="unit-form-field">
                    <span>نام واحد</span>

                    <input
                      name="name"
                      value={unitForm.name}
                      onChange={handleUnitFormChange}
                      placeholder="مثلاً کیلوگرام"
                      required
                      autoFocus
                    />
                  </label>

                  <label className="unit-form-field">
                    <span>نماد واحد</span>

                    <input
                      name="symbol"
                      value={unitForm.symbol}
                      onChange={handleUnitFormChange}
                      placeholder="مثلاً kg"
                      required
                      dir="auto"
                    />
                  </label>

                  <label className="unit-form-field">
                    <span>نوع کمیت</span>

                    <select
                      name="dimension"
                      value={unitForm.dimension}
                      onChange={handleUnitFormChange}
                      disabled={
                        Boolean(editingUnitId) &&
                        isUnitReferenced(editingUnitId)
                      }
                    >
                      {dimensions.map((dimension) => (
                        <option
                          key={dimension.value}
                          value={dimension.value}
                        >
                          {dimension.label}
                        </option>
                      ))}
                    </select>

                    {editingUnitId &&
                      isUnitReferenced(editingUnitId) && (
                        <small>
                          نوع کمیت این واحد به دلیل استفاده قبلی قابل تغییر نیست.
                        </small>
                      )}
                  </label>

                  <label className="unit-form-field">
                    <span>تعداد ارقام اعشاری مجاز</span>

                    <input
                      type="number"
                      name="decimalPlaces"
                      min="0"
                      max="6"
                      step="1"
                      value={unitForm.decimalPlaces}
                      onChange={handleUnitFormChange}
                      required
                    />
                  </label>

                </div>

                {unitError && (
                  <div className="unit-form-error" role="alert">
                    {unitError}
                  </div>
                )}

                <footer className="unit-modal-actions">
                  <button
                    type="button"
                    className="unit-cancel-button"
                    onClick={closeUnitForm}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="unit-submit-button"
                  >
                    {editingUnitId ? 'ذخیره تغییرات' : 'ثبت واحد'}
                  </button>
                </footer>

              </form>
            )}

            {/* فرم ثبت گروهی */}
            {unitFormMode === 'bulk' && (
              <form
                className="unit-bulk-form"
                onSubmit={handleBulkUnitSubmit}
              >

                <div className="unit-bulk-info">
                  نام و نماد الزامی هستند. ردیف‌های کاملاً خالی نادیده گرفته می‌شوند.
                </div>

                <div className="unit-bulk-table-wrapper">
                  <table className="unit-bulk-table">

                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>نام واحد</th>
                        <th>نماد</th>
                        <th>نوع کمیت</th>
                        <th>دقت اعشاری</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>

                    <tbody>
                      {unitRows.map((row, index) => (
                        <tr
                          key={row.id}
                          className={
                            unitRowErrors[row.id] ? 'invalid' : ''
                          }
                        >

                          <td>{formatNumber(index + 1)}</td>

                          <td>
                            <input
                              value={row.name}
                              onChange={(event) =>
                                updateUnitRow(row.id, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="نام واحد..."
                            />

                            {unitRowErrors[row.id] && (
                              <ul className="unit-row-errors">
                                {unitRowErrors[row.id].map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td>
                            <input
                              value={row.symbol}
                              onChange={(event) =>
                                updateUnitRow(row.id, {
                                  symbol: event.target.value,
                                })
                              }
                              placeholder="نماد..."
                              dir="auto"
                            />
                          </td>

                          <td>
                            <select
                              value={row.dimension}
                              onChange={(event) =>
                                updateUnitRow(row.id, {
                                  dimension: event.target.value,
                                })
                              }
                            >
                              {dimensions.map((dimension) => (
                                <option
                                  key={dimension.value}
                                  value={dimension.value}
                                >
                                  {dimension.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              max="6"
                              step="1"
                              value={row.decimalPlaces}
                              onChange={(event) =>
                                updateUnitRow(row.id, {
                                  decimalPlaces: event.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="unit-row-remove"
                              onClick={() => removeUnitRow(row.id)}
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

                <div className="unit-bulk-add-row">
                  <div>
                    <button
                      type="button"
                      onClick={() => addUnitRows(1)}
                    >
                      + یک ردیف
                    </button>

                    <button
                      type="button"
                      onClick={() => addUnitRows(5)}
                    >
                      + پنج ردیف
                    </button>
                  </div>

                  <span>{formatNumber(unitRows.length)} ردیف</span>
                </div>

                {unitError && (
                  <div className="unit-form-error" role="alert">
                    {unitError}
                  </div>
                )}

                <footer className="unit-modal-actions">
                  <button
                    type="button"
                    className="unit-cancel-button"
                    onClick={closeUnitForm}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="unit-submit-button"
                  >
                    ثبت همه واحدها
                  </button>
                </footer>

              </form>
            )}

          </section>
        </div>
      )}

      {/* فرم تعریف یا ویرایش تبدیل */}
      {isConversionModalOpen && (
        <div
          className="unit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConversionForm();
            }
          }}
        >
          <section
            className="unit-modal unit-conversion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="conversion-modal-title"
          >

            <header className="unit-modal-header">
              <div>
                <h2 id="conversion-modal-title">
                  {editingConversionId ? 'ویرایش تبدیل' : 'تعریف تبدیل جدید'}
                </h2>

                <p>واحد مبدأ، مقصد و ضریب تبدیل را مشخص کن.</p>
              </div>

              <button
                type="button"
                className="unit-modal-close"
                onClick={closeConversionForm}
                aria-label="بستن"
              >
                ×
              </button>
            </header>

            <form
              className="unit-single-form"
              onSubmit={handleConversionSubmit}
            >

              <div className="unit-form-grid">

                <label className="unit-form-field">
                  <span>واحد مبدأ</span>

                  <select
                    value={conversionForm.fromUnitId}
                    onChange={(event) =>
                      handleFromUnitChange(event.target.value)
                    }
                  >
                    {activeUnits
                      .filter((unit) => unit.dimension !== 'package')
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.symbol})
                        </option>
                      ))}
                  </select>
                </label>

                <label className="unit-form-field">
                  <span>واحد مقصد</span>

                  <select
                    value={conversionForm.toUnitId}
                    onChange={(event) =>
                      setConversionForm((previous) => ({
                        ...previous,
                        toUnitId: event.target.value,
                      }))
                    }
                    disabled={conversionTargets.length === 0}
                  >
                    <option value="">انتخاب واحد مقصد</option>

                    {conversionTargets.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.symbol})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="unit-form-field">
                  <span>ضریب تبدیل</span>

                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={conversionForm.factor}
                    onChange={(event) =>
                      setConversionForm((previous) => ({
                        ...previous,
                        factor: event.target.value,
                      }))
                    }
                    placeholder="مثلاً ۱۰۰۰"
                    required
                  />
                </label>

              </div>

              {conversionForm.fromUnitId && conversionForm.toUnitId && (
                <div className="unit-conversion-preview">
                  یک {getUnitName(conversionForm.fromUnitId)}
                  {' '}
                  برابر است با
                  {' '}
                  <strong>{conversionForm.factor || '؟'}</strong>
                  {' '}
                  {getUnitName(conversionForm.toUnitId)}.
                </div>
              )}

              {conversionError && (
                <div className="unit-form-error" role="alert">
                  {conversionError}
                </div>
              )}

              <footer className="unit-modal-actions">
                <button
                  type="button"
                  className="unit-cancel-button"
                  onClick={closeConversionForm}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="unit-submit-button"
                >
                  {editingConversionId ? 'ذخیره تغییرات' : 'ثبت تبدیل'}
                </button>
              </footer>

            </form>
          </section>
        </div>
      )}

      {/* تأیید حذف، تغییر وضعیت یا حذف تبدیل */}
      {confirmAction && (
        <div
          className="unit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmAction(null);
            }
          }}
        >
          <section
            className="unit-confirm-modal"
            role="alertdialog"
            aria-modal="true"
          >

            <h2>
              {confirmAction.type === 'unit-delete'
                ? 'حذف واحد'
                : confirmAction.type === 'conversion-delete'
                  ? 'حذف تبدیل'
                  : confirmAction.unit.isActive
                    ? 'غیرفعال‌کردن واحد'
                    : 'فعال‌کردن واحد'}
            </h2>

            <p>
              {confirmAction.type === 'unit-delete'
                ? `آیا واحد «${confirmAction.unit.name}» حذف شود؟`
                : confirmAction.type === 'conversion-delete'
                  ? 'آیا از حذف این تبدیل اطمینان داری؟'
                  : `آیا می‌خواهی واحد «${confirmAction.unit.name}» را ${confirmAction.unit.isActive ? 'غیرفعال' : 'فعال'
                  } کنی؟`}
            </p>

            {confirmAction.type === 'unit-status' &&
              confirmAction.unit.isActive && (
                <div className="unit-confirm-hint">
                  واحد غیرفعال برای ثبت کالاهای جدید قابل انتخاب نخواهد بود؛
                  اما اطلاعات کالاهای قبلی حفظ می‌شود.
                </div>
              )}

            <div className="unit-confirm-actions">
              <button
                type="button"
                className="unit-cancel-button"
                onClick={() => setConfirmAction(null)}
              >
                انصراف
              </button>

              <button
                type="button"
                className={
                  confirmAction.type === 'unit-delete' ||
                    confirmAction.type === 'conversion-delete'
                    ? 'unit-delete-confirm'
                    : 'unit-submit-button'
                }
                onClick={handleConfirmAction}
              >
                تأیید
              </button>
            </div>

          </section>
        </div>
      )}

    </div>
  );
}

export default UnitList;
