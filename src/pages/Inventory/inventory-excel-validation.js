import {
  normalizePersianText,
  toEnglishDigits,
} from '../../utils/persianText';

// افزودن پیام خطا بدون تکرار
function addError(errors, message) {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}

// افزودن نام یا کد به فهرست تطبیق
function addLookupAlias(lookup, alias, item) {
  const key = normalizePersianText(alias);

  if (!key) {
    return;
  }

  const existing = lookup.get(key);

  if (!existing) {
    lookup.set(key, {
      item,
      ambiguous: false,
    });

    return;
  }

  // یک نام مشترک برای دو شناسه متفاوت، مبهم است.
  if (existing.item.id !== item.id) {
    existing.ambiguous = true;
  }
}

// ساخت فهرست تطبیق کالاها
function createProductLookup(products) {
  const lookup = new Map();

  for (const product of products) {
    addLookupAlias(
      lookup,
      product.name,
      product
    );
  }

  return lookup;
}

// ساخت فهرست تطبیق ارزها
function createCurrencyLookup(currencies) {
  const lookup = new Map();

  for (const currency of currencies) {
    addLookupAlias(lookup, currency.code, currency);
    addLookupAlias(lookup, currency.name, currency);
    addLookupAlias(lookup, currency.symbol, currency);
  }

  return lookup;
}

// جست‌وجوی یک مقدار در فهرست معتبر
function resolveLookup(lookup, value, label, errors) {
  const key = normalizePersianText(value);

  if (!key) {
    addError(errors, `${label} مشخص نشده است.`);
    return null;
  }

  const result = lookup.get(key);

  if (!result) {
    addError(
      errors,
      `${label} «${value}» در فهرست فعال حساب‌یار پیدا نشد.`
    );

    return null;
  }

  if (result.ambiguous) {
    addError(
      errors,
      `${label} «${value}» به بیش از یک مورد اشاره می‌کند؛ نام دقیق‌تری وارد کن.`
    );

    return null;
  }

  return result.item;
}

// تبدیل مقدار Excel به عدد اعشاری دقیق با مقیاس شش رقم
function parseExcelDecimal(
  value,
  label,
  maximumDecimalPlaces,
  errors
) {
  const sourceText = String(value ?? '').trim();

  if (!sourceText) {
    addError(errors, `${label} وارد نشده است.`);
    return null;
  }

  // پشتیبانی از ارقام فارسی، عربی و انگلیسی
  // جداکننده هزارگان حذف و جداکننده اعشار عربی تبدیل می‌شود.
  const text = toEnglishDigits(sourceText)
    .replace(/[\s\u00A0]/g, '')
    .replace(/[,\u066C]/g, '')
    .replace(/\u066B/g, '.');

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);

  if (!match) {
    addError(
      errors,
      `${label} «${sourceText}» عدد معتبر و نامنفی نیست.`
    );

    return null;
  }

  const fraction = match[2] || '';

  // صفرهای انتهایی در دقت مؤثر عدد محاسبه نمی‌شوند.
  const effectiveFraction = fraction.replace(/0+$/, '');

  if (
    effectiveFraction.length > maximumDecimalPlaces ||
    effectiveFraction.length > 6
  ) {
    addError(
      errors,
      `${label} حداکثر می‌تواند ${maximumDecimalPlaces} رقم اعشار داشته باشد.`
    );

    return null;
  }

  // تبدیل عدد به مقیاس ثابت یک میلیون، بدون محاسبات اعشاری شناور
  const decimalPart = BigInt(
    fraction.padEnd(6, '0').slice(0, 6) || '0'
  );

  const scaledValue =
    BigInt(match[1]) * 1_000_000n + decimalPart;

  if (scaledValue <= 0n) {
    addError(
      errors,
      `${label} باید بزرگ‌تر از صفر باشد.`
    );

    return null;
  }

  if (scaledValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    addError(
      errors,
      `${label} از محدوده مجاز بیشتر است.`
    );

    return null;
  }

  // ساخت متن استاندارد برای ارسال به سرویس ذخیره سند
  const normalizedText = effectiveFraction
    ? `${match[1]}.${effectiveFraction}`
    : match[1];

  return {
    text: normalizedText,
    scaled: scaledValue,
  };
}

