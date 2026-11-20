const crypto = require('node:crypto');

const {
  assertPermission,
} = require('./authorizationService.cjs');


// مقیاس ذخیره قیمت؛ هر واحد پولی به یک میلیون بخش تقسیم می‌شود
const PRICE_SCALE = 1_000_000n;


// یکسان‌سازی نام برای ذخیره و جست‌وجوی یکسان
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


// بررسی عدد صحیح مثبت و امن
function validatePositiveInteger(value, label) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} باید عدد صحیح مثبت باشد.`);
  }

  return number;
}


// بررسی تعداد ارقام اعشاری
function validateDecimalPlaces(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new Error(`${label} را مشخص کن.`);
  }

  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0 ||
    number > 6
  ) {
    throw new Error(`${label} باید عدد صحیحی بین صفر تا شش باشد.`);
  }

  return number;
}


// محاسبه بزرگ‌ترین مقسوم‌علیه مشترک
function greatestCommonDivisor(first, second) {
  let a = BigInt(first);
  let b = BigInt(second);

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return Number(a);
}


// تبدیل مبلغ اعشاری به عدد صحیح مقیاس‌شده
function parsePriceToScaled(value, label) {
  const text = String(value ?? '').trim();

  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text);

  if (!match) {
    throw new Error(
      `${label} باید عددی نامنفی با حداکثر شش رقم اعشار باشد.`
    );
  }

  const wholePart = BigInt(match[1]);

  const decimalPart = BigInt(
    (match[2] || '').padEnd(6, '0') || '0'
  );

  const scaled = (
    wholePart * PRICE_SCALE
  ) + decimalPart;

  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} از محدوده مجاز بیشتر است.`);
  }

  return Number(scaled);
}


// تبدیل قیمت مقیاس‌شده به رشته اعشاری قابل نمایش
function formatScaledPrice(value) {
  const scaled = BigInt(value);

  const wholePart = scaled / PRICE_SCALE;

  const decimalPart = String(
    scaled % PRICE_SCALE
  ).padStart(6, '0').replace(/0+$/, '');

  return decimalPart
    ? `${wholePart}.${decimalPart}`
    : String(wholePart);
}


// بررسی وجود دسته‌بندی و فعال بودن آن
function selectValidCategory(database, categoryId, existingProduct = null) {
  const category = database.prepare(`
    SELECT
      id,
      name,
      is_active
    FROM categories
    WHERE id = ?
  `).get(categoryId);

  if (!category) {
    throw new Error('دسته‌بندی انتخاب‌شده پیدا نشد.');
  }

  // دسته‌بندی غیرفعال فقط برای حفظ ارتباط قبلی پذیرفته می‌شود
  if (
    !category.is_active &&
    categoryId !== existingProduct?.category_id
  ) {
    throw new Error(
      'برای کالای جدید یا تغییر دسته‌بندی، باید یک دسته‌بندی فعال انتخاب کنی.'
    );
  }

  return category;
}


// دریافت واحد معتبر و فعال از SQLite
function selectActiveUnit(database, unitId) {
  const unit = database.prepare(`
    SELECT
      id,
      code,
      name,
      symbol,
      unit_kind,
      dimension_code,
      reference_factor_num,
      reference_factor_den,
      default_decimal_places,
      is_active
    FROM units
    WHERE id = ?
  `).get(unitId);

  if (!unit) {
    throw new Error('یکی از واحدهای انتخاب‌شده وجود ندارد.');
  }

  if (!unit.is_active) {
    throw new Error(`واحد «${unit.name}» غیرفعال است.`);
  }

  return unit;
}


