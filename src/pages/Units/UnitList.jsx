import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../../utils/numberFormat';
import { normalizePersianText as normalizeName } from '../../utils/persianText';
import { createRows } from '../../utils/listHelpers';

import './unit-list.css';

// ابعاد واحدهای استاندارد و واحد مرجع هر بُعد
const DIMENSIONS = [
  {
    value: 'count',
    label: 'شمارشی',
    referenceName: 'عدد',
  },
  {
    value: 'mass',
    label: 'وزن',
    referenceName: 'گرام',
  },
  {
    value: 'volume',
    label: 'حجم',
    referenceName: 'میلی‌لیتر',
  },
  {
    value: 'length',
    label: 'طول',
    referenceName: 'میلی‌متر',
  },
];

// ساخت فرم خالی ثبت واحد
function createEmptyUnitForm() {
  return {
    name: '',
    symbol: '',
    unitKind: 'standard',
    dimensionCode: 'count',
    referenceFactorNum: '1',
    referenceFactorDen: '1',
  };
}

// ساخت ردیف خالی برای ثبت گروهی
function createEmptyBulkRow() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...createEmptyUnitForm(),
  };
}

// ساخت چند ردیف خالی
function createEmptyBulkRows(count = 5) {

  return createRows(
    count,
    createEmptyBulkRow
  );

}
// دریافت عنوان بُعد
function getDimensionLabel(dimensionCode) {
  return (
    DIMENSIONS.find((item) => item.value === dimensionCode)?.label ||
    'نامشخص'
  );
}

// دریافت نام واحد مرجع
function getReferenceUnitName(dimensionCode) {
  return (
    DIMENSIONS.find((item) => item.value === dimensionCode)?.referenceName ||
    'واحد مرجع'
  );
}

// ساخت اطلاعات ارسالی به سرویس واحدها
function buildUnitPayload(values) {
  const isStandard = values.unitKind === 'standard';

  return {
    name: values.name.trim(),
    symbol: values.symbol.trim(),

    unitKind: values.unitKind,

    dimensionCode: isStandard
      ? values.dimensionCode
      : null,

    referenceFactorNum: isStandard
      ? Number(values.referenceFactorNum)
      : null,

    referenceFactorDen: isStandard
      ? Number(values.referenceFactorDen)
      : null,

    // دقت اعشاری تمام واحدهای جدید همیشه دو است
    defaultDecimalPlaces: 2,
  };
}

// اعتبارسنجی اطلاعات یک واحد در رابط کاربری
function validateUnitPayload(payload, units, excludedId = null) {
  const errors = [];

  if (!payload.name) {
    errors.push('نام واحد را وارد کن.');
  } else if (payload.name.length > 100) {
    errors.push('نام واحد حداکثر باید ۱۰۰ نویسه باشد.');
  }

  if (!payload.symbol) {
    errors.push('نماد واحد را وارد کن.');
  } else if (payload.symbol.length > 30) {
    errors.push('نماد واحد حداکثر باید ۳۰ نویسه باشد.');
  }

  if (!['standard', 'package'].includes(payload.unitKind)) {
    errors.push('نوع واحد معتبر نیست.');
  }

  if (payload.unitKind === 'standard') {
    const validDimension = DIMENSIONS.some(
      (item) => item.value === payload.dimensionCode
    );

    if (!validDimension) {
      errors.push('بُعد واحد استاندارد را انتخاب کن.');
    }

    if (
      !Number.isSafeInteger(payload.referenceFactorNum) ||
      payload.referenceFactorNum <= 0
    ) {
      errors.push('صورت نسبت مرجع باید عدد صحیح مثبت باشد.');
    }

    if (
      !Number.isSafeInteger(payload.referenceFactorDen) ||
      payload.referenceFactorDen <= 0
    ) {
      errors.push('مخرج نسبت مرجع باید عدد صحیح مثبت باشد.');
    }
  }

  // بررسی تکراری نبودن نام یا نماد در واحدهای موجود
  const duplicate = units.some((unit) => {
    if (unit.id === excludedId) return false;

    return (
      normalizeName(unit.name) === normalizeName(payload.name) ||
      normalizeName(unit.symbol) === normalizeName(payload.symbol)
    );
  });

  if (duplicate) {
    errors.push('نام یا نماد این واحد قبلاً ثبت شده است.');
  }

  return errors;
}

