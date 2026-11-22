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

      pu.id AS product_unit_id,
      pu.unit_id,
      pu.is_base_unit,
      pu.conversion_num,
      pu.conversion_den,
      pu.input_decimal_places,

      u.name AS unit_name,
      u.symbol AS unit_symbol

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
    const isBaseUnit = row.is_base_unit === 1;

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
      conversionNum: isBaseUnit
        ? 1
        : Number(row.conversion_num),

      conversionDen: isBaseUnit
        ? 1
        : Number(row.conversion_den),

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


// توابع قابل استفاده در سایر بخش‌های Electron
module.exports = {
  getInventoryEntryFormOptions,
};