// اعتبارسنجی کامل مشخصات محصول و واحدهای وابسته
function validateProductInput(
  database,
  input,
  existingProduct = null
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات محصول معتبر نیست.');
  }

  const name =
    typeof input.name === 'string'
      ? input.name.trim()
      : '';

  const categoryId = input.categoryId;
  const baseUnitId = input.baseUnitId;

  if (!name) {
    throw new Error('نام محصول را وارد کن.');
  }

  if (name.length > 150) {
    throw new Error('نام محصول نمی‌تواند بیشتر از ۱۵۰ نویسه باشد.');
  }

  if (
    typeof categoryId !== 'string' ||
    !categoryId.trim()
  ) {
    throw new Error('دسته‌بندی محصول را انتخاب کن.');
  }

  if (
    typeof baseUnitId !== 'string' ||
    !baseUnitId.trim()
  ) {
    throw new Error('واحد پایه محصول را انتخاب کن.');
  }

  const category = selectValidCategory(
    database,
    categoryId,
    existingProduct
  );

  const baseUnit = selectActiveUnit(
    database,
    baseUnitId
  );

  // واحد پایه محصول حتماً باید استاندارد باشد
  if (baseUnit.unit_kind !== 'standard') {
    throw new Error(
      'واحد پایه محصول باید از نوع استاندارد باشد.'
    );
  }

  const baseQuantityDecimalPlaces =
    validateDecimalPlaces(
      input.baseQuantityDecimalPlaces,
      'دقت اعشاری مقدار پایه'
    );

  const baseInputDecimalPlaces =
    input.baseInputDecimalPlaces === undefined
      ? Number(baseUnit.default_decimal_places)
      : validateDecimalPlaces(
        input.baseInputDecimalPlaces,
        'دقت ورود مقدار با واحد پایه'
      );

  // واحدهای فرعی محصول؛ واحد پایه جداگانه ثبت می‌شود
  const rawUnitOptions = input.unitOptions ?? [];

  if (!Array.isArray(rawUnitOptions)) {
    throw new Error('فهرست واحدهای فرعی معتبر نیست.');
  }

  if (rawUnitOptions.length > 100) {
    throw new Error('برای هر محصول حداکثر ۱۰۰ واحد فرعی قابل تعریف است.');
  }

  const selectedUnitIds = new Set([baseUnitId]);

  const unitOptions = rawUnitOptions.map((option) => {
    if (
      !option ||
      typeof option !== 'object' ||
      Array.isArray(option)
    ) {
      throw new Error('اطلاعات یکی از واحدهای فرعی معتبر نیست.');
    }

    const unitId = option.unitId;

    if (
      typeof unitId !== 'string' ||
      !unitId.trim()
    ) {
      throw new Error('واحد فرعی معتبری انتخاب نشده است.');
    }

    if (selectedUnitIds.has(unitId)) {
      throw new Error(
        'یک واحد بیش از یک بار برای این محصول انتخاب شده است.'
      );
    }

    selectedUnitIds.add(unitId);

    const unit = selectActiveUnit(database, unitId);

    const inputDecimalPlaces =
      option.inputDecimalPlaces === undefined
        ? Number(unit.default_decimal_places)
        : validateDecimalPlaces(
          option.inputDecimalPlaces,
          `دقت ورود واحد «${unit.name}»`
        );

    let conversionNum = null;
    let conversionDen = null;

    if (unit.unit_kind === 'standard') {
      // واحد استاندارد فرعی باید هم‌بُعد با واحد پایه باشد
      if (
        unit.dimension_code !== baseUnit.dimension_code
      ) {
        throw new Error(
          `واحد استاندارد «${unit.name}» با بُعد واحد پایه هم‌خوانی ندارد.`
        );
      }

      // نسبت واحد استاندارد از جدول units محاسبه می‌شود
      if (
        option.conversionNum !== null &&
        option.conversionNum !== undefined
      ) {
        throw new Error(
          `برای واحد استاندارد «${unit.name}» نباید ضریب تبدیل اختصاصی وارد شود.`
        );
      }

      if (
        option.conversionDen !== null &&
        option.conversionDen !== undefined
      ) {
        throw new Error(
          `برای واحد استاندارد «${unit.name}» نباید مخرج تبدیل اختصاصی وارد شود.`
        );
      }
    } else {
      // نسبت واحد بسته‌بندی به واحد پایه اختصاصی همین محصول است
      conversionNum = validatePositiveInteger(
        option.conversionNum,
        `صورت ضریب تبدیل «${unit.name}»`
      );

      conversionDen = validatePositiveInteger(
        option.conversionDen,
        `مخرج ضریب تبدیل «${unit.name}»`
      );

      // ساده‌سازی نسبت تبدیل
      const divisor = greatestCommonDivisor(
        conversionNum,
        conversionDen
      );

      conversionNum /= divisor;
      conversionDen /= divisor;
    }

    return {
      unitId,
      unitKind: unit.unit_kind,
      dimensionCode: unit.dimension_code,
      conversionNum,
      conversionDen,
      inputDecimalPlaces,
    };
  });

  // قیمت‌ها بر اساس واحد، ارز و نوع قیمت ثبت می‌شوند
  if (!Array.isArray(input.prices)) {
    throw new Error('فهرست قیمت‌های محصول معتبر نیست.');
  }

  const validPriceUnitIds = new Set(selectedUnitIds);
  const priceKeys = new Set();

  const prices = input.prices.map((price) => {
    if (
      !price ||
      typeof price !== 'object' ||
      Array.isArray(price)
    ) {
      throw new Error('اطلاعات یکی از قیمت‌ها معتبر نیست.');
    }

    const unitId = price.unitId;

    if (!validPriceUnitIds.has(unitId)) {
      throw new Error(
        'برای واحدی که به محصول اختصاص نیافته، نمی‌توان قیمت ثبت کرد.'
      );
    }

    const currencyCode =
      typeof price.currencyCode === 'string'
        ? price.currencyCode.trim().toUpperCase()
        : '';

    if (!currencyCode) {
      throw new Error('ارز قیمت را انتخاب کن.');
    }

    const currency = database.prepare(`
      SELECT code
      FROM currencies
      WHERE code = ?
        AND is_active = 1
    `).get(currencyCode);

    if (!currency) {
      throw new Error(`ارز «${currencyCode}» فعال یا معتبر نیست.`);
    }

    const priceType = price.priceType;

    if (!['purchase', 'sale'].includes(priceType)) {
      throw new Error('نوع قیمت باید خرید یا فروش باشد.');
    }

    const key = `${unitId}|${currencyCode}|${priceType}`;

    if (priceKeys.has(key)) {
      throw new Error(
        'برای یک واحد، ارز و نوع قیمت نمی‌توان دو قیمت جاری ثبت کرد.'
      );
    }

    priceKeys.add(key);

    return {
      unitId,
      currencyCode,
      priceType,
      unitPriceScaled: parsePriceToScaled(
        price.unitPrice,
        priceType === 'purchase' ? 'قیمت خرید' : 'قیمت فروش'
      ),
    };
  });

  return {
    name,
    normalizedName: normalizeProductName(name),
    categoryId,
    baseUnitId,
    baseQuantityDecimalPlaces,
    baseInputDecimalPlaces,
    unitOptions,
    prices,
    category,
    baseUnit,
  };
}


