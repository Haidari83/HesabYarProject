const crypto = require('node:crypto');

const {
  assertPermission,
} = require('./authorizationService.cjs');


// مقیاس ذخیره مقدار و قیمت در پایگاه داده
const VALUE_SCALE = 1_000_000n;


// محاسبه بزرگ‌ترین مقسوم‌علیه مشترک
function greatestCommonDivisor(first, second) {

  let a = BigInt(first);
  let b = BigInt(second);

  while (b !== 0n) {

    const remainder = a % b;

    a = b;
    b = remainder;

  }

  return a;

}


// بررسی عدد صحیح مثبت و امن
function validatePositiveInteger(value, label) {

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    throw new Error(`${label} معتبر نیست.`);
  }

  return number;

}


// محاسبه نسبت تبدیل واحد انتخاب‌شده به واحد پایه کالا
function resolveSalesUnitConversion(row) {

  // واحد پایه همیشه نسبت تبدیل یک به یک دارد.
  if (Number(row.is_base_unit) === 1) {

    return {
      conversionNum: 1,
      conversionDen: 1,
    };

  }


  // واحد بسته‌بندی از ضریب اختصاصی همان کالا استفاده می‌کند.
  if (row.unit_kind === 'package') {

    return {
      conversionNum: validatePositiveInteger(
        row.conversion_num,
        `صورت ضریب تبدیل واحد «${row.unit_name}»`
      ),

      conversionDen: validatePositiveInteger(
        row.conversion_den,
        `مخرج ضریب تبدیل واحد «${row.unit_name}»`
      ),
    };

  }


  // واحد استاندارد باید با واحد پایه هم‌بُعد باشد.
  if (row.unit_kind === 'standard') {

    if (
      row.dimension_code !==
      row.base_unit_dimension_code
    ) {
      throw new Error(
        `واحد «${row.unit_name}» با واحد پایه کالا هم‌بُعد نیست.`
      );
    }


    const unitNum = validatePositiveInteger(
      row.reference_factor_num,
      `ضریب واحد «${row.unit_name}»`
    );

    const unitDen = validatePositiveInteger(
      row.reference_factor_den,
      `مخرج واحد «${row.unit_name}»`
    );

    const baseNum = validatePositiveInteger(
      row.base_reference_factor_num,
      'ضریب واحد پایه'
    );

    const baseDen = validatePositiveInteger(
      row.base_reference_factor_den,
      'مخرج واحد پایه'
    );


    // نسبت تبدیل واحد انتخابی به واحد پایه
    const numerator =
      BigInt(unitNum) * BigInt(baseDen);

    const denominator =
      BigInt(unitDen) * BigInt(baseNum);


    // ساده‌سازی نسبت
    const divisor = greatestCommonDivisor(
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


// دریافت اطلاعات لازم برای فرم ثبت فروش
function getSalesFormOptions(database, actor) {

  // بررسی مجوز ثبت فروش
  assertPermission(
    database,
    actor,
    'sales.create'
  );


  // دریافت ارز مبنای حساب‌یار
  const baseCurrencySetting = database.prepare(`
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ?
  `).get('base_currency_code');


  if (!baseCurrencySetting?.setting_value) {
    throw new Error(
      'ارز مبنای حساب‌یار در تنظیمات مشخص نشده است.'
    );
  }


  const baseCurrencyCode =
    baseCurrencySetting.setting_value.toUpperCase();


  // دریافت ارزهای فعال
  const currencies = database.prepare(`
    SELECT
      code,
      name,
      symbol,
      minor_unit_digits
    FROM currencies
    WHERE is_active = 1
    ORDER BY
      CASE WHEN code = ? THEN 0 ELSE 1 END,
      code ASC
  `).all(baseCurrencyCode).map((currency) => ({

    code: currency.code,
    name: currency.name,
    symbol: currency.symbol || '',

    minorUnitDigits: Number(
      currency.minor_unit_digits
    ),

  }));


  // اطمینان از فعال بودن ارز مبنای سیستم
  if (
    !currencies.some(
      (currency) => currency.code === baseCurrencyCode
    )
  ) {
    throw new Error(
      'ارز مبنای حساب‌یار در فهرست ارزهای فعال وجود ندارد.'
    );
  }


  // محاسبه موجودی فعلی از گردش‌های ثبت‌نهایی‌شده
  const stockRows = database.prepare(`
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
  `).all();


  const stockByProduct = new Map();

  for (const row of stockRows) {

    const stockScaled = Number(
      row.stock_scaled ?? 0
    );

    if (!Number.isSafeInteger(stockScaled)) {
      throw new Error(
        'مقدار موجودی یکی از کالاها خارج از محدوده مجاز است.'
      );
    }

    stockByProduct.set(
      row.product_id,
      stockScaled
    );

  }


  // دریافت کالاهای فعال و واحدهای فعال اختصاصی آن‌ها
  const productRows = database.prepare(`
    SELECT

      product.id AS product_id,
      product.code AS product_code,
      product.name AS product_name,
      product.base_quantity_decimal_places,

      base_unit.id AS base_unit_id,
      base_unit.name AS base_unit_name,
      base_unit.symbol AS base_unit_symbol,

      base_unit.dimension_code
        AS base_unit_dimension_code,

      base_unit.reference_factor_num
        AS base_reference_factor_num,

      base_unit.reference_factor_den
        AS base_reference_factor_den,

      product_unit.id AS product_unit_id,
      product_unit.unit_id,
      product_unit.is_base_unit,
      product_unit.conversion_num,
      product_unit.conversion_den,
      product_unit.input_decimal_places,

      unit.name AS unit_name,
      unit.symbol AS unit_symbol,
      unit.unit_kind,
      unit.dimension_code,
      unit.reference_factor_num,
      unit.reference_factor_den

    FROM products AS product

    JOIN units AS base_unit
      ON base_unit.id = product.base_unit_id
      AND base_unit.is_active = 1

    JOIN product_units AS product_unit
      ON product_unit.product_id = product.id
      AND product_unit.is_active = 1

    JOIN units AS unit
      ON unit.id = product_unit.unit_id
      AND unit.is_active = 1

    WHERE product.is_active = 1

    ORDER BY
      product.name COLLATE NOCASE ASC,
      product_unit.is_base_unit DESC,
      unit.name COLLATE NOCASE ASC

  `).all();


  // دریافت قیمت‌های فروش جاری کالاها
  const priceRows = database.prepare(`
    SELECT

      price.product_id,
      price.product_unit_id,
      price.currency_code,
      price.unit_price_scaled,

      currency.name AS currency_name,
      currency.symbol AS currency_symbol,
      currency.minor_unit_digits

    FROM product_prices AS price

    JOIN product_units AS product_unit
      ON product_unit.id = price.product_unit_id
      AND product_unit.is_active = 1

    JOIN currencies AS currency
      ON currency.code = price.currency_code
      AND currency.is_active = 1

    WHERE price.price_type = 'sale'
      AND price.is_current = 1

    ORDER BY
      price.currency_code ASC
  `).all();


  // گروه‌بندی قیمت‌ها بر اساس واحد اختصاصی کالا
  const pricesByProductUnit = new Map();

  for (const row of priceRows) {

    const unitPriceScaled = Number(
      row.unit_price_scaled
    );

    if (!Number.isSafeInteger(unitPriceScaled)) {
      throw new Error(
        'یکی از قیمت‌های فروش خارج از محدوده مجاز است.'
      );
    }


    if (!pricesByProductUnit.has(row.product_unit_id)) {
      pricesByProductUnit.set(
        row.product_unit_id,
        []
      );
    }


    pricesByProductUnit.get(
      row.product_unit_id
    ).push({

      currencyCode: row.currency_code,
      currencyName: row.currency_name,
      currencySymbol: row.currency_symbol || '',

      minorUnitDigits: Number(
        row.minor_unit_digits
      ),

      unitPriceScaled,

      unitPrice:
        unitPriceScaled / Number(VALUE_SCALE),

    });

  }


  // گروه‌بندی اطلاعات واحدها بر اساس کالا
  const productsById = new Map();


  for (const row of productRows) {

    // ایجاد اطلاعات اولیه کالا
    if (!productsById.has(row.product_id)) {

      const availableStockScaled =
        stockByProduct.get(row.product_id) ?? 0;


      productsById.set(row.product_id, {

        id: row.product_id,
        code: row.product_code,
        name: row.product_name,

        baseQuantityDecimalPlaces: Number(
          row.base_quantity_decimal_places
        ),

        baseUnit: {

          id: row.base_unit_id,
          name: row.base_unit_name,
          symbol: row.base_unit_symbol || '',

        },

        availableStockScaled,

        availableStock:
          availableStockScaled / Number(VALUE_SCALE),

        // کالا فقط در صورت داشتن موجودی مثبت قابل فروش است.
        canSell: availableStockScaled > 0,

        productUnits: [],

      });

    }


    // محاسبه نسبت تبدیل واحد انتخاب‌شده
    const conversion = resolveSalesUnitConversion(row);


    // افزودن واحد و قیمت‌های فروش آن
    productsById.get(row.product_id).productUnits.push({

      productUnitId: row.product_unit_id,
      unitId: row.unit_id,

      name: row.unit_name,
      symbol: row.unit_symbol || '',

      isBaseUnit:
        Number(row.is_base_unit) === 1,

      conversionNum: conversion.conversionNum,
      conversionDen: conversion.conversionDen,

      inputDecimalPlaces: Number(
        row.input_decimal_places
      ),

      salePrices:
        pricesByProductUnit.get(row.product_unit_id) || [],

    });

  }


  // تحویل اطلاعات مرتب‌شده به رابط کاربری
  return {

    baseCurrencyCode,

    currencies,

    products: Array.from(
      productsById.values()
    ),

  };

}


// تبدیل ارقام فارسی و عربی و یکسان‌سازی جداکننده اعشار
function normalizeSalesNumber(value) {

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
function parseSalesDecimal(
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


  const text = normalizeSalesNumber(value).trim();

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);

  if (!match) {
    throw new Error(
      `${label} باید یک عدد معتبر و نامنفی باشد.`
    );
  }


  const fraction = match[2] || '';

  // صفرهای انتهایی در دقت اعشار مؤثر نیستند
  const effectiveFraction = fraction.replace(/0+$/, '');

  if (
    effectiveFraction.length > maximumDecimalPlaces ||
    effectiveFraction.length > 6
  ) {
    throw new Error(
      `${label} حداکثر می‌تواند ${maximumDecimalPlaces} رقم اعشار داشته باشد.`
    );
  }


  // تبدیل مقدار به مقیاس صحیح با استفاده از BigInt
  const decimalPart = BigInt(
    fraction.padEnd(6, '0').slice(0, 6) || '0'
  );

  const scaledValue =
    BigInt(match[1]) * VALUE_SCALE + decimalPart;


  if (!allowZero && scaledValue <= 0n) {
    throw new Error(
      `${label} باید بزرگ‌تر از صفر باشد.`
    );
  }

  if (allowZero && scaledValue < 0n) {
    throw new Error(
      `${label} نمی‌تواند منفی باشد.`
    );
  }


  if (
    scaledValue > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      `${label} از محدوده مجاز بیشتر است.`
    );
  }


  return scaledValue;

}


// اعتبارسنجی تاریخ فاکتور
function validateSalesDate(value) {

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error('تاریخ فاکتور معتبر نیست.');
  }


  const parsedDate = new Date(
    `${value}T00:00:00.000Z`
  );


  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('تاریخ واردشده وجود ندارد.');
  }


  return value;

}


