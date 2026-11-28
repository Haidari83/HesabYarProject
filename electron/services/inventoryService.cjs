
// تولید شناسه یکتای سند و ردیف‌های آن
const crypto = require('node:crypto');

// بررسی مجوز کاربر برای عملیات موجودی
const {
  assertPermission,
} = require('./authorizationService.cjs');


// انواع اسناد ورودی و مجوز موردنیاز هرکدام
const INVENTORY_ENTRY_TYPES = {
  purchase: {
    databaseType: 'purchase',
    permission: 'inventory.entry.create',
  },

  'sales-return': {
    databaseType: 'sales_return',
    permission: 'inventory.entry.create',
  },

  opening: {
    databaseType: 'opening',
    permission: 'inventory.opening.create',
  },

  other: {
    databaseType: 'other',
    permission: 'inventory.entry.create',
  },
};

// محاسبه بزرگ‌ترین مقسوم‌علیه مشترک با BigInt
function greatestCommonDivisorBigInt(first, second) {

  let a = BigInt(first);
  let b = BigInt(second);

  while (b !== 0n) {

    const remainder = a % b;

    a = b;
    b = remainder;

  }

  return a;

}


// محاسبه نسبت واحد انتخاب‌شده به واحد پایه محصول
function resolveProductUnitConversion(row) {

  // واحد مبنای محصول همیشه نسبت یک به یک دارد
  if (Number(row.is_base_unit) === 1) {

    return {
      conversionNum: 1,
      conversionDen: 1,
    };

  }


  // واحد بسته‌بندی از نسبت اختصاصی همین محصول استفاده می‌کند
  if (row.unit_kind === 'package') {

    const conversionNum = Number(row.conversion_num);

    const conversionDen = Number(row.conversion_den);

    if (
      !Number.isSafeInteger(conversionNum) ||
      !Number.isSafeInteger(conversionDen) ||
      conversionNum <= 0 ||
      conversionDen <= 0
    ) {

      throw new Error(
        `نسبت تبدیل واحد بسته‌بندی «${row.unit_name}» معتبر نیست.`
      );

    }

    return {
      conversionNum,
      conversionDen,
    };

  }


  // واحد استاندارد باید هم‌بُعد با واحد پایه باشد
  if (row.unit_kind === 'standard') {

    if (
      row.dimension_code !== row.base_unit_dimension_code
    ) {

      throw new Error(
        `واحد «${row.unit_name}» با واحد پایه کالا هم‌بُعد نیست.`
      );

    }


    const unitNum = Number(row.reference_factor_num);

    const unitDen = Number(row.reference_factor_den);

    const baseNum = Number(row.base_reference_factor_num);

    const baseDen = Number(row.base_reference_factor_den);


    const validFactors = [
      unitNum,
      unitDen,
      baseNum,
      baseDen,
    ].every((value) =>
      Number.isSafeInteger(value) && value > 0
    );


    if (!validFactors) {

      throw new Error(
        `ضرایب مرجع واحد «${row.unit_name}» معتبر نیست.`
      );

    }


    // نسبت واحد انتخاب‌شده به واحد پایه
    const numerator =
      BigInt(unitNum) * BigInt(baseDen);

    const denominator =
      BigInt(unitDen) * BigInt(baseNum);


    // ساده‌سازی کسر
    const divisor = greatestCommonDivisorBigInt(
      numerator,
      denominator
    );


    const conversionNum = numerator / divisor;

    const conversionDen = denominator / divisor;


    if (
      conversionNum > BigInt(Number.MAX_SAFE_INTEGER) ||
      conversionDen > BigInt(Number.MAX_SAFE_INTEGER)
    ) {

      throw new Error(
        `نسبت تبدیل واحد «${row.unit_name}» خارج از محدوده مجاز است.`
      );

    }


    return {

      conversionNum: Number(conversionNum),

      conversionDen: Number(conversionDen),

    };

  }


  throw new Error(
    `نوع واحد «${row.unit_name}» قابل استفاده نیست.`
  );

}
// دریافت اطلاعات لازم برای فرم ورود کالا
function getInventoryEntryFormOptions(
  database,
  actor,
  documentType
) {

  // بررسی معتبر بودن نوع سند
  const entryType = INVENTORY_ENTRY_TYPES[documentType];

  if (!entryType) {
    throw new Error(
      'نوع سند ورود کالا معتبر نیست.'
    );
  }


  // بررسی مجوز کاربر متناسب با نوع سند
  assertPermission(
    database,
    actor,
    entryType.permission
  );


  // دریافت ارز مبنای ارزش‌گذاری از تنظیمات برنامه
  const baseCurrencySetting = database.prepare(`
    SELECT
      setting_value
    FROM app_settings
    WHERE setting_key = ?
  `).get('base_currency_code');


  if (
    !baseCurrencySetting ||
    !baseCurrencySetting.setting_value
  ) {
    throw new Error(
      'ارز مبنای حساب‌یار در تنظیمات مشخص نشده است.'
    );
  }


  const baseCurrencyCode =
    baseCurrencySetting.setting_value.toUpperCase();


  // دریافت ارزهای فعال
  const currencyRows = database.prepare(`
    SELECT
      code,
      name,
      symbol,
      minor_unit_digits
    FROM currencies
    WHERE is_active = 1
    ORDER BY
      CASE
        WHEN code = ? THEN 0
        ELSE 1
      END,
      code ASC
  `).all(baseCurrencyCode);


  // اطمینان از فعال بودن ارز مبنای ارزش‌گذاری
  const baseCurrencyExists = currencyRows.some(
    (currency) => currency.code === baseCurrencyCode
  );


  if (!baseCurrencyExists) {
    throw new Error(
      'ارز مبنای ارزش‌گذاری در فهرست ارزهای فعال وجود ندارد.'
    );
  }


  // تبدیل اطلاعات ارزها به ساختار مناسب رابط کاربری
  const currencies = currencyRows.map((currency) => ({
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol || '',

    minorUnitDigits: Number(
      currency.minor_unit_digits
    ),
  }));


  // دریافت محصولات فعال و واحدهای فعال اختصاصی هر محصول
  const productRows = database.prepare(`
    SELECT

      p.id,
      p.code,
      p.name,
      p.category_id,
      c.name AS category_name,

      p.base_unit_id,
      p.base_quantity_decimal_places,

      bu.name AS base_unit_name,
      bu.symbol AS base_unit_symbol,
      bu.dimension_code AS base_unit_dimension_code,
      bu.reference_factor_num AS base_reference_factor_num,
      bu.reference_factor_den AS base_reference_factor_den,

      pu.id AS product_unit_id,
      pu.unit_id,
      pu.is_base_unit,
      pu.conversion_num,
      pu.conversion_den,
      pu.input_decimal_places,

      u.name AS unit_name,
      u.symbol AS unit_symbol,
      u.unit_kind,
      u.dimension_code,
      u.reference_factor_num,
      u.reference_factor_den

    FROM products AS p

    JOIN units AS bu
      ON bu.id = p.base_unit_id
      AND bu.is_active = 1

    JOIN product_units AS pu
      ON pu.product_id = p.id
      AND pu.is_active = 1

    JOIN units AS u
      ON u.id = pu.unit_id
      AND u.is_active = 1

    LEFT JOIN categories AS c
      ON c.id = p.category_id

    WHERE p.is_active = 1

    ORDER BY
      p.name COLLATE NOCASE ASC,
      pu.is_base_unit DESC,
      u.name COLLATE NOCASE ASC

  `).all();


  // گروه‌بندی واحدها بر اساس محصول مربوط به آن‌ها
  const productsById = new Map();


  for (const row of productRows) {

    // ایجاد اطلاعات اولیه محصول در اولین مواجهه
    if (!productsById.has(row.id)) {

      productsById.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name,

        categoryId: row.category_id,
        categoryName: row.category_name || '',

        baseUnitId: row.base_unit_id,
        baseUnitName: row.base_unit_name,
        baseUnitSymbol: row.base_unit_symbol || '',

        baseQuantityDecimalPlaces: Number(
          row.base_quantity_decimal_places
        ),

        productUnits: [],
      });

    }


    // افزودن واحد جاری به مجموعه واحدهای محصول
    const isBaseUnit = Number(row.is_base_unit) === 1;

    const conversion = resolveProductUnitConversion(row);

    productsById.get(row.id).productUnits.push({

      // شناسه نسخه واحد اختصاصی محصول
      productUnitId: row.product_unit_id,

      // شناسه عمومی واحد اندازه‌گیری
      unitId: row.unit_id,

      name: row.unit_name,
      symbol: row.unit_symbol || '',

      isBaseUnit,

      // نسبت تبدیل واحد انتخاب‌شده به واحد مبنای محصول
      // واحد مبنا همیشه نسبت ۱ به ۱ دارد.
      conversionNum: conversion.conversionNum,

      conversionDen: conversion.conversionDen,

      // حداکثر تعداد رقم اعشار مجاز برای ورود مقدار
      inputDecimalPlaces: Number(
        row.input_decimal_places
      ),

    });

  }


  // تبدیل Map به آرایه و حذف محصولات فاقد واحد مبنای فعال
  const products = Array
    .from(productsById.values())
    .filter((product) =>
      product.productUnits.some(
        (unit) => unit.isBaseUnit
      )
    );


  // تحویل اطلاعات آماده‌شده به رابط کاربری
  return {

    documentType,

    baseCurrencyCode,

    currencies,

    products,

  };

}