// ساخت تعاریف واحدهای این محصول؛ واحد پایه نیز در این فهرست قرار می‌گیرد
function buildProductUnitDefinitions(validated) {
  return [
    {
      unitId: validated.baseUnitId,
      isBaseUnit: true,
      conversionNum: 1,
      conversionDen: 1,
      inputDecimalPlaces: validated.baseInputDecimalPlaces,
    },

    ...validated.unitOptions.map((option) => ({
      unitId: option.unitId,
      isBaseUnit: false,
      conversionNum: option.conversionNum,
      conversionDen: option.conversionDen,
      inputDecimalPlaces: option.inputDecimalPlaces,
    })),
  ];
}


// ثبت یک ردیف جدید از واحدهای محصول
function insertProductUnit(
  database,
  actor,
  productId,
  definition,
  createdAt
) {
  const productUnitId = crypto.randomUUID();

  database.prepare(`
    INSERT INTO product_units (
      id,
      product_id,
      unit_id,
      is_base_unit,
      conversion_num,
      conversion_den,
      input_decimal_places,
      is_active,
      created_at,
      created_by_user_id,
      deactivated_at,
      deactivated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, NULL)
  `).run(
    productUnitId,
    productId,
    definition.unitId,
    definition.isBaseUnit ? 1 : 0,
    definition.conversionNum,
    definition.conversionDen,
    definition.inputDecimalPlaces,
    createdAt,
    actor.id
  );

  return productUnitId;
}


// ثبت قیمت جدید و ایجاد سابقه قیمت
function insertProductPrice(
  database,
  actor,
  productId,
  productUnitId,
  price,
  createdAt
) {
  database.prepare(`
    INSERT INTO product_prices (
      id,
      product_id,
      product_unit_id,
      currency_code,
      price_type,
      unit_price_scaled,
      is_current,
      created_at,
      created_by_user_id,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)
  `).run(
    crypto.randomUUID(),
    productId,
    productUnitId,
    price.currencyCode,
    price.priceType,
    price.unitPriceScaled,
    createdAt,
    actor.id
  );
}


// ثبت سابقه عملیات محصول
function writeProductAudit(
  database,
  actor,
  actionKey,
  productId,
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
    'product',
    productId,
    JSON.stringify(details),
    createdAt
  );
}