// اعتبارسنجی متن‌های اختیاری فاکتور
function getOptionalSalesText(
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


// دریافت نرخ تبدیل ارز تا تاریخ فاکتور
function getSalesExchangeRate(
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


  // جست‌وجوی نرخ مستقیم
  const directRate = findRate.get(
    fromCurrencyCode,
    toCurrencyCode,
    documentDate
  );


  // جست‌وجوی نرخ معکوس
  const inverseRate = findRate.get(
    toCurrencyCode,
    fromCurrencyCode,
    documentDate
  );


  if (!directRate && !inverseRate) {
    throw new Error(
      `نرخ تبدیل ${fromCurrencyCode} به ${toCurrencyCode} برای تاریخ فاکتور ثبت نشده است.`
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


  // معکوس‌کردن نرخ
  return {
    rateNum: Number(inverseRate.rate_den),
    rateDen: Number(inverseRate.rate_num),
  };

}


// تولید شماره یکتای فاکتور فروش
function getNextSalesDocumentNumber(
  database,
  documentDate
) {

  const datePart = documentDate.replace(/-/g, '');

  const prefix = `SL-${datePart}-`;


  const documents = database.prepare(`
    SELECT document_number
    FROM inventory_documents
    WHERE document_number LIKE ?
  `).all(`${prefix}%`);


  let maximumNumber = 0;


  for (const document of documents) {

    const match = new RegExp(
      `^SL-${datePart}-(\\d+)$`
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


// ثبت سابقه عملیات فروش
function writeSalesAudit(
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
    'sales_document',
    documentId,
    JSON.stringify(details),
    createdAt
  );

}


// ایجاد پیش‌نویس فاکتور فروش
function createSalesDraft(
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
    throw new Error('اطلاعات فاکتور فروش معتبر نیست.');
  }


  // بررسی مجوز ثبت فروش
  assertPermission(
    database,
    actor,
    'sales.create'
  );


  // اعتبارسنجی تاریخ
  const documentDate = validateSalesDate(
    input.documentDate
  );


  // اعتبارسنجی فهرست کالاهای فاکتور
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    throw new Error(
      'برای ثبت فاکتور حداقل یک کالا باید اضافه شود.'
    );
  }


  if (input.items.length > 200) {
    throw new Error(
      'در هر فاکتور حداکثر ۲۰۰ ردیف کالا قابل ثبت است.'
    );
  }


  // دریافت نام مشتری
  // پشتیبانی از هر دو نام ورودی برای سازگاری رابط فروش
  const customerName = getOptionalSalesText(
    input.customerName ?? input.sourcePartyName,
    'نام مشتری',
    150
  );


  // شماره مرجع یا فاکتور خارجی
  const sourceInvoiceNumber = getOptionalSalesText(
    input.sourceInvoiceNumber,
    'شماره مرجع فاکتور',
    100
  );


  // توضیحات فاکتور
  const notes = getOptionalSalesText(
    input.notes,
    'یادداشت فاکتور',
    2000
  );


  const createdAt = new Date().toISOString();


  // آغاز تراکنش؛ تمام ردیف‌ها با هم ذخیره یا همگی لغو می‌شوند
  database.exec('BEGIN IMMEDIATE');


  try {

    // دریافت ارز مبنای سیستم
    const baseCurrencySetting = database.prepare(`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = ?
    `).get('base_currency_code');


    if (!baseCurrencySetting?.setting_value) {
      throw new Error(
        'ارز مبنای حساب‌یار در تنظیمات مشخص نشده است.'
      );
    }


    const baseCurrencyCode =
      baseCurrencySetting.setting_value.toUpperCase();


    // بررسی فعال بودن ارز مبنا
    const baseCurrency = database.prepare(`
      SELECT code
      FROM currencies
      WHERE code = ?
        AND is_active = 1
    `).get(baseCurrencyCode);


    if (!baseCurrency) {
      throw new Error(
        'ارز مبنای حساب‌یار فعال نیست.'
      );
    }


    // دریافت کالا و واحد اختصاصی انتخاب‌شده از پایگاه داده
    const findProductUnit = database.prepare(`
      SELECT

        product.id AS product_id,
        product.code AS product_code,
        product.name AS product_name,

        product.base_quantity_decimal_places,
        product.base_unit_id,

        base_unit.dimension_code
          AS base_unit_dimension_code,

        base_unit.reference_factor_num
          AS base_reference_factor_num,

        base_unit.reference_factor_den
          AS base_reference_factor_den,

        product_unit.id AS product_unit_id,
        product_unit.unit_id,
        product_unit.is_base_unit,
        product_unit.conversion_num,
        product_unit.conversion_den,
        product_unit.input_decimal_places,

        unit.name AS unit_name,
        unit.symbol AS unit_symbol,
        unit.unit_kind,
        unit.dimension_code,
        unit.reference_factor_num,
        unit.reference_factor_den

      FROM products AS product

      JOIN units AS base_unit
        ON base_unit.id = product.base_unit_id
        AND base_unit.is_active = 1

      JOIN product_units AS product_unit
        ON product_unit.product_id = product.id

      JOIN units AS unit
        ON unit.id = product_unit.unit_id

      WHERE product.id = ?
        AND product_unit.id = ?
        AND product.is_active = 1
        AND product_unit.is_active = 1
        AND unit.is_active = 1

      LIMIT 1
    `);


    // دریافت ارز فعال
    const findCurrency = database.prepare(`
      SELECT code
      FROM currencies
      WHERE code = ?
        AND is_active = 1
    `);


    // دریافت موجودی واقعی هر کالا از گردش‌های ثبت‌نهایی‌شده
    const findProductStock = database.prepare(`
      SELECT

        COALESCE(
          SUM(
            CASE

              WHEN movement.movement_direction = 'in'
                THEN movement.base_quantity_scaled

              WHEN movement.movement_direction = 'out'
                THEN -movement.base_quantity_scaled

              ELSE 0

            END
          ),
          0
        ) AS stock_scaled

      FROM inventory_movements AS movement

      JOIN inventory_documents AS document
        ON document.id = movement.document_id

      WHERE movement.product_id = ?
        AND document.status = 'posted'
    `);


    // جلوگیری از دریافت مکرر نرخ یک ارز
    const exchangeRateCache = new Map();


    // اعتبارسنجی تمام ردیف‌ها
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


        // دریافت کالا و واحد از SQLite
        const productUnit = findProductUnit.get(
          item.productId,
          item.productUnitId
        );


        if (!productUnit) {
          throw new Error(
            `کالا یا واحد انتخاب‌شده در ردیف ${index + 1} معتبر یا فعال نیست.`
          );
        }


        // اعتبارسنجی دقت اعشار واحد انتخاب‌شده
        const inputDecimalPlaces = Number(
          productUnit.input_decimal_places
        );

        const baseDecimalPlaces = Number(
          productUnit.base_quantity_decimal_places
        );


        // دریافت تعداد
        const quantityScaled = parseSalesDecimal(
          item.quantity,
          `مقدار ردیف ${index + 1}`,
          inputDecimalPlaces
        );


        // دریافت قیمت فروش
        const unitPriceScaled = parseSalesDecimal(
          item.unitPrice,
          `قیمت فروش ردیف ${index + 1}`,
          6,
          true
        );


        // محاسبه نسبت تبدیل واحد انتخابی به واحد پایه
        const conversion = resolveSalesUnitConversion(
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
            `نسبت تبدیل واحد ردیف ${index + 1} معتبر نیست.`
          );
        }


        // تبدیل تعداد به واحد پایه با دقت صحیح
        const baseQuantityNumerator =
          quantityScaled * BigInt(conversionNum);

        const conversionDenominator =
          BigInt(conversionDen);


        // جلوگیری از گردکردن پنهانی مقدار موجودی
        if (
          baseQuantityNumerator % conversionDenominator !== 0n
        ) {
          throw new Error(
            `مقدار ردیف ${index + 1} با نسبت تبدیل این واحد، به‌صورت دقیق قابل ذخیره نیست.`
          );
        }


        const baseQuantityScaled =
          baseQuantityNumerator / conversionDenominator;


        // بررسی دقت مجاز واحد پایه
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


        // بررسی فعال بودن ارز ردیف
        if (!findCurrency.get(currencyCode)) {
          throw new Error(
            `ارز ردیف ${index + 1} فعال یا معتبر نیست.`
          );
        }


        // دریافت نرخ ارز تا تاریخ فاکتور
        if (!exchangeRateCache.has(currencyCode)) {

          exchangeRateCache.set(
            currencyCode,
            getSalesExchangeRate(
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
            `نرخ تبدیل ارز ردیف ${index + 1} معتبر نیست.`
          );
        }


        // یادداشت اختصاصی ردیف
        const itemNotes = getOptionalSalesText(
          item.notes,
          `یادداشت ردیف ${index + 1}`,
          500
        );


        // دریافت موجودی فعلی کالا
        const stockRow = findProductStock.get(
          productUnit.product_id
        );


        const stockScaled = Number(
          stockRow.stock_scaled ?? 0
        );


        if (!Number.isSafeInteger(stockScaled)) {
          throw new Error(
            `موجودی کالای «${productUnit.product_name}» خارج از محدوده مجاز است.`
          );
        }


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


    // جمع مقدار موردنیاز هر کالا برای جلوگیری از عبور
    // مجموع ردیف‌های تکراری از موجودی قابل فروش
    const requiredStockByProduct = new Map();


    for (const item of validatedItems) {

      const currentRequired =
        requiredStockByProduct.get(item.productId) || {
          quantityScaled: 0n,
          productName: item.productName,
        };


      currentRequired.quantityScaled +=
        BigInt(item.baseQuantityScaled);


      requiredStockByProduct.set(
        item.productId,
        currentRequired
      );

    }


    // کنترل مجموع مقدار موردنیاز با موجودی واقعی
    for (const [productId, required] of requiredStockByProduct) {

      const stockRow = findProductStock.get(productId);

      const availableStockScaled = Number(
        stockRow.stock_scaled ?? 0
      );


      if (!Number.isSafeInteger(availableStockScaled)) {
        throw new Error(
          `موجودی کالای «${required.productName}» معتبر نیست.`
        );
      }


      if (
        required.quantityScaled >
        BigInt(availableStockScaled)
      ) {
        throw new Error(
          `موجودی کافی برای کالای «${required.productName}» وجود ندارد. ` +
          `موجودی فعلی: ${availableStockScaled / 1_000_000} واحد پایه.`
        );
      }

    }


    // تولید شناسه و شماره یکتای فاکتور فروش
    const documentId = crypto.randomUUID();

    const documentNumber = getNextSalesDocumentNumber(
      database,
      documentDate
    );


    // ثبت اطلاعات اصلی فاکتور در وضعیت پیش‌نویس
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
        ?, ?, 'sale', ?, 'draft',
        'customer', ?, ?, NULL, ?,
        ?, ?
      )
    `).run(

      documentId,
      documentNumber,
      documentDate,

      customerName,
      sourceInvoiceNumber,
      notes,

      createdAt,
      actor.id

    );


    // آماده‌سازی دستور ذخیره ردیف‌های فاکتور
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
    writeSalesAudit(
      database,
      actor,
      'sales.document.draft_created',
      documentId,
      {
        documentNumber,
        documentDate,
        itemCount: validatedItems.length,
        customerName,
      },
      createdAt
    );


    // نهایی‌کردن تراکنش
    database.exec('COMMIT');


    return {

      id: documentId,

      documentNumber,

      documentType: 'sale',

      documentDate,

      customerName,

      status: 'draft',

      itemCount: validatedItems.length,

      createdAt,

    };

  } catch (error) {

    // در صورت شکست هر عملیات، کل تراکنش لغو می‌شود
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;

  }

}


module.exports = {
  getSalesFormOptions,
  createSalesDraft,
};