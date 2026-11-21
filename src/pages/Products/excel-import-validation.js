// یکسان‌سازی متن برای تطبیق نام دسته‌بندی و واحد
function normalizeLookupText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


// یکسان‌سازی نام محصول مطابق منطق بک‌اند
function normalizeProductName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


// تبدیل ارقام فارسی و عربی به انگلیسی
function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    );
}


// تبدیل مقدار به عدد صحیح مثبت
function parsePositiveInteger(value) {
  const text = normalizeDigits(value)
    .replace(/[,\u066C]/g, '')
    .trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);

  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }

  return number;
}


// ساخت فهرست تطبیق نام‌ها، کدها و نمادها
function createLookup(items, getAliases) {
  const lookup = new Map();

  for (const item of items) {
    const aliases = getAliases(item);

    for (const alias of aliases) {
      const key = normalizeLookupText(alias);

      if (!key) continue;

      const existing = lookup.get(key);

      if (!existing) {
        lookup.set(key, {
          item,
          ambiguous: false,
        });

        continue;
      }

      // اگر یک نام به دو واحد یا دسته‌بندی متفاوت اشاره کند،
      // تطبیق آن مبهم محسوب می‌شود.
      if (existing.item.id !== item.id) {
        existing.ambiguous = true;
      }
    }
  }

  return lookup;
}


// یافتن دسته‌بندی یا واحد در فهرست معتبر
function resolveLookup(lookup, value, label, errors) {
  const key = normalizeLookupText(value);

  if (!key) {
    return null;
  }

  const result = lookup.get(key);

  if (!result) {
    errors.push(
      `${label} «${value}» در فهرست اطلاعات فعال حساب‌یار پیدا نشد.`
    );

    return null;
  }

  if (result.ambiguous) {
    errors.push(
      `${label} «${value}» به بیش از یک مورد اشاره می‌کند؛ لطفاً نام یا کد دقیق‌تری وارد کن.`
    );

    return null;
  }

  return result.item;
}


// جلوگیری از ثبت پیام خطای تکراری
function addUniqueError(errors, message) {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}