// تولید کد خودکار و یکتای محصول
function getNextProductCode(database, nextNumber) {
  let number = nextNumber;

  while (true) {
    const code = `PR-${String(number).padStart(6, '0')}`;

    const exists = database.prepare(`
      SELECT 1 AS found
      FROM products
      WHERE code = ?
    `).get(code);

    if (!exists) {
      return {
        code,
        nextNumber: number + 1,
      };
    }

    number += 1;
  }
}


// پیدا کردن شماره بعدی در کدهای PR
function getInitialProductNumber(database) {
  const codes = database.prepare(`
    SELECT code
    FROM products
    WHERE code LIKE 'PR-%'
  `).all();

  let maximum = 0;

  for (const row of codes) {
    const match = /^PR-(\d+)$/.exec(row.code);

    if (match) {
      maximum = Math.max(maximum, Number(match[1]));
    }
  }

  return maximum + 1;
}


// دریافت اطلاعات کامل یک یا چند محصول از SQLite
function selectProducts(database, productId = null) {
  const productRows = productId
    ? database.prepare(`
        SELECT
          p.id,
          p.code,
          p.name,
          p.normalized_name,
          p.category_id,
          p.base_unit_id,
          p.base_quantity_decimal_places,
          p.is_active,
          p.created_at,
          p.created_by_user_id,
          p.updated_at,
          p.updated_by_user_id,
          c.name AS category_name,
          bu.name AS base_unit_name,
          bu.symbol AS base_unit_symbol
        FROM products p
        JOIN categories c
          ON c.id = p.category_id
        JOIN units bu
          ON bu.id = p.base_unit_id
        WHERE p.id = ?
      `).all(productId)
    : database.prepare(`
        SELECT
          p.id,
          p.code,
          p.name,
          p.normalized_name,
          p.category_id,
          p.base_unit_id,
          p.base_quantity_decimal_places,
          p.is_active,
          p.created_at,
          p.created_by_user_id,
          p.updated_at,
          p.updated_by_user_id,
          c.name AS category_name,
          bu.name AS base_unit_name,
          bu.symbol AS base_unit_symbol
        FROM products p
        JOIN categories c
          ON c.id = p.category_id
        JOIN units bu
          ON bu.id = p.base_unit_id
        ORDER BY p.created_at DESC, p.code ASC
      `).all();

  if (productRows.length === 0) {
    return [];
  }

  const productIds = productRows.map((product) => product.id);

  const placeholders = productIds.map(() => '?').join(', ');

  // دریافت واحدهای فعال هر محصول
  const unitRows = database.prepare(`
    SELECT
      pu.id AS product_unit_id,
      pu.product_id,
      pu.unit_id,
      pu.is_base_unit,
      pu.conversion_num,
      pu.conversion_den,
      pu.input_decimal_places,
      pu.created_at,
      u.code AS unit_code,
      u.name AS unit_name,
      u.symbol AS unit_symbol,
      u.unit_kind,
      u.dimension_code,
      u.reference_factor_num,
      u.reference_factor_den
    FROM product_units pu
    JOIN units u
      ON u.id = pu.unit_id
    WHERE pu.is_active = 1
      AND pu.product_id IN (${placeholders})
    ORDER BY pu.is_base_unit DESC, u.name COLLATE NOCASE ASC
  `).all(...productIds);

  // دریافت قیمت‌های جاری
  const priceRows = database.prepare(`
    SELECT
      pp.id,
      pp.product_id,
      pp.product_unit_id,
      pu.unit_id,
      pp.currency_code,
      pp.price_type,
      pp.unit_price_scaled,
      pp.created_at
    FROM product_prices pp
    JOIN product_units pu
      ON pu.id = pp.product_unit_id
    WHERE pp.is_current = 1
      AND pu.is_active = 1
      AND pp.product_id IN (${placeholders})
    ORDER BY pp.created_at DESC
  `).all(...productIds);

  const productMap = new Map();

  for (const row of productRows) {
    productMap.set(row.id, {
      id: row.id,
      code: row.code,
      name: row.name,
      normalizedName: row.normalized_name,

      categoryId: row.category_id,
      categoryName: row.category_name,

      baseUnitId: row.base_unit_id,
      baseUnitName: row.base_unit_name,
      baseUnitSymbol: row.base_unit_symbol,

      baseQuantityDecimalPlaces: Number(
        row.base_quantity_decimal_places
      ),

      isActive: Boolean(row.is_active),

      createdAt: row.created_at,
      createdByUserId: row.created_by_user_id,

      updatedAt: row.updated_at,
      updatedByUserId: row.updated_by_user_id,

      units: [],
      prices: [],
    });
  }

  for (const row of unitRows) {
    const product = productMap.get(row.product_id);

    if (!product) continue;

    product.units.push({
      productUnitId: row.product_unit_id,

      unitId: row.unit_id,
      unitCode: row.unit_code,
      unitName: row.unit_name,
      unitSymbol: row.unit_symbol,

      unitKind: row.unit_kind,
      dimensionCode: row.dimension_code,

      isBaseUnit: Boolean(row.is_base_unit),

      conversionNum:
        row.conversion_num === null
          ? null
          : Number(row.conversion_num),

      conversionDen:
        row.conversion_den === null
          ? null
          : Number(row.conversion_den),

      referenceFactorNum:
        row.reference_factor_num === null
          ? null
          : Number(row.reference_factor_num),

      referenceFactorDen:
        row.reference_factor_den === null
          ? null
          : Number(row.reference_factor_den),

      inputDecimalPlaces: Number(
        row.input_decimal_places
      ),

      createdAt: row.created_at,
    });
  }

  for (const row of priceRows) {
    const product = productMap.get(row.product_id);

    if (!product) continue;

    const scaled = Number(row.unit_price_scaled);

    product.prices.push({
      id: row.id,
      productUnitId: row.product_unit_id,
      unitId: row.unit_id,
      currencyCode: row.currency_code,
      priceType: row.price_type,
      unitPriceScaled: scaled,
      unitPrice: formatScaledPrice(scaled),
      createdAt: row.created_at,
    });
  }

  return productRows.map(
    (row) => productMap.get(row.id)
  );
}