// تبدیل ارقام فارسی و عربی به ارقام انگلیسی
function normalizeInventoryNumber(value) {
  return String(value)
    .replace(/[۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - 1776)
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - 1632)
    )
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}


// تبدیل عدد اعشاری به عدد صحیح با مقیاس یک میلیون
function parseInventoryDecimal(
  value,
  label,
  maximumDecimalPlaces,
  allowZero = false
) {

  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  const text = normalizeInventoryNumber(value).trim();

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);

  if (!match) {
    throw new Error(`${label} باید یک عدد معتبر و نامنفی باشد.`);
  }

  const fraction = match[2] || '';

  // صفرهای انتهایی در تعداد رقم اعشار مؤثر نیستند
  const effectiveFraction = fraction.replace(/0+$/, '');

  if (
    effectiveFraction.length > maximumDecimalPlaces ||
    effectiveFraction.length > 6
  ) {
    throw new Error(
      `${label} حداکثر می‌تواند ${maximumDecimalPlaces} رقم اعشار داشته باشد.`
    );
  }

  // تبدیل بخش اعشاری به شش رقم
  const decimalPart = BigInt(
    fraction.padEnd(6, '0').slice(0, 6) || '0'
  );

  const scaledValue =
    BigInt(match[1]) * 1_000_000n + decimalPart;

  if (!allowZero && scaledValue <= 0n) {
    throw new Error(`${label} باید بزرگ‌تر از صفر باشد.`);
  }

  if (allowZero && scaledValue < 0n) {
    throw new Error(`${label} نمی‌تواند منفی باشد.`);
  }

  if (scaledValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} از محدوده مجاز بیشتر است.`);
  }

  return scaledValue;
}


// اعتبارسنجی تاریخ سند
function validateInventoryDate(value) {

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error('تاریخ سند معتبر نیست.');
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('تاریخ واردشده وجود ندارد.');
  }

  return value;
}


// اعتبارسنجی متن‌های اختیاری سند
function getOptionalInventoryText(
  value,
  label,
  maximumLength
) {

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} معتبر نیست.`);
  }

  const text = value.trim();

  if (text.length > maximumLength) {
    throw new Error(
      `${label} نمی‌تواند بیشتر از ${maximumLength} نویسه باشد.`
    );
  }

  return text || null;
}


// دریافت آخرین نرخ تبدیل معتبر تا تاریخ سند
function getInventoryExchangeRate(
  database,
  fromCurrencyCode,
  toCurrencyCode,
  documentDate
) {

  // تبدیل یک ارز به خودش همیشه یک به یک است
  if (fromCurrencyCode === toCurrencyCode) {
    return {
      rateNum: 1,
      rateDen: 1,
    };
  }


  const findRate = database.prepare(`
    SELECT
      rate_num,
      rate_den,
      effective_at,
      created_at
    FROM exchange_rates
    WHERE from_currency_code = ?
      AND to_currency_code = ?
      AND date(effective_at) <= date(?)
    ORDER BY
      date(effective_at) DESC,
      effective_at DESC,
      created_at DESC
    LIMIT 1
  `);


  // بررسی نرخ مستقیم
  const directRate = findRate.get(
    fromCurrencyCode,
    toCurrencyCode,
    documentDate
  );


  // بررسی نرخ معکوس
  const inverseRate = findRate.get(
    toCurrencyCode,
    fromCurrencyCode,
    documentDate
  );


  if (!directRate && !inverseRate) {
    throw new Error(
      `نرخ تبدیل ${fromCurrencyCode} به ${toCurrencyCode} برای تاریخ سند ثبت نشده است.`
    );
  }


  // انتخاب نرخ جدیدتر؛ در صورت برابری، نرخ مستقیم اولویت دارد
  const useDirectRate =
    directRate &&
    (
      !inverseRate ||
      `${directRate.effective_at}|${directRate.created_at}` >=
      `${inverseRate.effective_at}|${inverseRate.created_at}`
    );


  if (useDirectRate) {
    return {
      rateNum: Number(directRate.rate_num),
      rateDen: Number(directRate.rate_den),
    };
  }


  // معکوس کردن نرخ در صورت نبودن نرخ مستقیم جدیدتر
  return {
    rateNum: Number(inverseRate.rate_den),
    rateDen: Number(inverseRate.rate_num),
  };

}