// یافتن واحد متعلق به یک محصول
function resolveProductUnit(product, unitName, errors) {
  const productUnits = product.productUnits || [];

  // اگر واحد در فایل مشخص نشده باشد، واحد پایه انتخاب می‌شود.
  if (!String(unitName ?? '').trim()) {
    const baseUnit = productUnits.find(
      (unit) => unit.isBaseUnit
    );

    if (!baseUnit) {
      addError(
        errors,
        `واحد پایه کالای «${product.name}» در دسترس نیست.`
      );
    }

    return baseUnit || null;
  }

  const key = normalizePersianText(unitName);

  const matches = productUnits.filter((unit) => (
    normalizePersianText(unit.name) === key ||
    normalizePersianText(unit.symbol) === key
  ));

  if (matches.length === 0) {
    addError(
      errors,
      `واحد «${unitName}» برای کالای «${product.name}» تعریف نشده یا فعال نیست.`
    );

    return null;
  }

  if (
    new Set(matches.map((unit) => unit.productUnitId)).size > 1
  ) {
    addError(
      errors,
      `واحد «${unitName}» برای کالای «${product.name}» مبهم است.`
    );

    return null;
  }

  return matches[0];
}

// کنترل دقت و تبدیل مقدار به واحد پایه
function validateQuantityConversion(
  quantity,
  product,
  unit,
  errors,
  excelRow
) {
  if (!quantity || !unit) {
    return;
  }

  const inputDecimalPlaces = Number(
    unit.inputDecimalPlaces
  );

  const baseDecimalPlaces = Number(
    product.baseQuantityDecimalPlaces
  );

  const conversionNum = Number(unit.conversionNum);
  const conversionDen = Number(unit.conversionDen);

  if (
    !Number.isInteger(inputDecimalPlaces) ||
    inputDecimalPlaces < 0 ||
    inputDecimalPlaces > 6 ||
    !Number.isInteger(baseDecimalPlaces) ||
    baseDecimalPlaces < 0 ||
    baseDecimalPlaces > 6
  ) {
    addError(
      errors,
      `دقت اعشاری واحد کالای ردیف ${excelRow} معتبر نیست.`
    );

    return;
  }

  if (
    !Number.isSafeInteger(conversionNum) ||
    !Number.isSafeInteger(conversionDen) ||
    conversionNum <= 0 ||
    conversionDen <= 0
  ) {
    addError(
      errors,
      `نسبت تبدیل واحد کالای ردیف ${excelRow} معتبر نیست.`
    );

    return;
  }

  // تبدیل مقدار با دقت کامل BigInt
  const numerator =
    quantity.scaled * BigInt(conversionNum);

  const denominator = BigInt(conversionDen);

  // مقدار پایه نباید به علت گرد کردن تغییر کند.
  if (numerator % denominator !== 0n) {
    addError(
      errors,
      `مقدار ردیف ${excelRow} با نسبت تبدیل این واحد، به‌صورت دقیق قابل ذخیره نیست.`
    );

    return;
  }

  const baseQuantityScaled = numerator / denominator;

  if (
    baseQuantityScaled <= 0n ||
    baseQuantityScaled > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    addError(
      errors,
      `مقدار پایه ردیف ${excelRow} خارج از محدوده مجاز است.`
    );

    return;
  }

  // بررسی دقت اعشاری مجاز واحد پایه
  const precisionUnit =
    10n ** BigInt(6 - baseDecimalPlaces);

  if (baseQuantityScaled % precisionUnit !== 0n) {
    addError(
      errors,
      `مقدار تبدیل‌شده ردیف ${excelRow} بیشتر از دقت مجاز واحد پایه است.`
    );
  }
}