// دریافت فهرست محصولات
function getProducts(database, actor) {
  assertPermission(
    database,
    actor,
    'products.view'
  );

  return selectProducts(database);
}


// دریافت اطلاعات لازم برای فرم ثبت و ویرایش محصول
function getProductFormOptions(database, actor) {
  assertPermission(
    database,
    actor,
    'products.view'
  );

  const categories = database.prepare(`
    SELECT
      id,
      name,
      is_active
    FROM categories
    WHERE is_active = 1
    ORDER BY name COLLATE NOCASE ASC
  `).all().map((category) => ({
    id: category.id,
    name: category.name,
    isActive: Boolean(category.is_active),
  }));

  const units = database.prepare(`
    SELECT
      id,
      code,
      name,
      symbol,
      unit_kind,
      dimension_code,
      reference_factor_num,
      reference_factor_den,
      default_decimal_places,
      is_active
    FROM units
    WHERE is_active = 1
    ORDER BY unit_kind ASC, dimension_code ASC, name COLLATE NOCASE ASC
  `).all().map((unit) => ({
    id: unit.id,
    code: unit.code,
    name: unit.name,
    symbol: unit.symbol || '',
    unitKind: unit.unit_kind,
    dimensionCode: unit.dimension_code,

    referenceFactorNum:
      unit.reference_factor_num === null
        ? null
        : Number(unit.reference_factor_num),

    referenceFactorDen:
      unit.reference_factor_den === null
        ? null
        : Number(unit.reference_factor_den),

    defaultDecimalPlaces: Number(
      unit.default_decimal_places
    ),

    isActive: Boolean(unit.is_active),
  }));

  const currencies = database.prepare(`
    SELECT
      code,
      name,
      symbol,
      minor_unit_digits
    FROM currencies
    WHERE is_active = 1
    ORDER BY code ASC
  `).all().map((currency) => ({
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol || '',
    minorUnitDigits: Number(currency.minor_unit_digits),
  }));

  return {
    categories,
    units,
    currencies,
  };
}