// تولید شماره یکتای سند ورود کالا
function getNextInventoryDocumentNumber(
  database,
  documentDate
) {

  const datePart = documentDate.replace(/-/g, '');

  const prefix = `IN-${datePart}-`;


  const documents = database.prepare(`
    SELECT document_number
    FROM inventory_documents
    WHERE document_number LIKE ?
  `).all(`${prefix}%`);


  let maximumNumber = 0;


  for (const document of documents) {

    const match = new RegExp(
      `^IN-${datePart}-(\\d+)$`
    ).exec(document.document_number);

    if (match) {
      maximumNumber = Math.max(
        maximumNumber,
        Number(match[1])
      );
    }

  }


  return (
    prefix +
    String(maximumNumber + 1).padStart(5, '0')
  );

}


// ثبت رویداد در تاریخچه فعالیت‌های کاربران
function writeInventoryAudit(
  database,
  actor,
  actionKey,
  documentId,
  details,
  createdAt
) {

  database.prepare(`
    INSERT INTO audit_logs (
      id,
      actor_user_id,
      actor_username,
      actor_display_name,
      action_key,
      entity_type,
      entity_id,
      details_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    actor.id,
    actor.username,
    actor.displayName,
    actionKey,
    'inventory_document',
    documentId,
    JSON.stringify(details),
    createdAt
  );

}


// ثبت پیش‌نویس سند ورود کالا
function createInventoryEntryDraft(
  database,
  actor,
  input
) {

  // بررسی ساختار اطلاعات دریافتی
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات سند معتبر نیست.');
  }


  // بررسی نوع سند
  const entryType = INVENTORY_ENTRY_TYPES[input.documentType];

  if (!entryType) {
    throw new Error('نوع سند ورود کالا معتبر نیست.');
  }


  // بررسی مجوز متناسب با نوع سند
  assertPermission(
    database,
    actor,
    entryType.permission
  );


  // اعتبارسنجی تاریخ
  const documentDate = validateInventoryDate(
    input.documentDate
  );


  // بررسی فهرست ردیف‌های سند
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    throw new Error(
      'برای ذخیره سند حداقل یک کالا باید اضافه شود.'
    );
  }

  if (input.items.length > 200) {
    throw new Error(
      'در هر سند حداکثر ۲۰۰ ردیف کالا قابل ثبت است.'
    );
  }


  // دریافت و اعتبارسنجی اطلاعات تکمیلی
  const sourcePartyName = getOptionalInventoryText(
    input.sourcePartyName,
    'نام طرف حساب',
    150
  );

  const sourceInvoiceNumber = getOptionalInventoryText(
    input.sourceInvoiceNumber,
    'شماره فاکتور',
    100
  );

  const reason = getOptionalInventoryText(
    input.reason,
    'علت ورود کالا',
    500
  );

  const notes = getOptionalInventoryText(
    input.notes,
    'یادداشت سند',
    2000
  );


  // سند متفرقه باید علت ورود داشته باشد
  if (
    input.documentType === 'other' &&
    !reason
  ) {
    throw new Error(
      'برای سند ورود متفرقه، علت ورود کالا را مشخص کن.'
    );
  }


  // تعیین نوع طرف حساب بر اساس نوع سند
  const sourcePartyType = {
    purchase: 'supplier',
    'sales-return': 'customer',
    opening: null,
    other: 'other',
  }[input.documentType];


  const createdAt = new Date().toISOString();


  // شروع تراکنش؛ تمام ردیف‌ها با هم ذخیره یا همگی لغو می‌شوند
  database.exec('BEGIN IMMEDIATE');


  try {

    // دریافت ارز مبنای ارزش‌گذاری
    const baseCurrencySetting = database.prepare(`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = ?
    `).get('base_currency_code');


    if (!baseCurrencySetting?.setting_value) {
      throw new Error(
        'ارز مبنای ارزش‌گذاری در تنظیمات مشخص نشده است.'
      );
    }


    const baseCurrencyCode =
      baseCurrencySetting.setting_value.toUpperCase();


    // ارز مبنا باید فعال باشد
    const baseCurrency = database.prepare(`
      SELECT code
      FROM currencies
      WHERE code = ?
        AND is_active = 1
    `).get(baseCurrencyCode);


    if (!baseCurrency) {
      throw new Error(
        'ارز مبنای ارزش‌گذاری فعال نیست.'
      );
    }


    // آماده‌سازی پرس‌وجوی دریافت محصول و واحد انتخاب‌شده
    const findProductUnit = database.prepare(`
      SELECT

        p.id AS product_id,
        p.code AS product_code,
        p.name AS product_name,
        p.base_quantity_decimal_places,
        p.base_unit_id,

        base_unit.dimension_code AS base_unit_dimension_code,
        base_unit.reference_factor_num AS base_reference_factor_num,
        base_unit.reference_factor_den AS base_reference_factor_den,

        pu.id AS product_unit_id,
        pu.unit_id,
        pu.is_base_unit,
        pu.conversion_num,
        pu.conversion_den,
        pu.input_decimal_places,

        u.name AS unit_name,
        u.symbol AS unit_symbol,
        u.unit_kind,
        u.dimension_code,
        u.reference_factor_num,
        u.reference_factor_den

      FROM products AS p

      JOIN units AS base_unit
        ON base_unit.id = p.base_unit_id
        AND base_unit.is_active = 1

      JOIN product_units AS pu
        ON pu.product_id = p.id

      JOIN units AS u
        ON u.id = pu.unit_id

      WHERE p.id = ?
        AND pu.id = ?
        AND p.is_active = 1
        AND pu.is_active = 1
        AND u.is_active = 1

      LIMIT 1
    `);


    // آماده‌سازی پرس‌وجوی ارز فعال
    const findCurrency = database.prepare(`
      SELECT
        code
      FROM currencies
      WHERE code = ?
        AND is_active = 1
    `);


    // جلوگیری از تکرار دریافت نرخ ارز در یک سند
    const exchangeRateCache = new Map();


    // آماده‌سازی اطلاعات معتبر تمام ردیف‌ها
    const validatedItems = input.items.map(
      (item, index) => {

        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item)
        ) {
          throw new Error(
            `اطلاعات ردیف ${index + 1} معتبر نیست.`
          );
        }


        // دریافت محصول و نسخه واحد از SQLite
        const productUnit = findProductUnit.get(
          item.productId,
          item.productUnitId
        );


        if (!productUnit) {
          throw new Error(
            `کالا یا واحد انتخاب‌شده در ردیف ${index + 1} معتبر یا فعال نیست.`
          );
        }


        // اعتبارسنجی تعداد رقم اعشار مجاز واحد
        const inputDecimalPlaces = Number(
          productUnit.input_decimal_places
        );

        const baseDecimalPlaces = Number(
          productUnit.base_quantity_decimal_places
        );


        // دریافت مقدار واردشده
        const quantityScaled = parseInventoryDecimal(
          item.quantity,
          `مقدار ردیف ${index + 1}`,
          inputDecimalPlaces
        );


        // دریافت قیمت واحد
        const unitPriceScaled = parseInventoryDecimal(
          item.unitPrice,
          `قیمت واحد ردیف ${index + 1}`,
          6,
          true
        );


        // نسبت تبدیل واحد انتخاب‌شده به واحد پایه
        // محاسبه مجدد نسبت تبدیل از اطلاعات معتبر پایگاه داده
        const conversion = resolveProductUnitConversion(
          productUnit
        );

        const conversionNum = conversion.conversionNum;

        const conversionDen = conversion.conversionDen;


        if (
          !Number.isSafeInteger(conversionNum) ||
          !Number.isSafeInteger(conversionDen) ||
          conversionNum <= 0 ||
          conversionDen <= 0
        ) {
          throw new Error(
            `نسبت تبدیل واحد در ردیف ${index + 1} معتبر نیست.`
          );
        }


        // تبدیل مقدار به واحد پایه با محاسبات دقیق BigInt
        const baseQuantityNumerator =
          quantityScaled * BigInt(conversionNum);

        const conversionDenominator =
          BigInt(conversionDen);


        // جلوگیری از گرد کردن پنهانی مقدار موجودی
        if (
          baseQuantityNumerator % conversionDenominator !== 0n
        ) {
          throw new Error(
            `مقدار ردیف ${index + 1} با نسبت تبدیل این واحد، به‌صورت دقیق قابل ذخیره نیست.`
          );
        }


        const baseQuantityScaled =
          baseQuantityNumerator / conversionDenominator;


        // کنترل دقت مجاز واحد پایه محصول
        const basePrecisionUnit =
          10n ** BigInt(6 - baseDecimalPlaces);


        if (
          baseQuantityScaled % basePrecisionUnit !== 0n
        ) {
          throw new Error(
            `مقدار تبدیل‌شده ردیف ${index + 1} بیشتر از دقت مجاز واحد پایه است.`
          );
        }


        if (
          baseQuantityScaled <= 0n ||
          baseQuantityScaled > BigInt(Number.MAX_SAFE_INTEGER)
        ) {
          throw new Error(
            `مقدار پایه ردیف ${index + 1} خارج از محدوده مجاز است.`
          );
        }


        // تعیین ارز قیمت؛ در صورت عدم ارسال، ارز مبنا استفاده می‌شود
        const currencyCode = (
          typeof item.currencyCode === 'string' &&
            item.currencyCode.trim()
            ? item.currencyCode.trim().toUpperCase()
            : baseCurrencyCode
        );


        // ارز باید فعال باشد
        if (!findCurrency.get(currencyCode)) {
          throw new Error(
            `ارز ردیف ${index + 1} فعال یا معتبر نیست.`
          );
        }


        // دریافت نرخ تبدیل و ذخیره نسخه آن در سند
        if (!exchangeRateCache.has(currencyCode)) {

          exchangeRateCache.set(
            currencyCode,
            getInventoryExchangeRate(
              database,
              currencyCode,
              baseCurrencyCode,
              documentDate
            )
          );

        }


        const exchangeRate =
          exchangeRateCache.get(currencyCode);


        if (
          !Number.isSafeInteger(exchangeRate.rateNum) ||
          !Number.isSafeInteger(exchangeRate.rateDen) ||
          exchangeRate.rateNum <= 0 ||
          exchangeRate.rateDen <= 0
        ) {
          throw new Error(
            `نرخ ارز ردیف ${index + 1} معتبر نیست.`
          );
        }


        // یادداشت اختصاصی ردیف
        const itemNotes = getOptionalInventoryText(
          item.notes,
          `یادداشت ردیف ${index + 1}`,
          500
        );


        // فقط اطلاعات تأییدشده از پایگاه داده و محاسبات معتبر
        return {

          id: crypto.randomUUID(),

          lineNumber: index + 1,

          productId: productUnit.product_id,
          productUnitId: productUnit.product_unit_id,

          productCode: productUnit.product_code,
          productName: productUnit.product_name,

          unitName: productUnit.unit_name,
          unitSymbol: productUnit.unit_symbol || '',

          conversionNum,
          conversionDen,

          quantityScaled: Number(quantityScaled),
          baseQuantityScaled: Number(baseQuantityScaled),

          unitPriceScaled: Number(unitPriceScaled),

          currencyCode,
          valuationCurrencyCode: baseCurrencyCode,

          exchangeRateNum: exchangeRate.rateNum,
          exchangeRateDen: exchangeRate.rateDen,

          notes: itemNotes,

        };

      }
    );


    // تولید شناسه و شماره یکتای سند
    const documentId = crypto.randomUUID();

    const documentNumber = getNextInventoryDocumentNumber(
      database,
      documentDate
    );


    // ثبت اطلاعات عمومی سند در وضعیت پیش‌نویس
    database.prepare(`
      INSERT INTO inventory_documents (

        id,
        document_number,
        document_type,
        document_date,
        status,

        source_party_type,
        source_party_name,
        source_invoice_number,
        reason,
        notes,

        created_at,
        created_by_user_id

      )

      VALUES (
        ?, ?, ?, ?, 'draft',
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(

      documentId,
      documentNumber,
      entryType.databaseType,
      documentDate,

      sourcePartyType,
      input.documentType === 'opening'
        ? null
        : sourcePartyName,

      sourceInvoiceNumber,
      reason,
      notes,

      createdAt,
      actor.id

    );


    // آماده‌سازی دستور ثبت ردیف‌های سند
    const insertDocumentItem = database.prepare(`
      INSERT INTO inventory_document_items (

        id,
        document_id,
        line_number,

        product_id,
        product_unit_id,

        product_code_snapshot,
        product_name_snapshot,

        unit_name_snapshot,
        unit_symbol_snapshot,

        conversion_num,
        conversion_den,

        quantity_scaled,
        base_quantity_scaled,

        unit_price_scaled,

        currency_code,
        valuation_currency_code,

        exchange_rate_num,
        exchange_rate_den,

        notes,

        created_at,
        created_by_user_id

      )

      VALUES (
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?,
        ?, ?
      )
    `);


    // ثبت تمام ردیف‌ها در همان تراکنش
    for (const item of validatedItems) {

      insertDocumentItem.run(

        item.id,
        documentId,
        item.lineNumber,

        item.productId,
        item.productUnitId,

        item.productCode,
        item.productName,

        item.unitName,
        item.unitSymbol,

        item.conversionNum,
        item.conversionDen,

        item.quantityScaled,
        item.baseQuantityScaled,

        item.unitPriceScaled,

        item.currencyCode,
        item.valuationCurrencyCode,

        item.exchangeRateNum,
        item.exchangeRateDen,

        item.notes,

        createdAt,
        actor.id

      );

    }


    // ثبت فعالیت کاربر در تاریخچه سیستم
    writeInventoryAudit(
      database,
      actor,
      'inventory.document.draft_created',
      documentId,
      {
        documentNumber,
        documentType: entryType.databaseType,
        documentDate,
        itemCount: validatedItems.length,
      },
      createdAt
    );


    // نهایی شدن تراکنش
    database.exec('COMMIT');


    // نتیجه قابل استفاده در رابط کاربری
    return {

      id: documentId,
      documentNumber,

      documentType: entryType.databaseType,
      documentDate,

      status: 'draft',

      itemCount: validatedItems.length,

      createdAt,

    };

  } catch (error) {

    // در صورت بروز هر خطا، تمام تغییرات این عملیات لغو می‌شوند
    try {
      database.exec('ROLLBACK');
    } catch {
      // در صورت پایان قبلی تراکنش، خطای ثانویه نادیده گرفته می‌شود
    }

    throw error;

  }

}

// ثبت نهایی سند ورود کالا و ایجاد گردش و لایه بهای FIFO
function postInventoryDocument(
  database,
  actor,
  documentId
) {

  // اعتبارسنجی شناسه سند
  if (
    typeof documentId !== 'string' ||
    !documentId.trim() ||
    documentId.trim().length > 100
  ) {
    throw new Error('شناسه سند معتبر نیست.');
  }

  const normalizedDocumentId = documentId.trim();

  const postedAt = new Date().toISOString();

  // تمام عملیات ثبت نهایی باید یکپارچه انجام شوند.
  // در صورت شکست هر بخش، تمام تغییرات بازگردانده می‌شوند.
  database.exec('BEGIN IMMEDIATE');

  try {

    // دریافت سند از پایگاه داده
    const document = database.prepare(`
      SELECT
        id,
        document_number,
        document_type,
        document_date,
        status
      FROM inventory_documents
      WHERE id = ?
      LIMIT 1
    `).get(normalizedDocumentId);


    if (!document) {
      throw new Error('سند موردنظر پیدا نشد.');
    }


    // شناسایی نوع سند و مجوز موردنیاز آن
    const entryType = Object.values(
      INVENTORY_ENTRY_TYPES
    ).find(
      (type) => type.databaseType === document.document_type
    );


    // در این مرحله فقط اسناد ورودی پشتیبانی می‌شوند.
    if (!entryType) {
      throw new Error(
        'ثبت نهایی این نوع سند در این مرحله پشتیبانی نمی‌شود.'
      );
    }


    // بررسی مجوز ثبت نهایی
    assertPermission(
      database,
      actor,
      entryType.permission
    );


    // فقط پیش‌نویس قابل ثبت نهایی است.
    if (document.status !== 'draft') {
      throw new Error(
        'این سند پیش‌نویس نیست یا قبلاً ثبت نهایی شده است.'
      );
    }


    // اعتبارسنجی دوباره تاریخ سند
    const documentDate = validateInventoryDate(
      document.document_date
    );


    // دریافت تمام اقلام سند
    const items = database.prepare(`
      SELECT
        id,
        product_id,
        product_name_snapshot,

        base_quantity_scaled,

        unit_price_scaled,

        conversion_num,
        conversion_den,

        exchange_rate_num,
        exchange_rate_den,

        valuation_currency_code

      FROM inventory_document_items

      WHERE document_id = ?

      ORDER BY line_number ASC
    `).all(normalizedDocumentId);


    if (!items.length) {
      throw new Error(
        'سند بدون کالا قابل ثبت نهایی نیست.'
      );
    }


    // زمان گردش بر اساس تاریخ سند تعیین می‌شود.
    // ساعت نیمه‌شب UTC صرفاً برای استانداردسازی مقدار تاریخ است.
    const movementAt =
      `${documentDate}T00:00:00.000Z`;


    // آماده‌سازی بررسی گردش‌های خروجی بعدی
    // جلوگیری از تغییر ترتیب FIFO اسناد خروجی قبلی
    const findLaterOutboundMovement = database.prepare(`
      SELECT
        document.document_number,
        document.document_date

      FROM inventory_movements AS movement

      JOIN inventory_documents AS document
        ON document.id = movement.document_id

      WHERE movement.product_id = ?
        AND movement.movement_direction = 'out'
        AND document.status = 'posted'
        AND date(movement.movement_at) > date(?)

      ORDER BY
        date(movement.movement_at) ASC

      LIMIT 1
    `);


    // اعتبارسنجی اقلام و محاسبه بهای هر واحد پایه
    const validatedItems = items.map((item, index) => {

      // مقادیر عددی باید در محدوده امن JavaScript باشند.
      if (
        !Number.isSafeInteger(item.base_quantity_scaled) ||
        item.base_quantity_scaled <= 0
      ) {
        throw new Error(
          `مقدار پایه کالای ردیف ${index + 1} معتبر نیست.`
        );
      }


      if (
        !Number.isSafeInteger(item.unit_price_scaled) ||
        item.unit_price_scaled <= 0
      ) {
        throw new Error(
          `قیمت ثبت‌شده کالای ردیف ${index + 1} معتبر نیست.`
        );
      }


      const conversionNum = item.conversion_num;
      const conversionDen = item.conversion_den;

      const exchangeRateNum = item.exchange_rate_num;
      const exchangeRateDen = item.exchange_rate_den;


      if (
        !Number.isSafeInteger(conversionNum) ||
        !Number.isSafeInteger(conversionDen) ||
        conversionNum <= 0 ||
        conversionDen <= 0
      ) {
        throw new Error(
          `نسبت تبدیل واحد کالای ردیف ${index + 1} معتبر نیست.`
        );
      }


      if (
        !Number.isSafeInteger(exchangeRateNum) ||
        !Number.isSafeInteger(exchangeRateDen) ||
        exchangeRateNum <= 0 ||
        exchangeRateDen <= 0
      ) {
        throw new Error(
          `نرخ تبدیل ارز کالای ردیف ${index + 1} معتبر نیست.`
        );
      }


      if (
        typeof item.valuation_currency_code !== 'string' ||
        !item.valuation_currency_code.trim()
      ) {
        throw new Error(
          `ارز ارزش‌گذاری کالای ردیف ${index + 1} مشخص نیست.`
        );
      }


      // کنترل تاریخ‌گذاری FIFO:
      // ورود جدید با تاریخ قدیمی‌تر نباید بهای تمام‌شده
      // خروجی‌هایی را که قبلاً ثبت شده‌اند تغییر دهد.
      const laterOutbound = findLaterOutboundMovement.get(
        item.product_id,
        documentDate
      );


      if (laterOutbound) {
        throw new Error(
          `برای کالای «${item.product_name_snapshot}»، سند خروجی ` +
          `${laterOutbound.document_number} در تاریخ ` +
          `${laterOutbound.document_date} قبلاً ثبت شده است. ` +
          'ثبت سند ورودی با تاریخ قدیمی‌تر می‌تواند ترتیب FIFO را تغییر دهد.'
        );
      }


      /*
        محاسبه بهای هر واحد پایه:

        قیمت واحد در ارز سند
        × نرخ تبدیل ارز
        ÷ تعداد واحد پایه در واحد انتخاب‌شده

        تمام محاسبات با BigInt انجام می‌شوند
        تا خطای اعشاری JavaScript وارد ارزش موجودی نشود.
      */

      const numerator =
        BigInt(item.unit_price_scaled) *
        BigInt(exchangeRateNum) *
        BigInt(conversionDen);

      const denominator =
        BigInt(exchangeRateDen) *
        BigInt(conversionNum);


      if (denominator <= 0n) {
        throw new Error(
          `مخرج محاسبه بهای کالای ردیف ${index + 1} معتبر نیست.`
        );
      }


      // گرد کردن نیم به بالا در کوچک‌ترین واحد ذخیره‌سازی
      const unitCostScaled =
        (numerator + denominator / 2n) /
        denominator;


      if (
        unitCostScaled < 0n ||
        unitCostScaled > BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          `بهای تمام‌شده کالای ردیف ${index + 1} خارج از محدوده مجاز است.`
        );
      }


      return {
        ...item,
        unitCostScaled: Number(unitCostScaled),
      };

    });


    // انتقال وضعیت سند به ثبت‌شده
    // این تغییر قبل از ثبت گردش‌ها ضروری است؛
    // زیرا Trigger پایگاه داده فقط گردش سند ثبت‌شده را می‌پذیرد.
    const updateDocument = database.prepare(`
      UPDATE inventory_documents

      SET
        status = 'posted',
        posted_at = ?,
        posted_by_user_id = ?

      WHERE id = ?
        AND status = 'draft'
    `).run(
      postedAt,
      actor.id,
      normalizedDocumentId
    );


    if (updateDocument.changes !== 1) {
      throw new Error(
        'تغییر وضعیت سند به ثبت‌شده انجام نشد.'
      );
    }


    // دستور ایجاد گردش ورودی انبار
    const insertMovement = database.prepare(`
      INSERT INTO inventory_movements (
        id,
        document_id,
        document_item_id,
        product_id,
        movement_direction,
        base_quantity_scaled,
        movement_at,
        created_at,
        created_by_user_id
      )

      VALUES (?, ?, ?, ?, 'in', ?, ?, ?, ?)
    `);


    // دستور ایجاد لایه بهای تمام‌شده FIFO
    const insertCostLayer = database.prepare(`
      INSERT INTO inventory_cost_layers (
        id,
        source_movement_id,
        product_id,
        received_at,
        original_quantity_base_scaled,
        unit_cost_scaled,
        valuation_currency_code,
        created_at,
        created_by_user_id
      )

      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);


    // ثبت گردش و لایه FIFO برای تمام اقلام
    for (const item of validatedItems) {

      const movementId = crypto.randomUUID();

      const costLayerId = crypto.randomUUID();


      // ایجاد گردش ورود کالا
      insertMovement.run(
        movementId,
        normalizedDocumentId,
        item.id,
        item.product_id,
        item.base_quantity_scaled,
        movementAt,
        postedAt,
        actor.id
      );


      // ایجاد لایه بهای تمام‌شده
      insertCostLayer.run(
        costLayerId,
        movementId,
        item.product_id,
        movementAt,
        item.base_quantity_scaled,
        item.unitCostScaled,
        item.valuation_currency_code,
        postedAt,
        actor.id
      );

    }


    // ثبت فعالیت کاربر در تاریخچه سیستم
    writeInventoryAudit(
      database,
      actor,
      'inventory.document.posted',
      normalizedDocumentId,
      {
        documentNumber: document.document_number,
        documentType: document.document_type,
        documentDate,
        itemCount: validatedItems.length,
      },
      postedAt
    );


    // تأیید نهایی تمام عملیات
    database.exec('COMMIT');


    return {
      id: normalizedDocumentId,
      documentNumber: document.document_number,
      documentType: document.document_type,
      documentDate,
      status: 'posted',
      itemCount: validatedItems.length,
      postedAt,
      postedBy: actor.displayName,
    };

  } catch (error) {

    // بازگرداندن تمام تغییرات در صورت بروز خطا
    try {
      database.exec('ROLLBACK');
    } catch {
      // اگر تراکنش قبلاً پایان یافته باشد، خطای ثانویه نادیده گرفته می‌شود.
    }

    throw error;

  }

}
// دریافت فهرست موجودی واقعی کالاها از گردش‌های ثبت‌شده انبار
function getInventoryStockList(database, actor) {

  // فقط کاربری که مجوز مشاهده فهرست موجودی دارد، مجاز به دریافت آن است.
  assertPermission(
    database,
    actor,
    'inventory.stock_list.view'
  );


  // دریافت ارز مبنای ارزش‌گذاری
  const baseCurrencySetting = database.prepare(`
    SELECT
      setting_value
    FROM app_settings
    WHERE setting_key = ?
  `).get('base_currency_code');


  if (
    !baseCurrencySetting ||
    !baseCurrencySetting.setting_value
  ) {
    throw new Error(
      'ارز مبنای ارزش‌گذاری در تنظیمات مشخص نشده است.'
    );
  }


  const baseCurrencyCode =
    baseCurrencySetting.setting_value.toUpperCase();


  // محاسبه موجودی هر کالا از مجموع گردش‌های اسناد ثبت‌نهایی‌شده
  const rows = database.prepare(`
    WITH stock_totals AS (

      SELECT

        movement.product_id,

        SUM(
          CASE

            WHEN movement.movement_direction = 'in'
              THEN movement.base_quantity_scaled

            WHEN movement.movement_direction = 'out'
              THEN -movement.base_quantity_scaled

            ELSE 0

          END
        ) AS stock_scaled

      FROM inventory_movements AS movement

      JOIN inventory_documents AS document
        ON document.id = movement.document_id

      WHERE document.status = 'posted'

      GROUP BY movement.product_id

    )

    SELECT

      product.id,
      product.code,
      product.name,

      product.category_id,
      category.name AS category_name,

      product.base_unit_id,
      base_unit.name AS base_unit_name,
      base_unit.symbol AS base_unit_symbol,

      product.base_quantity_decimal_places,

      product.is_active,

      COALESCE(
        stock_totals.stock_scaled,
        0
      ) AS stock_scaled,


      purchase_price.unit_price_scaled
        AS purchase_price_scaled,

      purchase_price.currency_code
        AS purchase_price_currency_code,

      purchase_currency.symbol
        AS purchase_price_currency_symbol


    FROM products AS product


    JOIN categories AS category
      ON category.id = product.category_id


    JOIN units AS base_unit
      ON base_unit.id = product.base_unit_id


    LEFT JOIN stock_totals
      ON stock_totals.product_id = product.id


    /* دریافت قیمت خرید جاریِ واحد پایه، فقط در ارز مبنا */
    LEFT JOIN product_prices AS purchase_price

      ON purchase_price.id = (

        SELECT
          candidate.id

        FROM product_prices AS candidate

        JOIN product_units AS product_unit
          ON product_unit.id = candidate.product_unit_id

        WHERE candidate.product_id = product.id

          AND candidate.price_type = 'purchase'

          AND candidate.is_current = 1

          AND candidate.currency_code = ?

          AND product_unit.is_active = 1

          AND product_unit.is_base_unit = 1

        ORDER BY
          candidate.created_at DESC,
          candidate.id DESC

        LIMIT 1

      )


        LEFT JOIN currencies AS purchase_currency
      ON purchase_currency.code = purchase_price.currency_code

    -- فقط کالاهایی نمایش داده می‌شوند که ورود ثبت‌نهایی‌شده دارند.
    WHERE EXISTS (
      SELECT 1
      FROM inventory_movements AS entered_movement

      JOIN inventory_documents AS entered_document
        ON entered_document.id = entered_movement.document_id

      WHERE entered_movement.product_id = product.id
        AND entered_movement.movement_direction = 'in'
        AND entered_document.status = 'posted'
    )

    ORDER BY
      product.name COLLATE NOCASE ASC,
      product.code ASC

  `).all(baseCurrencyCode);


  // تبدیل نتیجه SQLite به ساختار قابل استفاده در رابط React
  const products = rows.map((row) => {

    const stockScaled = Number(
      row.stock_scaled ?? 0
    );


    // جلوگیری از تحویل عددی که دقت آن در JavaScript قابل اطمینان نیست
    if (!Number.isSafeInteger(stockScaled)) {
      throw new Error(
        `مقدار موجودی کالای «${row.name}» خارج از محدوده مجاز است.`
      );
    }


    const purchasePriceScaled =
      row.purchase_price_scaled === null
        ? null
        : Number(row.purchase_price_scaled);


    if (
      purchasePriceScaled !== null &&
      !Number.isSafeInteger(purchasePriceScaled)
    ) {
      throw new Error(
        `قیمت خرید کالای «${row.name}» خارج از محدوده مجاز است.`
      );
    }


    return {

      id: row.id,
      code: row.code,
      name: row.name,

      categoryId: row.category_id,
      categoryName: row.category_name || '',

      // موجودی همیشه در واحد پایه خود کالا گزارش می‌شود.
      unitId: row.base_unit_id,
      unitName: row.base_unit_name,
      unitSymbol: row.base_unit_symbol || '',

      baseQuantityDecimalPlaces: Number(
        row.base_quantity_decimal_places
      ),

      // مقدار اصلی در SQLite با مقیاس یک میلیون ذخیره می‌شود.
      stockScaled,
      stock: stockScaled / 1_000_000,

      isActive: Boolean(row.is_active),

      // قیمت خرید فقط در صورت وجود قیمت جاری در ارز مبنا ارسال می‌شود.
      purchasePrice:
        purchasePriceScaled === null
          ? null
          : purchasePriceScaled / 1_000_000,

      purchasePriceCurrencyCode:
        row.purchase_price_currency_code || null,

      purchasePriceCurrencySymbol:
        row.purchase_price_currency_symbol || '',

    };

  });


  return {
    baseCurrencyCode,
    products,
  };

}

// دریافت فهرست اسناد انبار با فیلتر و صفحه‌بندی
function getInventoryDocuments(
  database,
  actor,
  filters = {}
) {

  // بررسی مجوز مشاهده اسناد انبار
  assertPermission(
    database,
    actor,
    'inventory.documents.view'
  );


  // اعتبارسنجی فیلترهای دریافتی
  if (
    !filters ||
    typeof filters !== 'object' ||
    Array.isArray(filters)
  ) {
    throw new Error('فیلترهای فهرست اسناد معتبر نیستند.');
  }


  // وضعیت‌های مجاز اسناد
  const allowedStatuses = [
    'draft',
    'posted',
    'cancelled',
  ];

  const status = filters.status ?? 'all';


  if (
    status !== 'all' &&
    !allowedStatuses.includes(status)
  ) {
    throw new Error('وضعیت انتخاب‌شده معتبر نیست.');
  }


  // انواع مجاز اسناد انبار
  const allowedDocumentTypes = [
    'purchase',
    'sales_return',
    'opening',
    'other',
    'sale',
    'purchase_return',
    'adjustment_in',
    'adjustment_out',
  ];

  const documentType = filters.documentType ?? 'all';


  if (
    documentType !== 'all' &&
    !allowedDocumentTypes.includes(documentType)
  ) {
    throw new Error('نوع سند انتخاب‌شده معتبر نیست.');
  }


  // عبارت جست‌وجو
  const search =
    typeof filters.search === 'string'
      ? filters.search.trim()
      : '';


  if (search.length > 100) {
    throw new Error(
      'عبارت جست‌وجو نمی‌تواند بیشتر از ۱۰۰ نویسه باشد.'
    );
  }


  // تاریخ شروع بازه
  const fromDate = filters.fromDate
    ? validateInventoryDate(filters.fromDate)
    : null;


  // تاریخ پایان بازه
  const toDate = filters.toDate
    ? validateInventoryDate(filters.toDate)
    : null;


  // اطمینان از معتبر بودن ترتیب تاریخ‌ها
  if (
    fromDate &&
    toDate &&
    fromDate > toDate
  ) {
    throw new Error(
      'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.'
    );
  }


  // تعداد اسناد در هر صفحه
  const limit = filters.limit ?? 50;


  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      'تعداد اسناد درخواستی معتبر نیست.'
    );
  }


  // شماره موقعیت شروع نتایج
  const offset = filters.offset ?? 0;


  if (
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error(
      'موقعیت صفحه‌بندی معتبر نیست.'
    );
  }


  // ساخت شرط‌های جست‌وجو و فیلتر
  const conditions = [];

  const parameters = [];


  // فیلتر وضعیت
  if (status !== 'all') {

    conditions.push('d.status = ?');

    parameters.push(status);

  }


  // فیلتر نوع سند
  if (documentType !== 'all') {

    conditions.push('d.document_type = ?');

    parameters.push(documentType);

  }


  // فیلتر تاریخ شروع
  if (fromDate) {

    conditions.push('d.document_date >= ?');

    parameters.push(fromDate);

  }


  // فیلتر تاریخ پایان
  if (toDate) {

    conditions.push('d.document_date <= ?');

    parameters.push(toDate);

  }


  // جست‌وجو در شماره سند، طرف حساب و شماره فاکتور
  if (search) {

    conditions.push(`
      (
        d.document_number LIKE ?
        OR COALESCE(d.source_party_name, '') LIKE ?
        OR COALESCE(d.source_invoice_number, '') LIKE ?
      )
    `);

    const searchPattern = `%${search}%`;

    parameters.push(
      searchPattern,
      searchPattern,
      searchPattern
    );

  }


  // ساخت بخش WHERE
  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';


  // دریافت تعداد کل اسناد مطابق فیلترها
  const countResult = database.prepare(`
    SELECT
      COUNT(*) AS total_count

    FROM inventory_documents AS d

    ${whereClause}

  `).get(...parameters);


  // دریافت اطلاعات اسناد
  const rows = database.prepare(`
    SELECT

      d.id,

      d.document_number,

      d.document_type,

      d.document_date,

      d.status,

      d.source_party_type,

      d.source_party_name,

      d.source_invoice_number,

      d.reason,

      d.notes,

      d.created_at,

      d.updated_at,

      d.posted_at,

      d.cancelled_at,


      creator.id AS created_by_user_id,

      creator.username AS created_by_username,

      creator.display_name AS created_by_display_name,


      updater.display_name AS updated_by_display_name,


      poster.display_name AS posted_by_display_name,


      canceller.display_name AS cancelled_by_display_name,


      (
        SELECT COUNT(*)

        FROM inventory_document_items AS item

        WHERE item.document_id = d.id

      ) AS item_count


    FROM inventory_documents AS d


    LEFT JOIN users AS creator
      ON creator.id = d.created_by_user_id


    LEFT JOIN users AS updater
      ON updater.id = d.updated_by_user_id


    LEFT JOIN users AS poster
      ON poster.id = d.posted_by_user_id


    LEFT JOIN users AS canceller
      ON canceller.id = d.cancelled_by_user_id


    ${whereClause}


    ORDER BY

      d.document_date DESC,

      d.created_at DESC,

      d.document_number DESC


    LIMIT ?

    OFFSET ?

  `).all(
    ...parameters,
    limit,
    offset
  );


  // تبدیل نتیجه SQLite به ساختار مناسب رابط کاربری
  const documents = rows.map((row) => ({

    id: row.id,

    documentNumber: row.document_number,

    documentType: row.document_type,

    documentDate: row.document_date,

    status: row.status,


    sourcePartyType: row.source_party_type,

    sourcePartyName: row.source_party_name,

    sourceInvoiceNumber: row.source_invoice_number,

    reason: row.reason,

    notes: row.notes,


    itemCount: Number(row.item_count),


    createdAt: row.created_at,

    updatedAt: row.updated_at,

    postedAt: row.posted_at,

    cancelledAt: row.cancelled_at,


    createdBy: {

      id: row.created_by_user_id,

      username: row.created_by_username,

      displayName: row.created_by_display_name,

    },


    updatedByDisplayName: row.updated_by_display_name,

    postedByDisplayName: row.posted_by_display_name,

    cancelledByDisplayName: row.cancelled_by_display_name,

  }));


  // نتیجه نهایی همراه با اطلاعات صفحه‌بندی
  return {

    documents,

    totalCount: Number(countResult.total_count),

    limit,

    offset,

  };

}

// توابع قابل استفاده در سایر بخش‌های Electron
module.exports = {
  getInventoryEntryFormOptions,
  createInventoryEntryDraft,
  postInventoryDocument,
  getInventoryDocuments,
  getInventoryStockList,
};