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


module.exports = {
  getSalesFormOptions,
};