// ثبت یک یا چند محصول در یک تراکنش
function createProducts(database, actor, inputs) {
  assertPermission(
    database,
    actor,
    'products.create'
  );

  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('حداقل یک محصول باید ارسال شود.');
  }

  if (inputs.length > 200) {
    throw new Error('در هر عملیات حداکثر ۲۰۰ محصول قابل ثبت است.');
  }

  const validatedProducts = inputs.map((input) =>
    validateProductInput(database, input)
  );
  const createdAt = new Date().toISOString();
  const createdIds = [];

  database.exec('BEGIN IMMEDIATE');

  try {
    // محاسبه شماره بعدی داخل تراکنش برای جلوگیری از تداخل کدها
    let nextNumber = getInitialProductNumber(database);

    const insertProduct = database.prepare(`
      INSERT INTO products (
        id,
        code,
        name,
        normalized_name,
        category_id,
        base_unit_id,
        base_quantity_decimal_places,
        is_active,
        created_at,
        created_by_user_id,
        updated_at,
        updated_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, NULL)
    `);

    for (const validated of validatedProducts) {
      const productId = crypto.randomUUID();

      // تولید کد داخل تراکنش؛ از تکرار کد در ثبت گروهی جلوگیری می‌شود
      const generated = getNextProductCode(
        database,
        nextNumber
      );

      nextNumber = generated.nextNumber;

      insertProduct.run(
        productId,
        generated.code,
        validated.name,
        validated.normalizedName,
        validated.categoryId,
        validated.baseUnitId,
        validated.baseQuantityDecimalPlaces,
        createdAt,
        actor.id
      );

      // ایجاد ردیف واحد پایه و واحدهای فرعی
      const unitDefinitions = buildProductUnitDefinitions(
        validated
      );

      const productUnitIds = new Map();

      for (const definition of unitDefinitions) {
        const productUnitId = insertProductUnit(
          database,
          actor,
          productId,
          definition,
          createdAt
        );

        productUnitIds.set(
          definition.unitId,
          productUnitId
        );
      }

      // ثبت قیمت‌ها به واحد، ارز و نوع قیمت مربوط
      for (const price of validated.prices) {
        const productUnitId = productUnitIds.get(
          price.unitId
        );

        insertProductPrice(
          database,
          actor,
          productId,
          productUnitId,
          price,
          createdAt
        );
      }

      // ثبت سابقه ایجاد محصول
      writeProductAudit(
        database,
        actor,
        'products.created',
        productId,
        {
          code: generated.code,
          name: validated.name,
          categoryId: validated.categoryId,
          baseUnitId: validated.baseUnitId,
          baseQuantityDecimalPlaces:
            validated.baseQuantityDecimalPlaces,
          unitCount: unitDefinitions.length,
          priceCount: validated.prices.length,
        },
        createdAt
      );

      createdIds.push(productId);
    }

    database.exec('COMMIT');

    return createdIds.flatMap((id) =>
      selectProducts(database, id)
    );
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;
  }
}


// ثبت یک محصول
function createProduct(database, actor, input) {
  return createProducts(
    database,
    actor,
    [input]
  )[0];
}


// مقایسه تعریف فعلی و تعریف درخواستی یک واحد محصول
function isSameProductUnitDefinition(existing, target) {
  const existingNum =
    existing.conversion_num === null
      ? null
      : Number(existing.conversion_num);

  const existingDen =
    existing.conversion_den === null
      ? null
      : Number(existing.conversion_den);

  return (
    Boolean(existing.is_base_unit) === target.isBaseUnit &&
    existingNum === target.conversionNum &&
    existingDen === target.conversionDen &&
    Number(existing.input_decimal_places) === target.inputDecimalPlaces
  );
}


// غیرفعال‌سازی نسخه قبلی تعریف واحد محصول
function deactivateProductUnit(
  database,
  actor,
  productUnitId,
  deactivatedAt
) {
  database.prepare(`
    UPDATE product_units
    SET
      is_active = 0,
      deactivated_at = ?,
      deactivated_by_user_id = ?
    WHERE id = ?
      AND is_active = 1
  `).run(
    deactivatedAt,
    actor.id,
    productUnitId
  );
}