// اعتبارسنجی همه ردیف‌های فایل ورود کالا
export function validateInventoryExcelRows({
  rows,
  products,
  currencies,
  baseCurrencyCode,
}) {
  const productLookup = createProductLookup(products);
  const currencyLookup = createCurrencyLookup(currencies);

  const baseCurrency = currencies.find(
    (currency) => currency.code === baseCurrencyCode
  );

  const validationRows = rows.map((sourceRow) => {
    const errors = [];

    const productName = String(
      sourceRow.productName ?? ''
    ).trim();

    const unitName = String(
      sourceRow.unit ?? ''
    ).trim();

    const currencyName = String(
      sourceRow.currency ?? ''
    ).trim();

    // هر ردیف مستقل اعتبارسنجی می‌شود.
    const row = {
      ...sourceRow,
      product: null,
      unit: null,
      currency: null,
      sourceUnitName: unitName,
      sourceCurrencyName: currencyName,
      identified: false,
      status: 'invalid',
      errors,
      item: null,

    };

    // بررسی نام کالا
    if (!productName) {
      addError(errors, 'نام کالا وارد نشده است.');
    } else {
      const product = resolveLookup(
        productLookup,
        productName,
        'کالا',
        errors
      );

      if (product) {
        row.product = product;
        row.identified = true;
      }
    }

    // بررسی واحد، تنها پس از شناسایی کالا
    if (row.product) {
      row.unit = resolveProductUnit(
        row.product,
        unitName,
        errors
      );
    }

    // بررسی مقدار
    const maximumQuantityDecimals = row.unit
      ? Number(row.unit.inputDecimalPlaces)
      : 6;

    const quantity = parseExcelDecimal(
      sourceRow.quantity,
      'مقدار',
      maximumQuantityDecimals,
      errors
    );

    // بررسی قیمت واحد
    // قیمت صفر رد می‌شود چون سرویس ثبت نهایی فعلی آن را نمی‌پذیرد.
    const unitPrice = parseExcelDecimal(
      sourceRow.unitPrice,
      'قیمت واحد',
      6,
      errors
    );

    // بررسی تبدیل دقیق مقدار به واحد پایه
    if (row.product && row.unit) {
      validateQuantityConversion(
        quantity,
        row.product,
        row.unit,
        errors,
        sourceRow.excelRow
      );
    }

    // انتخاب ارز؛ مقدار خالی به معنی ارز مبنای حساب‌یار است.
    if (!currencyName) {
      if (!baseCurrency) {
        addError(
          errors,
          'ارز مبنای حساب‌یار در فهرست ارزهای فعال پیدا نشد.'
        );
      } else {
        row.currency = baseCurrency;
      }
    } else {
      row.currency = resolveLookup(
        currencyLookup,
        currencyName,
        'ارز',
        errors
      );
    }

    // فقط ردیفی که تمام بررسی‌ها را گذرانده، قابل ذخیره است.
    if (
      errors.length === 0 &&
      row.product &&
      row.unit &&
      row.currency &&
      quantity &&
      unitPrice
    ) {
      row.status = 'valid';

      row.item = {
        productId: row.product.id,
        productUnitId: row.unit.productUnitId,
        quantity: quantity.text,
        unitPrice: unitPrice.text,
        currencyCode: row.currency.code,
      };
    }

    return row;
  });

  return {
    rows: validationRows,

    totalCount: validationRows.length,

    // تعداد ردیف‌هایی که نام کالا در فهرست فعال پیدا شده است.
    identifiedCount: validationRows.filter(
      (row) => row.identified
    ).length,

    validCount: validationRows.filter(
      (row) => row.status === 'valid'
    ).length,

    invalidCount: validationRows.filter(
      (row) => row.status !== 'valid'
    ).length,

    validRows: validationRows.filter(
      (row) => row.status === 'valid'
    ),
  };
}