// نمایش نسبت دقیق واحد استاندارد به واحد مرجع
function getReferenceRatioText(unit) {
  if (unit.unitKind !== 'standard') {
    return 'وابسته به کالا';
  }

  const numerator = formatNumber(unit.referenceFactorNum);
  const denominator = Number(unit.referenceFactorDen);

  const ratio = denominator === 1
    ? numerator
    : `${numerator} / ${formatNumber(denominator)}`;

  return `۱ ${unit.name} = ${ratio} ${getReferenceUnitName(unit.dimensionCode)}`;
}

function UnitList({ currentUser }) {
  const [units, setUnits] = useState([]);

  // دسترسی‌های کاربر فعلی
  const canViewUnits =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('units.view') === true;

  const canManageUnits =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('units.manage') === true;

  // وضعیت دریافت اطلاعات از SQLite
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // وضعیت عملیات ثبت، ویرایش و حذف
  const [isSaving, setIsSaving] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // وضعیت جست‌وجو و فیلترها
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // وضعیت پنجره ثبت و ویرایش
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('single');
  const [editingUnit, setEditingUnit] = useState(null);

  // اطلاعات فرم تکی
  const [unitForm, setUnitForm] = useState(
    createEmptyUnitForm
  );

  // اطلاعات فرم گروهی
  const [bulkRows, setBulkRows] = useState(
    () => createEmptyBulkRows(5)
  );

  // خطاهای فرم‌ها
  const [formError, setFormError] = useState('');
  const [bulkErrors, setBulkErrors] = useState({});

  // واحد انتخاب‌شده برای تأیید عملیات
  const [confirmAction, setConfirmAction] = useState(null);

  // دریافت واحدها از پایگاه داده
  useEffect(() => {
    let isActive = true;

    async function loadUnits() {
      if (!canViewUnits) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        // دریافت API تعریف‌شده در Preload
        const listUnits = window.hesabyar?.units?.list;

        if (typeof listUnits !== 'function') {
          throw new Error(
            'سرویس دریافت واحدها در دسترس نیست.'
          );
        }

        // دریافت فهرست واقعی واحدها از Main Process
        const result = await listUnits();

        if (!Array.isArray(result)) {
          throw new Error(
            'اطلاعات دریافتی واحدها معتبر نیست.'
          );
        }

        if (isActive) {
          // همگام‌سازی Context مشترک با اطلاعات SQLite
          setUnits(result);
        }
      } catch (error) {
        if (isActive) {
          // در صورت خطا، اطلاعات آزمایشی نمایش داده نشوند
          setUnits([]);

          setLoadError(
            error.message ||
            'دریافت فهرست واحدها ناموفق بود.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadUnits();

    return () => {
      isActive = false;
    };
  }, [loadAttempt, canViewUnits, setUnits]);

  // آمار واحدها بر اساس داده واقعی پایگاه داده
  const statistics = useMemo(() => ({
    total: units.length,

    standard: units.filter(
      (unit) => unit.unitKind === 'standard'
    ).length,

    package: units.filter(
      (unit) => unit.unitKind === 'package'
    ).length,

    used: units.filter(
      (unit) => Number(unit.productCount || 0) > 0
    ).length,
  }), [units]);

  // فهرست فیلترشده واحدها
  const filteredUnits = useMemo(() => {
    const searchValue = normalizeName(search);

    return units.filter((unit) => {
      const matchesSearch =
        !searchValue ||
        normalizeName(unit.name).includes(searchValue) ||
        normalizeName(unit.symbol).includes(searchValue) ||
        normalizeName(unit.code).includes(searchValue);

      const matchesKind =
        kindFilter === 'all' ||
        unit.unitKind === kindFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && unit.isActive) ||
        (statusFilter === 'inactive' && !unit.isActive);

      return matchesSearch && matchesKind && matchesStatus;
    });
  }, [units, search, kindFilter, statusFilter]);

  // بررسی قفل بودن ویژگی‌های ساختاری واحد
  const isStructureLocked = Boolean(
    editingUnit &&
    (
      editingUnit.isSystem ||
      Number(editingUnit.productCount || 0) > 0
    )
  );

  // بازکردن فرم ثبت تکی
  function openSingleForm() {
    setFormMode('single');
    setEditingUnit(null);
    setUnitForm(createEmptyUnitForm());
    setFormError('');
    setBulkErrors({});
    setIsFormOpen(true);
  }

  // بازکردن فرم ثبت گروهی
  function openBulkForm() {
    setFormMode('bulk');
    setEditingUnit(null);
    setBulkRows(createEmptyBulkRows(5));
    setBulkErrors({});
    setFormError('');
    setIsFormOpen(true);
  }

  // بازکردن فرم ویرایش واحد
  function openEditForm(unit) {
    setFormMode('single');
    setEditingUnit(unit);

    setUnitForm({
      name: unit.name,
      symbol: unit.symbol,
      unitKind: unit.unitKind,
      dimensionCode: unit.dimensionCode || 'count',

      referenceFactorNum:
        unit.referenceFactorNum === null
          ? ''
          : String(unit.referenceFactorNum),

      referenceFactorDen:
        unit.referenceFactorDen === null
          ? ''
          : String(unit.referenceFactorDen),
    });

    setFormError('');
    setBulkErrors({});
    setIsFormOpen(true);
  }

  // بستن فرم
  function closeForm() {
    setIsFormOpen(false);
    setEditingUnit(null);
    setFormError('');
    setBulkErrors({});
  }

  // تغییر اطلاعات فرم تکی
  function handleUnitFormChange(event) {
    const { name, value } = event.target;

    if (name === 'unitKind') {
      setUnitForm((previous) => (
        value === 'package'
          ? {
            ...previous,
            unitKind: 'package',
            dimensionCode: '',
            referenceFactorNum: '',
            referenceFactorDen: '',
          }
          : {
            ...previous,
            unitKind: 'standard',
            dimensionCode: previous.dimensionCode || 'count',
            referenceFactorNum: previous.referenceFactorNum || '1',
            referenceFactorDen: previous.referenceFactorDen || '1',
          }
      ));
    } else {
      setUnitForm((previous) => ({
        ...previous,
        [name]: value,
      }));
    }

    setFormError('');
  }

  // ثبت یا ویرایش یک واحد
  async function handleSingleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    const payload = buildUnitPayload(unitForm);

    const errors = validateUnitPayload(
      payload,
      units,
      editingUnit?.id || null
    );

    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }

    setIsSaving(true);
    setFormError('');
    setOperationError('');

    try {
      const unitApi = window.hesabyar?.units;

      if (!unitApi) {
        throw new Error(
          'ارتباط با سرویس مدیریت واحدها برقرار نیست.'
        );
      }

      if (editingUnit) {
        // ارسال اطلاعات ویرایش‌شده به Main Process
        const updatedUnit = await unitApi.update(
          editingUnit.id,
          payload
        );

        // جایگزینی رکورد قبلی با پاسخ پایگاه داده
        setUnits((previous) =>
          previous.map((unit) =>
            unit.id === editingUnit.id
              ? updatedUnit
              : unit
          )
        );

        setSuccessMessage(
          `واحد «${updatedUnit.name}» با موفقیت ویرایش شد.`
        );
      } else {
        // ثبت واحد جدید در SQLite
        const newUnit = await unitApi.create(payload);

        setUnits((previous) => [
          ...previous,
          newUnit,
        ]);

        setSuccessMessage(
          `واحد «${newUnit.name}» با موفقیت ثبت شد.`
        );
      }

      closeForm();
    } catch (error) {
      setFormError(
        error.message ||
        'ثبت اطلاعات واحد ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  // تغییر نوع واحد در ردیف ثبت گروهی
  function handleBulkKindChange(row, value) {
    updateBulkRow(row.rowId,
      value === 'package'
        ? {
          unitKind: 'package',
          dimensionCode: '',
          referenceFactorNum: '',
          referenceFactorDen: '',
        }
        : {
          unitKind: 'standard',
          dimensionCode: row.dimensionCode || 'count',
          referenceFactorNum: row.referenceFactorNum || '1',
          referenceFactorDen: row.referenceFactorDen || '1',
        }
    );
  }

  // تغییر اطلاعات یک ردیف ثبت گروهی
  function updateBulkRow(rowId, changes) {
    setBulkRows((previous) =>
      previous.map((row) =>
        row.rowId === rowId
          ? { ...row, ...changes }
          : row
      )
    );

    setBulkErrors({});
    setFormError('');
  }

  // افزودن ردیف به فرم گروهی
  function addBulkRows(count = 1) {
    setBulkRows((previous) => {
      const remaining = 200 - previous.length;
      const numberToAdd = Math.min(count, remaining);

      if (numberToAdd <= 0) return previous;

      return [
        ...previous,
        ...createEmptyBulkRows(numberToAdd),
      ];
    });
  }

  // حذف ردیف از فرم گروهی
  function removeBulkRow(rowId) {
    setBulkRows((previous) => {
      if (previous.length === 1) {
        return createEmptyBulkRows(1);
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

  // ثبت گروهی واحدها
  async function handleBulkSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    const filledRows = bulkRows.filter(
      (row) =>
        row.name.trim() ||
        row.symbol.trim()
    );

    if (filledRows.length === 0) {
      setFormError('حداقل اطلاعات یک واحد را وارد کن.');
      return;
    }

    if (filledRows.length > 200) {
      setFormError('در هر مرحله حداکثر ۲۰۰ واحد قابل ثبت است.');
      return;
    }

    const errors = {};
    const seenNames = new Map();
    const seenSymbols = new Map();

    filledRows.forEach((row) => {
      const payload = buildUnitPayload(row);

      const rowErrors = validateUnitPayload(
        payload,
        units
      );

      // بررسی نام‌های تکراری در همین فرم
      const normalizedName = normalizeName(payload.name);

      if (normalizedName) {
        if (seenNames.has(normalizedName)) {
          rowErrors.push('نام این واحد در ردیف دیگری نیز تکرار شده است.');

          const previousId = seenNames.get(normalizedName);

          errors[previousId] = [
            ...(errors[previousId] || []),
            'نام این واحد در ردیف دیگری نیز تکرار شده است.',
          ];
        } else {
          seenNames.set(normalizedName, row.rowId);
        }
      }

      // بررسی نمادهای تکراری در همین فرم
      const normalizedSymbol = normalizeName(payload.symbol);

      if (normalizedSymbol) {
        if (seenSymbols.has(normalizedSymbol)) {
          rowErrors.push('نماد این واحد در ردیف دیگری نیز تکرار شده است.');

          const previousId = seenSymbols.get(normalizedSymbol);

          errors[previousId] = [
            ...(errors[previousId] || []),
            'نماد این واحد در ردیف دیگری نیز تکرار شده است.',
          ];
        } else {
          seenSymbols.set(normalizedSymbol, row.rowId);
        }
      }

      if (rowErrors.length > 0) {
        errors[row.rowId] = [
          ...(errors[row.rowId] || []),
          ...rowErrors,
        ];
      }
    });

    if (Object.keys(errors).length > 0) {
      setBulkErrors(errors);
      setFormError(
        'برخی ردیف‌ها دارای خطا هستند. موارد مشخص‌شده را اصلاح کن.'
      );
      return;
    }

    setIsSaving(true);
    setBulkErrors({});
    setFormError('');
    setOperationError('');

    try {
      const createBulk =
        window.hesabyar?.units?.createBulk;

      if (typeof createBulk !== 'function') {
        throw new Error(
          'سرویس ثبت گروهی واحدها در دسترس نیست.'
        );
      }

      const inputs = filledRows.map(buildUnitPayload);

      // ثبت اتمیک تمام واحدها در SQLite
      const createdUnits = await createBulk(inputs);

      if (
        !Array.isArray(createdUnits) ||
        createdUnits.length !== inputs.length
      ) {
        throw new Error(
          'پاسخ سرویس ثبت گروهی معتبر نیست.'
        );
      }

      setUnits((previous) => [
        ...previous,
        ...createdUnits,
      ]);

      setSuccessMessage(
        `${formatNumber(createdUnits.length)} واحد با موفقیت ثبت شد.`
      );

      closeForm();
    } catch (error) {
      setFormError(
        error.message ||
        'ثبت گروهی واحدها ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  // درخواست تغییر وضعیت واحد
  function requestStatusChange(unit) {
    if (unit.isActive && Number(unit.productCount || 0) > 0) {
      return;
    }

    setConfirmAction({
      type: 'status',
      unit,
    });
  }

  // درخواست حذف واحد
  function requestDelete(unit) {
    if (
      unit.isSystem ||
      Number(unit.productCount || 0) > 0
    ) {
      return;
    }

    setConfirmAction({
      type: 'delete',
      unit,
    });
  }

  // اجرای عملیات تأییدشده
  async function handleConfirmAction() {
    if (!confirmAction || isSaving) return;

    setIsSaving(true);
    setOperationError('');

    try {
      const unitApi = window.hesabyar?.units;

      if (!unitApi) {
        throw new Error(
          'ارتباط با سرویس مدیریت واحدها برقرار نیست.'
        );
      }

      const { unit } = confirmAction;

      if (confirmAction.type === 'status') {
        const nextStatus = !unit.isActive;

        // تغییر وضعیت در پایگاه داده
        const updatedUnit = await unitApi.setActive(
          unit.id,
          nextStatus
        );

        setUnits((previous) =>
          previous.map((item) =>
            item.id === unit.id
              ? updatedUnit
              : item
          )
        );

        setSuccessMessage(
          nextStatus
            ? `واحد «${unit.name}» فعال شد.`
            : `واحد «${unit.name}» غیرفعال شد.`
        );
      }

      if (confirmAction.type === 'delete') {
        // حذف واحد سفارشی از پایگاه داده
        await unitApi.delete(unit.id);

        setUnits((previous) =>
          previous.filter(
            (item) => item.id !== unit.id
          )
        );

        setSuccessMessage(
          `واحد «${unit.name}» حذف شد.`
        );
      }

      setConfirmAction(null);
    } catch (error) {
      setOperationError(
        error.message ||
        'اجرای عملیات ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  // بررسی مجوز مشاهده صفحه
  if (!canViewUnits) {
    return (
      <div className="unit-page">
        <div className="unit-state-message">
          <strong>دسترسی غیرمجاز</strong>
          <p>برای مشاهده واحدهای اندازه‌گیری مجوز لازم را نداری.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unit-page">

      {/* پیام موفقیت عملیات */}
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

      {/* خطای عمومی عملیات */}
      {operationError && (
        <div className="unit-operation-error" role="alert">
          <span>{operationError}</span>

          <button
            type="button"
            onClick={() => setOperationError('')}
            aria-label="بستن پیام خطا"
          >
            ×
          </button>
        </div>
      )}

      {/* وضعیت بارگذاری اطلاعات */}
      {isLoading && (
        <div className="unit-state-message">
          در حال دریافت واحدهای اندازه‌گیری...
        </div>
      )}

      {/* خطای دریافت اطلاعات */}
      {!isLoading && loadError && (
        <div className="unit-state-message unit-state-error">
          <strong>دریافت اطلاعات ناموفق بود.</strong>
          <p>{loadError}</p>

          <button
            type="button"
            className="unit-retry-button"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {!isLoading && !loadError && (
        <>
          {/* پیام محدودیت دسترسی مدیریتی */}
          {!canManageUnits && (
            <div className="unit-permission-note">
              دسترسی شما فقط برای مشاهده واحدهاست؛
              امکان ثبت، ویرایش و حذف در اختیارت نیست.
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
              <span className="unit-stat-icon active">◈</span>
              <div>
                <p>واحدهای استاندارد</p>
                <strong>{formatNumber(statistics.standard)}</strong>
              </div>
            </article>

            <article className="unit-stat-card">
              <span className="unit-stat-icon conversion">▣</span>
              <div>
                <p>واحدهای بسته‌بندی</p>
                <strong>{formatNumber(statistics.package)}</strong>
              </div>
            </article>

            <article className="unit-stat-card">
              <span className="unit-stat-icon used">▦</span>
              <div>
                <p>واحدهای استفاده‌شده</p>
                <strong>{formatNumber(statistics.used)}</strong>
              </div>
            </article>

          </section>

          {/* نوار جست‌وجو، فیلتر و عملیات */}
          <section className="unit-toolbar">

            <div className="unit-search">
              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجوی نام، نماد یا کد واحد..."
              />
            </div>

            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
              aria-label="فیلتر نوع واحد"
            >
              <option value="all">همه انواع</option>
              <option value="standard">استاندارد</option>
              <option value="package">بسته‌بندی</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="فیلتر وضعیت واحد"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>

            {canManageUnits && (
              <div className="unit-add-actions">
                <button
                  type="button"
                  className="unit-add-single"
                  onClick={openSingleForm}
                >
                  + افزودن تکی
                </button>

                <button
                  type="button"
                  className="unit-add-bulk"
                  onClick={openBulkForm}
                >
                  + افزودن گروهی
                </button>
              </div>
            )}

          </section>

          {/* جدول واحدها */}
          <section className="management-table-card">

            <header className="unit-table-header management-table-card__header">
              <div>
                <h2>فهرست واحدهای اندازه‌گیری</h2>
                <p>
                  {formatNumber(filteredUnits.length)} واحد نمایش داده می‌شود
                </p>
              </div>
            </header>

            <div className="ui-data-table-wrapper">              <table className="unit-table">

              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>نام واحد</th>
                  <th>نماد</th>
                  <th>نوع واحد</th>
                  <th>بُعد</th>
                  <th>نسبت به واحد مرجع</th>
                  <th>کالاهای وابسته</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {filteredUnits.map((unit, index) => {
                  const productCount = Number(
                    unit.productCount || 0
                  );

                  const cannotDelete =
                    unit.isSystem || productCount > 0;

                  const cannotDeactivate =
                    unit.isActive && productCount > 0;

                  return (
                    <tr key={unit.id}>

                      <td>{formatNumber(index + 1)}</td>

                      <td className="unit-name">
                        <div className="unit-name-cell">
                          <span>{unit.name}</span>

                          {unit.isSystem && (
                            <small className="unit-system-badge">
                              پیش‌فرض
                            </small>
                          )}
                        </div>
                      </td>

                      <td className="unit-symbol">
                        {unit.symbol || '—'}
                      </td>

                      <td>
                        <span
                          className={`unit-kind-badge ${unit.unitKind}`}
                        >
                          {unit.unitKind === 'standard'
                            ? 'استاندارد'
                            : 'بسته‌بندی'}
                        </span>
                      </td>

                      <td>
                        {unit.unitKind === 'standard'
                          ? getDimensionLabel(unit.dimensionCode)
                          : 'وابسته به کالا'}
                      </td>

                      <td className="unit-reference-cell">
                        {getReferenceRatioText(unit)}
                      </td>

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
                        {canManageUnits ? (
                          <div className="unit-actions">

                            <button
                              type="button"
                              className="unit-edit-action"
                              onClick={() => openEditForm(unit)}
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
                              disabled={cannotDeactivate}
                              title={
                                cannotDeactivate
                                  ? 'این واحد در کالاها استفاده شده و قابل غیرفعال‌سازی نیست.'
                                  : unit.isActive
                                    ? 'غیرفعال‌سازی'
                                    : 'فعال‌سازی'
                              }
                              onClick={() => requestStatusChange(unit)}
                            >
                              {unit.isActive
                                ? 'غیرفعال'
                                : 'فعال'}
                            </button>

                            <button
                              type="button"
                              className="unit-delete-action"
                              disabled={cannotDelete}
                              title={
                                unit.isSystem
                                  ? 'واحدهای پیش‌فرض قابل حذف نیستند.'
                                  : productCount > 0
                                    ? 'این واحد در کالاها استفاده شده است.'
                                    : 'حذف واحد'
                              }
                              onClick={() => requestDelete(unit)}
                            >
                              حذف
                            </button>

                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                    </tr>
                  );
                })}

                {filteredUnits.length === 0 && (
                  <tr>
                    <td colSpan="9">
                      <div className="ui-empty-state ui-empty-state--table ui-empty-state--table-compact">
                        <strong>واحدی پیدا نشد</strong>
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

      {/* پنجره ثبت یا ویرایش واحد */}
      {isFormOpen && (
        <div
          className="unit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeForm();
            }
          }}
        >
          <section
            className={`unit-modal ${formMode === 'bulk' ? 'unit-bulk-modal' : ''
              }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-modal-title"
          >

            <header className="unit-modal-header">
              <div>
                <h2 id="unit-modal-title">
                  {formMode === 'bulk'
                    ? 'ثبت گروهی واحدها'
                    : editingUnit
                      ? 'ویرایش واحد اندازه‌گیری'
                      : 'افزودن واحد جدید'}
                </h2>

                <p>
                  {formMode === 'bulk'
                    ? 'اطلاعات واحدهای موردنظر را وارد کن و همه را یک‌جا ثبت کن.'
                    : 'مشخصات واحد را مطابق نوع و بُعد آن وارد کن.'}
                </p>
              </div>

              <button
                type="button"
                className="unit-modal-close"
                onClick={closeForm}
                disabled={isSaving}
                aria-label="بستن"
              >
                ×
              </button>
            </header>

            {/* فرم ثبت تکی یا ویرایش */}
            {formMode === 'single' && (
              <form
                className="unit-single-form"
                onSubmit={handleSingleSubmit}
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
                      dir="auto"
                      required
                    />
                  </label>

                  <label className="unit-form-field">
                    <span>نوع واحد</span>

                    <select
                      name="unitKind"
                      value={unitForm.unitKind}
                      onChange={handleUnitFormChange}
                      disabled={isStructureLocked}
                    >
                      <option value="standard">واحد استاندارد</option>
                      <option value="package">واحد بسته‌بندی</option>
                    </select>
                  </label>

                  {unitForm.unitKind === 'standard' && (
                    <label className="unit-form-field">
                      <span>بُعد واحد</span>

                      <select
                        name="dimensionCode"
                        value={unitForm.dimensionCode}
                        onChange={handleUnitFormChange}
                        disabled={isStructureLocked}
                      >
                        {DIMENSIONS.map((dimension) => (
                          <option
                            key={dimension.value}
                            value={dimension.value}
                          >
                            {dimension.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {unitForm.unitKind === 'standard' && (
                    <div className="unit-form-field unit-form-field-full">
                      <span>نسبت به واحد مرجع</span>

                      <div className="unit-ratio-inputs">
                        <label>
                          <small>صورت</small>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={unitForm.referenceFactorNum}
                            onChange={(event) =>
                              handleUnitFormChange({
                                target: {
                                  name: 'referenceFactorNum',
                                  value: event.target.value,
                                },
                              })
                            }
                            disabled={isStructureLocked}
                            required
                          />
                        </label>

                        <span className="unit-ratio-divider">/</span>

                        <label>
                          <small>مخرج</small>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={unitForm.referenceFactorDen}
                            onChange={(event) =>
                              handleUnitFormChange({
                                target: {
                                  name: 'referenceFactorDen',
                                  value: event.target.value,
                                },
                              })
                            }
                            disabled={isStructureLocked}
                            required
                          />
                        </label>
                      </div>

                      <small className="unit-field-description">
                        هر یک از این واحدها برابر با این نسبت از
                        {' '}
                        {getReferenceUnitName(unitForm.dimensionCode)}
                        {' '}
                        است.
                      </small>
                    </div>
                  )}

                  {unitForm.unitKind === 'package' && (
                    <div className="unit-package-note">
                      واحدهای بسته‌بندی نسبت تبدیل عمومی ندارند.
                      ضریب تبدیل آن‌ها هنگام تعریف واحدهای هر کالا
                      مشخص می‌شود.
                    </div>
                  )}

                </div>

                {isStructureLocked && (
                  <div className="unit-structure-lock-note">
                    {editingUnit?.isSystem
                      ? 'ساختار واحدهای پیش‌فرض قابل تغییر نیست؛ فقط نام و نماد را می‌توان ویرایش کرد.'
                      : 'این واحد در کالاها استفاده شده است؛ نوع، بُعد و نسبت مرجع آن قابل تغییر نیست.'}
                  </div>
                )}

                {formError && (
                  <div className="unit-form-error" role="alert">
                    {formError}
                  </div>
                )}

                <footer className="unit-modal-actions">
                  <button
                    type="button"
                    className="unit-cancel-button"
                    onClick={closeForm}
                    disabled={isSaving}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="unit-submit-button"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'در حال ذخیره...'
                      : editingUnit
                        ? 'ذخیره تغییرات'
                        : 'ثبت واحد'}
                  </button>
                </footer>

              </form>
            )}

            {/* فرم ثبت گروهی */}
            {formMode === 'bulk' && (
              <form
                className="unit-bulk-form"
                onSubmit={handleBulkSubmit}
              >

                <div className="unit-bulk-info">
                  نام و نماد هر واحد الزامی است.
                  ردیف‌های کاملاً خالی نادیده گرفته می‌شوند.
                  برای واحد بسته‌بندی، نسبت مرجع وارد نمی‌شود.
                </div>

                <div className="unit-bulk-table-wrapper">
                  <table className="unit-bulk-table">

                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>نام واحد</th>
                        <th>نماد</th>
                        <th>نوع</th>
                        <th>بُعد</th>
                        <th>صورت</th>
                        <th>مخرج</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr
                          key={row.rowId}
                          className={
                            bulkErrors[row.rowId] ? 'invalid' : ''
                          }
                        >

                          <td>{formatNumber(index + 1)}</td>

                          <td>
                            <input
                              value={row.name}
                              onChange={(event) =>
                                updateBulkRow(row.rowId, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="نام واحد..."
                            />

                            {bulkErrors[row.rowId] && (
                              <ul className="unit-row-errors">
                                {bulkErrors[row.rowId].map((error, errorIndex) => (
                                  <li key={`${row.rowId}-${errorIndex}`}>
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td>
                            <input
                              value={row.symbol}
                              onChange={(event) =>
                                updateBulkRow(row.rowId, {
                                  symbol: event.target.value,
                                })
                              }
                              placeholder="نماد..."
                              dir="auto"
                            />
                          </td>

                          <td>
                            <select
                              value={row.unitKind}
                              onChange={(event) =>
                                handleBulkKindChange(row, event.target.value)
                              }
                            >
                              <option value="standard">استاندارد</option>
                              <option value="package">بسته‌بندی</option>
                            </select>
                          </td>

                          <td>
                            {row.unitKind === 'standard' ? (
                              <select
                                value={row.dimensionCode}
                                onChange={(event) =>
                                  updateBulkRow(row.rowId, {
                                    dimensionCode: event.target.value,
                                  })
                                }
                              >
                                {DIMENSIONS.map((dimension) => (
                                  <option
                                    key={dimension.value}
                                    value={dimension.value}
                                  >
                                    {dimension.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td>
                            {row.unitKind === 'standard' ? (
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={row.referenceFactorNum}
                                onChange={(event) =>
                                  updateBulkRow(row.rowId, {
                                    referenceFactorNum: event.target.value,
                                  })
                                }
                              />
                            ) : (
                              '—'
                            )}
                          </td>

                          <td>
                            {row.unitKind === 'standard' ? (
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={row.referenceFactorDen}
                                onChange={(event) =>
                                  updateBulkRow(row.rowId, {
                                    referenceFactorDen: event.target.value,
                                  })
                                }
                              />
                            ) : (
                              '—'
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="unit-row-remove"
                              onClick={() => removeBulkRow(row.rowId)}
                              aria-label={`حذف ردیف ${index + 1}`}
                              disabled={isSaving}
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
                      onClick={() => addBulkRows(1)}
                      disabled={bulkRows.length >= 200 || isSaving}
                    >
                      + یک ردیف
                    </button>

                    <button
                      type="button"
                      onClick={() => addBulkRows(5)}
                      disabled={bulkRows.length >= 200 || isSaving}
                    >
                      + پنج ردیف
                    </button>
                  </div>

                  <span>
                    {formatNumber(bulkRows.length)} از ۲۰۰ ردیف
                  </span>
                </div>

                {formError && (
                  <div className="unit-form-error" role="alert">
                    {formError}
                  </div>
                )}

                <footer className="unit-modal-actions">
                  <button
                    type="button"
                    className="unit-cancel-button"
                    onClick={closeForm}
                    disabled={isSaving}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="unit-submit-button"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'در حال ثبت...'
                      : 'ثبت همه واحدها'}
                  </button>
                </footer>

              </form>
            )}

          </section>
        </div>
      )}

      {/* پنجره تأیید حذف یا تغییر وضعیت */}
      {confirmAction && (
        <div
          className="unit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
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
              {confirmAction.type === 'delete'
                ? 'حذف واحد'
                : confirmAction.unit.isActive
                  ? 'غیرفعال‌کردن واحد'
                  : 'فعال‌کردن واحد'}
            </h2>

            <p>
              {confirmAction.type === 'delete'
                ? `آیا از حذف واحد «${confirmAction.unit.name}» اطمینان داری؟`
                : `آیا می‌خواهی واحد «${confirmAction.unit.name}» را ${confirmAction.unit.isActive ? 'غیرفعال' : 'فعال'
                } کنی؟`}
            </p>

            {confirmAction.type === 'status' &&
              confirmAction.unit.isActive && (
                <div className="unit-confirm-hint">
                  واحد غیرفعال‌شده برای ثبت کالاهای جدید قابل انتخاب نخواهد بود.
                </div>
              )}

            <div className="unit-confirm-actions">
              <button
                type="button"
                className="unit-cancel-button"
                onClick={() => setConfirmAction(null)}
                disabled={isSaving}
              >
                انصراف
              </button>

              <button
                type="button"
                className={
                  confirmAction.type === 'delete'
                    ? 'unit-delete-confirm'
                    : 'unit-submit-button'
                }
                onClick={handleConfirmAction}
                disabled={isSaving}
              >
                {isSaving ? 'در حال انجام...' : 'تأیید'}
              </button>
            </div>

          </section>
        </div>
      )}

    </div>
  );
}

export default UnitList;