// همگام‌سازی قیمت‌های جاری با قیمت‌های جدید محصول
function syncProductPrices(
  database,
  actor,
  productId,
  prices,
  updatedAt
) {
  const activeUnitRows = database.prepare(`
    SELECT
      id,
      unit_id
    FROM product_units
    WHERE product_id = ?
      AND is_active = 1
  `).all(productId);

  const activeProductUnitByUnitId = new Map(
    activeUnitRows.map((row) => [
      row.unit_id,
      row.id,
    ])
  );

  const desiredByKey = new Map();

  for (const price of prices) {
    desiredByKey.set(
      `${price.unitId}|${price.currencyCode}|${price.priceType}`,
      price
    );
  }

  const currentPrices = database.prepare(`
    SELECT
      pp.id,
      pp.product_unit_id,
      pu.unit_id,
      pp.currency_code,
      pp.price_type,
      pp.unit_price_scaled
    FROM product_prices pp
    JOIN product_units pu
      ON pu.id = pp.product_unit_id
    WHERE pp.product_id = ?
      AND pp.is_current = 1
  `).all(productId);

  const currentByKey = new Map();

  for (const row of currentPrices) {
    const key = `${row.unit_id}|${row.currency_code}|${row.price_type}`;
    currentByKey.set(key, row);
  }

  // قیمت‌هایی که حذف شده یا تغییر کرده‌اند، تاریخی می‌شوند
  for (const [key, current] of currentByKey) {
    const desired = desiredByKey.get(key);
    const activeProductUnitId =
      activeProductUnitByUnitId.get(current.unit_id);

    const sameDefinition =
      desired &&
      activeProductUnitId === current.product_unit_id &&
      Number(current.unit_price_scaled) === desired.unitPriceScaled;

    if (!sameDefinition) {
      database.prepare(`
        UPDATE product_prices
        SET is_current = 0
        WHERE id = ?
          AND is_current = 1
      `).run(current.id);
    }
  }

  // ثبت قیمت جدید فقط در صورت نیاز
  for (const [key, desired] of desiredByKey) {
    const productUnitId =
      activeProductUnitByUnitId.get(desired.unitId);

    if (!productUnitId) {
      throw new Error(
        'برای یکی از قیمت‌ها، واحد فعال محصول پیدا نشد.'
      );
    }

    const current = currentByKey.get(key);

    const samePrice =
      current &&
      current.product_unit_id === productUnitId &&
      Number(current.unit_price_scaled) === desired.unitPriceScaled;

    if (samePrice) {
      continue;
    }

    insertProductPrice(
      database,
      actor,
      productId,
      productUnitId,
      desired,
      updatedAt
    );
  }
}