// بررسی و تبدیل ردیف‌های Excel به محصولات قابل ثبت
export function validateExcelProductRows({
  rows,
  categories,
  units,
  products,
}) {
  // ساخت فهرست تطبیق دسته‌بندی‌ها
  const categoryLookup = createLookup(
    categories,
    (category) => [category.name]
  );

  // واحد با نام، کد یا نماد آن قابل شناسایی است
  const unitLookup = createLookup(
    units,
    (unit) => [
      unit.name,
      unit.code,
      unit.symbol,
    ]
  );

  // نام محصولات موجود در دیتابیس
  // محصولات غیرفعال نیز برای جلوگیری از تکرار در نظر گرفته می‌شوند.
  const existingProductNames = new Set(
    products.map((product) =>
      normalizeProductName(
        product.normalizedName || product.name
      )
    )
  );

  // گروه‌بندی ردیف‌ها بر اساس نام یکسان محصول
  const groupsByName = new Map();

  // نگهداری نتیجه اعتبارسنجی هر ردیف
  const validationRows = rows.map((sourceRow) => ({
    ...sourceRow,
    errors: [],
    status: 'valid',
  }));


  // پردازش تک‌تک ردیف‌ها
  for (const row of validationRows) {
    const name = String(row.name ?? '').trim();
    const categoryName = String(row.category ?? '').trim();
    const baseUnitName = String(row.baseUnit ?? '').trim();

    const subUnitName = String(row.subUnit ?? '').trim();

    const numeratorText = String(
      row.numerator ?? ''
    ).trim();

    const denominatorText = String(
      row.denominator ?? ''
    ).trim();


    // بررسی نام محصول
    if (!name) {
      addUniqueError(
        row.errors,
        'نام محصول وارد نشده است.'
      );
    }

    // بررسی دسته‌بندی
    if (!categoryName) {
      addUniqueError(
        row.errors,
        'دسته‌بندی وارد نشده است.'
      );
    }

    // بررسی واحد پایه
    if (!baseUnitName) {
      addUniqueError(
        row.errors,
        'واحد پایه وارد نشده است.'
      );
    }


    // تطبیق دسته‌بندی
    const category = categoryName
      ? resolveLookup(
        categoryLookup,
        categoryName,
        'دسته‌بندی',
        row.errors
      )
      : null;


    // تطبیق واحد پایه
    const baseUnit = baseUnitName
      ? resolveLookup(
        unitLookup,
        baseUnitName,
        'واحد پایه',
        row.errors
      )
      : null;


    // واحد پایه فقط باید استاندارد باشد
    if (
      baseUnit &&
      baseUnit.unitKind !== 'standard'
    ) {
      addUniqueError(
        row.errors,
        'واحد پایه محصول باید از نوع استاندارد باشد.'
      );
    }


    // ایجاد یا دریافت گروه محصول
    const productKey = normalizeProductName(name);

    let group = null;

    if (productKey) {
      group = groupsByName.get(productKey);

      if (!group) {
        group = {
          key: productKey,
          name,
          categoryId: null,
          categoryName: '',
          baseUnitId: null,
          baseUnitName: '',
          unitOptions: [],
          unitIds: new Set(),
          rows: [],
          errors: [],
          hasEmptyUnitRow: false,
        };

        groupsByName.set(productKey, group);

        // جلوگیری از ورود محصولی که قبلاً وجود دارد
        if (existingProductNames.has(productKey)) {
          addUniqueError(
            group.errors,
            `محصول «${name}» از قبل در فهرست محصولات حساب‌یار وجود دارد.`
          );
        }
      }

      group.rows.push(row);
    }


    // نامعتبر بودن نام، اجازه تشکیل محصول را نمی‌دهد
    if (!group) {
      row.status = 'invalid';
      continue;
    }


    // بررسی یکسان بودن دسته‌بندی در ردیف‌های یک محصول
    if (category) {
      if (
        group.categoryId &&
        group.categoryId !== category.id
      ) {
        addUniqueError(
          group.errors,
          'دسته‌بندی این محصول در ردیف‌های مختلف یکسان نیست.'
        );
      } else {
        group.categoryId = category.id;
        group.categoryName = category.name;
      }
    }


    // بررسی یکسان بودن واحد پایه در ردیف‌های محصول
    if (
      baseUnit &&
      baseUnit.unitKind === 'standard'
    ) {
      if (
        group.baseUnitId &&
        group.baseUnitId !== baseUnit.id
      ) {
        addUniqueError(
          group.errors,
          'واحد پایه این محصول در ردیف‌های مختلف یکسان نیست.'
        );
      } else {
        group.baseUnitId = baseUnit.id;
        group.baseUnitName = baseUnit.name;
      }
    }


    // اگر واحد فرعی وارد نشده باشد
    if (!subUnitName) {
      if (numeratorText || denominatorText) {
        addUniqueError(
          row.errors,
          'برای واردکردن ضریب تبدیل، باید واحد فرعی نیز مشخص شود.'
        );
      } else if (group.hasEmptyUnitRow) {
        addUniqueError(
          group.errors,
          'برای این محصول بیش از یک ردیف بدون واحد فرعی ثبت شده است.'
        );
      } else {
        group.hasEmptyUnitRow = true;
      }

      continue;
    }


    // تطبیق واحد فرعی
    const subUnit = resolveLookup(
      unitLookup,
      subUnitName,
      'واحد فرعی',
      row.errors
    );

    if (!subUnit) {
      continue;
    }


    // واحد فرعی نمی‌تواند با واحد پایه یکسان باشد
    if (baseUnit && subUnit.id === baseUnit.id) {
      addUniqueError(
        row.errors,
        'واحد فرعی نمی‌تواند همان واحد پایه باشد.'
      );

      continue;
    }


    // بررسی استاندارد یا بسته‌بندی بودن واحد فرعی
    let preparedOption = null;

    if (subUnit.unitKind === 'standard') {
      // واحد استاندارد باید با واحد پایه هم‌بُعد باشد
      if (
        baseUnit &&
        baseUnit.dimensionCode !== subUnit.dimensionCode
      ) {
        addUniqueError(
          row.errors,
          `واحد استاندارد «${subUnit.name}» با واحد پایه هم‌بُعد نیست.`
        );
      }

      // واحد استاندارد ضریب اختصاصی نمی‌گیرد
      if (numeratorText || denominatorText) {
        addUniqueError(
          row.errors,
          `برای واحد استاندارد «${subUnit.name}» نباید صورت یا مخرج تبدیل وارد شود.`
        );
      }

      preparedOption = {
        unitId: subUnit.id,
        inputDecimalPlaces: 2,
      };

    } else if (subUnit.unitKind === 'package') {
      // واحد بسته‌بندی به نسبت اختصاصی نیاز دارد
      const numerator = parsePositiveInteger(
        numeratorText
      );

      const denominator = parsePositiveInteger(
        denominatorText
      );

      if (!numerator) {
        addUniqueError(
          row.errors,
          `صورت تبدیل واحد بسته‌بندی «${subUnit.name}» باید عدد صحیح مثبت باشد.`
        );
      }

      if (!denominator) {
        addUniqueError(
          row.errors,
          `مخرج تبدیل واحد بسته‌بندی «${subUnit.name}» باید عدد صحیح مثبت باشد.`
        );
      }

      if (numerator && denominator) {
        preparedOption = {
          unitId: subUnit.id,
          inputDecimalPlaces: 2,
          conversionNum: numerator,
          conversionDen: denominator,
        };
      }

    } else {
      addUniqueError(
        row.errors,
        `نوع واحد «${subUnit.name}» پشتیبانی نمی‌شود.`
      );
    }


    // جلوگیری از ثبت تکراری یک واحد فرعی برای یک محصول
    if (preparedOption) {
      if (group.unitIds.has(subUnit.id)) {
        addUniqueError(
          group.errors,
          `واحد «${subUnit.name}» برای این محصول بیش از یک بار ثبت شده است.`
        );
      } else {
        group.unitIds.add(subUnit.id);
        group.unitOptions.push(preparedOption);
      }
    }
  }


  // محدودیت سرویس ثبت گروهی: حداکثر ۲۰۰ محصول
  const groups = [...groupsByName.values()];

  if (groups.length > 200) {
    for (const group of groups) {
      addUniqueError(
        group.errors,
        'در هر نوبت حداکثر ۲۰۰ محصول قابل ورود است.'
      );
    }
  }


  // اعمال خطاهای گروهی روی تمام ردیف‌های مربوط به محصول
  for (const group of groups) {
    for (const row of group.rows) {
      for (const error of group.errors) {
        addUniqueError(row.errors, error);
      }

      row.status =
        row.errors.length === 0
          ? 'valid'
          : 'invalid';
    }

    // آماده‌سازی ساختار مورد انتظار سرویس createProducts
    group.input = {
      name: group.name,
      categoryId: group.categoryId,
      baseUnitId: group.baseUnitId,

      baseQuantityDecimalPlaces: 2,
      baseInputDecimalPlaces: 2,

      unitOptions: group.unitOptions,

      // واردسازی Excel قیمت خرید و فروش ثبت نمی‌کند
      prices: [],
    };

    group.status =
      group.errors.length === 0 &&
        group.rows.every(
          (row) => row.errors.length === 0
        )
        ? 'valid'
        : 'invalid';

    group.errors = [
      ...new Set([
        ...group.errors,
        ...group.rows.flatMap(
          (row) => row.errors
        ),
      ]),
    ];

    group.rowNumbers = group.rows.map(
      (row) => row.excelRow
    );

    // برای نمایش در رابط کاربری، Set حذف می‌شود
    delete group.unitIds;
    delete group.hasEmptyUnitRow;
  }


  const validGroups = groups.filter(
    (group) => group.status === 'valid'
  );

  const invalidGroups = groups.filter(
    (group) => group.status === 'invalid'
  );

  return {
    rows: validationRows,
    groups,

    validProducts: validGroups.map(
      (group) => group.input
    ),

    totalProducts: groups.length,
    validProductCount: validGroups.length,
    invalidProductCount: invalidGroups.length,

    validRowCount: validationRows.filter(
      (row) => row.status === 'valid'
    ).length,

    invalidRowCount: validationRows.filter(
      (row) => row.status === 'invalid'
    ).length,
  };
}