// ویرایش اطلاعات محصول و نسخه‌بندی واحدهای وابسته
function updateProduct(
  database,
  actor,
  productId,
  input
) {
  assertPermission(
    database,
    actor,
    'products.update'
  );

  if (
    typeof productId !== 'string' ||
    !productId.trim()
  ) {
    throw new Error('شناسه محصول معتبر نیست.');
  }

  const existingProduct = database.prepare(`
    SELECT *
    FROM products
    WHERE id = ?
  `).get(productId);

  if (!existingProduct) {
    throw new Error('محصول موردنظر پیدا نشد.');
  }

  if (!existingProduct.is_active) {
    throw new Error(
      'برای ویرایش واحدها و قیمت‌های محصول ابتدا آن را فعال کن.'
    );
  }

  const validated = validateProductInput(
    database,
    input,
    existingProduct
  );

  const updatedAt = new Date().toISOString();

  const targetDefinitions = buildProductUnitDefinitions(
    validated
  );

  const existingUnits = database.prepare(`
    SELECT
      id,
      unit_id,
      is_base_unit,
      conversion_num,
      conversion_den,
      input_decimal_places
    FROM product_units
    WHERE product_id = ?
      AND is_active = 1
  `).all(productId);

  const existingByUnitId = new Map(
    existingUnits.map((unit) => [
      unit.unit_id,
      unit,
    ])
  );

  const targetByUnitId = new Map(
    targetDefinitions.map((definition) => [
      definition.unitId,
      definition,
    ])
  );

  const rowsToDeactivate = [];

  for (const existing of existingUnits) {
    const target = targetByUnitId.get(existing.unit_id);

    if (
      !target ||
      !isSameProductUnitDefinition(existing, target)
    ) {
      rowsToDeactivate.push(existing);
    }
  }

  const rowsToInsert = targetDefinitions.filter((target) => {
    const existing = existingByUnitId.get(target.unitId);

    return (
      !existing ||
      !isSameProductUnitDefinition(existing, target)
    );
  });

  const currentBaseRow = existingUnits.find(
    (unit) => Boolean(unit.is_base_unit)
  );

  const baseRowWillBeReplaced =
    currentBaseRow &&
    rowsToDeactivate.some(
      (unit) => unit.id === currentBaseRow.id
    );

  let temporaryBaseUnitId = null;

  // اگر نسخه واحد پایه عوض می‌شود ولی خود واحد پایه همان است،
  // برای رعایت محدودیت SQLite موقتاً از واحد هم‌بُعد دیگری استفاده می‌کنیم.
  if (
    baseRowWillBeReplaced &&
    existingProduct.base_unit_id === validated.baseUnitId
  ) {
    const temporaryUnit = database.prepare(`
      SELECT id
      FROM units
      WHERE unit_kind = 'standard'
        AND dimension_code = ?
        AND is_active = 1
        AND id <> ?
      ORDER BY code ASC
      LIMIT 1
    `).get(
      validated.baseUnit.dimension_code,
      validated.baseUnitId
    );

    if (!temporaryUnit) {
      throw new Error(
        'برای نسخه‌بندی واحد پایه، واحد استاندارد هم‌بُعد دیگری در دسترس نیست.'
      );
    }

    temporaryBaseUnitId = temporaryUnit.id;
  }

  database.exec('BEGIN IMMEDIATE');

  try {
    // به‌روزرسانی اطلاعات محصول و تعیین واحد پایه موقت یا نهایی
    database.prepare(`
      UPDATE products
      SET
        name = ?,
        normalized_name = ?,
        category_id = ?,
        base_unit_id = ?,
        base_quantity_decimal_places = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE id = ?
    `).run(
      validated.name,
      validated.normalizedName,
      validated.categoryId,
      temporaryBaseUnitId || validated.baseUnitId,
      validated.baseQuantityDecimalPlaces,
      updatedAt,
      actor.id,
      productId
    );

    // غیرفعال‌سازی نسخه‌های قدیمی؛ قیمت‌های آن‌ها نیز توسط Trigger تاریخی می‌شوند
    for (const oldUnit of rowsToDeactivate) {
      deactivateProductUnit(
        database,
        actor,
        oldUnit.id,
        updatedAt
      );
    }

    // بازگرداندن واحد پایه نهایی پس از نسخه‌بندی
    if (temporaryBaseUnitId) {
      database.prepare(`
        UPDATE products
        SET base_unit_id = ?
        WHERE id = ?
      `).run(
        validated.baseUnitId,
        productId
      );
    }

    // ایجاد نسخه‌های جدید واحدهای حذف‌شده یا تغییرکرده
    for (const definition of rowsToInsert) {
      insertProductUnit(
        database,
        actor,
        productId,
        definition,
        updatedAt
      );
    }

    // حفظ تاریخچه قیمت و ایجاد قیمت جاری در صورت تغییر
    syncProductPrices(
      database,
      actor,
      productId,
      validated.prices,
      updatedAt
    );

    // ثبت سابقه ویرایش محصول
    writeProductAudit(
      database,
      actor,
      'products.updated',
      productId,
      {
        before: {
          name: existingProduct.name,
          categoryId: existingProduct.category_id,
          baseUnitId: existingProduct.base_unit_id,
          baseQuantityDecimalPlaces:
            existingProduct.base_quantity_decimal_places,
        },

        after: {
          name: validated.name,
          categoryId: validated.categoryId,
          baseUnitId: validated.baseUnitId,
          baseQuantityDecimalPlaces:
            validated.baseQuantityDecimalPlaces,
        },

        deactivatedProductUnitIds: rowsToDeactivate.map(
          (unit) => unit.id
        ),

        newProductUnitCount: rowsToInsert.length,

        submittedPriceCount: validated.prices.length,
      },
      updatedAt
    );

    database.exec('COMMIT');

    return selectProducts(database, productId)[0] || null;
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;
  }
}


// فعال یا غیرفعال کردن محصول
function setProductActive(
  database,
  actor,
  productId,
  isActive
) {
  assertPermission(
    database,
    actor,
    'products.deactivate'
  );

  if (
    typeof productId !== 'string' ||
    !productId.trim()
  ) {
    throw new Error('شناسه محصول معتبر نیست.');
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('وضعیت محصول معتبر نیست.');
  }

  const existing = database.prepare(`
    SELECT
      id,
      code,
      name,
      is_active
    FROM products
    WHERE id = ?
  `).get(productId);

  if (!existing) {
    throw new Error('محصول موردنظر پیدا نشد.');
  }

  const previousStatus = Boolean(existing.is_active);

  if (previousStatus === isActive) {
    return selectProducts(database, productId)[0] || null;
  }

  const updatedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {
    database.prepare(`
      UPDATE products
      SET
        is_active = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE id = ?
    `).run(
      isActive ? 1 : 0,
      updatedAt,
      actor.id,
      productId
    );

    writeProductAudit(
      database,
      actor,
      isActive
        ? 'products.reactivated'
        : 'products.deactivated',
      productId,
      {
        code: existing.code,
        name: existing.name,
        previousStatus,
        newStatus: isActive,
      },
      updatedAt
    );

    database.exec('COMMIT');

    return selectProducts(database, productId)[0] || null;
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;
  }
}


module.exports = {
  getProducts,
  getProductFormOptions,
  createProduct,
  createProducts,
  updateProduct,
  setProductActive,
};