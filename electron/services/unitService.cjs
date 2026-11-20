
const crypto = require('node:crypto');

const {
  assertPermission,
} = require('./authorizationService.cjs');


// کد واحدهایی که همراه برنامه ایجاد شده‌اند و حذف فیزیکی نمی‌شوند
const SYSTEM_UNIT_CODES = new Set([
  'PIECE',
  'PAIR',
  'DOZEN',
  'GRAM',
  'KG',
  'TON',
  'MILLILITER',
  'LITER',
  'MILLIMETER',
  'CENTIMETER',
  'METER',
  'CARTON',
  'BOX',
  'PACK',
  'BAG',
]);


// ابعاد مجاز برای واحدهای استاندارد
const STANDARD_DIMENSIONS = new Set([
  'count',
  'mass',
  'volume',
  'length',
]);


// یکسان‌سازی نام و نماد برای تشخیص موارد مشابه
function normalizeUnitText(value) {

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


// محاسبه بزرگ‌ترین مقسوم‌علیه مشترک دو عدد صحیح مثبت
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


// تبدیل ورودی به عدد صحیح مثبت و امن
function validatePositiveInteger(value, fieldLabel) {

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldLabel} باید عدد صحیح مثبت باشد.`
    );
  }

  return number;

}


// اعتبارسنجی اطلاعات یک واحد
function validateUnitInput(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات واحد اندازه‌گیری معتبر نیست.');
  }


  const name =
    typeof input.name === 'string'
      ? input.name.trim()
      : '';


  const symbol =
    typeof input.symbol === 'string'
      ? input.symbol.trim()
      : '';


  const unitKind = input.unitKind;

  const defaultDecimalPlaces = Number(
    input.defaultDecimalPlaces
  );


  if (!name || !symbol) {

    throw new Error(
      'نام و نماد واحد الزامی است.'
    );

  }


  if (name.length > 100) {

    throw new Error(
      'نام واحد نمی‌تواند بیشتر از ۱۰۰ نویسه باشد.'
    );

  }


  if (symbol.length > 30) {

    throw new Error(
      'نماد واحد نمی‌تواند بیشتر از ۳۰ نویسه باشد.'
    );

  }


  if (
    !Number.isInteger(defaultDecimalPlaces) ||
    defaultDecimalPlaces < 0 ||
    defaultDecimalPlaces > 6
  ) {

    throw new Error(
      'دقت اعشاری باید عدد صحیحی بین صفر تا شش باشد.'
    );

  }


  if (!['standard', 'package'].includes(unitKind)) {

    throw new Error(
      'نوع واحد اندازه‌گیری معتبر نیست.'
    );

  }


  // واحدهای بسته‌بندی ضریب مرجع عمومی ندارند
  if (unitKind === 'package') {

    return {

      name,

      symbol,

      unitKind,

      dimensionCode: null,

      referenceFactorNum: null,

      referenceFactorDen: null,

      defaultDecimalPlaces,

    };

  }


  // واحد استاندارد باید یک بُعد مشخص داشته باشد
  const dimensionCode = input.dimensionCode;


  if (!STANDARD_DIMENSIONS.has(dimensionCode)) {

    throw new Error(
      'بُعد واحد استاندارد معتبر نیست.'
    );

  }


  // دریافت صورت و مخرج ضریب مرجع
  const referenceFactorNum = validatePositiveInteger(
    input.referenceFactorNum,
    'صورت ضریب مرجع'
  );


  const referenceFactorDen = validatePositiveInteger(
    input.referenceFactorDen,
    'مخرج ضریب مرجع'
  );


  // ساده‌سازی کسر برای ذخیره‌سازی یکسان
  const divisor = greatestCommonDivisor(
    referenceFactorNum,
    referenceFactorDen
  );


  return {

    name,

    symbol,

    unitKind,

    dimensionCode,

    referenceFactorNum: referenceFactorNum / divisor,

    referenceFactorDen: referenceFactorDen / divisor,

    defaultDecimalPlaces,

  };

}


// دریافت تعداد کالاهای وابسته به یک واحد
function getUnitUsageCount(database, unitId) {

  const result = database.prepare(`

    SELECT COUNT(*) AS total

    FROM (

      /* واحدهایی که در تعریف واحدهای کالا استفاده شده‌اند */
      SELECT product_id

      FROM product_units

      WHERE unit_id = ?


      UNION


      /* واحد مبنای مستقیم کالا */
      SELECT id AS product_id

      FROM products

      WHERE base_unit_id = ?

    )

  `).get(
    unitId,
    unitId
  );


  return Number(result.total);

}


// تبدیل رکورد SQLite به ساختار قابل استفاده در React
function mapUnitRecord(unit) {

  if (!unit) return null;


  return {

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

    createdAt: unit.created_at,

    createdByUserId: unit.created_by_user_id,

    productCount: Number(unit.product_count || 0),

    isSystem: SYSTEM_UNIT_CODES.has(unit.code),

  };

}


// دریافت یک واحد با تعداد کالاهای وابسته
function selectUnitById(database, unitId) {

  const unit = database.prepare(`

    SELECT

      u.*,

      usage.product_count

    FROM units u

    LEFT JOIN (

      SELECT

        unit_id,

        COUNT(DISTINCT product_id) AS product_count

      FROM (

        SELECT
          unit_id,
          product_id

        FROM product_units


        UNION ALL


        SELECT
          base_unit_id AS unit_id,
          id AS product_id

        FROM products

      )

      GROUP BY unit_id

    ) usage

      ON usage.unit_id = u.id

    WHERE u.id = ?

  `).get(unitId);


  return mapUnitRecord(unit);

}


// ثبت سابقه عملیات واحد
function writeUnitAudit(
  database,
  actor,
  actionKey,
  unitId,
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
    'unit',
    unitId,

    JSON.stringify(details),

    createdAt

  );

}


// جلوگیری از تکرار نام یا نماد واحد
function assertUniqueUnit(
  database,
  unit,
  excludedId = null
) {

  const existingUnits = database.prepare(`

    SELECT
      id,
      name,
      symbol

    FROM units

  `).all();


  const duplicate = existingUnits.find((existing) => {

    if (existing.id === excludedId) {
      return false;
    }


    const sameName =
      normalizeUnitText(existing.name) ===
      normalizeUnitText(unit.name);


    const sameSymbol =
      normalizeUnitText(existing.symbol) ===
      normalizeUnitText(unit.symbol);


    return sameName || sameSymbol;

  });


  if (duplicate) {

    throw new Error(
      'نام یا نماد این واحد قبلاً ثبت شده است.'
    );

  }

}


// دریافت فهرست واحدها
function getUnits(database, actor) {

  // بررسی مجوز مشاهده واحدها
  assertPermission(
    database,
    actor,
    'units.view'
  );


  const units = database.prepare(`

    SELECT

      u.*,

      COALESCE(
        usage.product_count,
        0
      ) AS product_count

    FROM units u

    LEFT JOIN (

      SELECT

        unit_id,

        COUNT(DISTINCT product_id) AS product_count

      FROM (

        SELECT
          unit_id,
          product_id

        FROM product_units


        UNION ALL


        SELECT
          base_unit_id AS unit_id,
          id AS product_id

        FROM products

      )

      GROUP BY unit_id

    ) usage

      ON usage.unit_id = u.id


    ORDER BY

      u.unit_kind ASC,

      u.dimension_code ASC,

      u.name COLLATE NOCASE ASC

  `).all();


  return units.map(mapUnitRecord);

}


// ایجاد یک یا چند واحد
function createUnits(database, actor, inputs) {

  // بررسی مجوز مدیریت واحدها
  assertPermission(
    database,
    actor,
    'units.manage'
  );


  if (
    !Array.isArray(inputs) ||
    inputs.length === 0
  ) {

    throw new Error(
      'حداقل یک واحد باید ارسال شود.'
    );

  }


  if (inputs.length > 200) {

    throw new Error(
      'در هر عملیات حداکثر ۲۰۰ واحد قابل ثبت است.'
    );

  }


  // اعتبارسنجی تمام ورودی‌ها پیش از ثبت
  const validatedUnits = inputs.map(
    validateUnitInput
  );


  const createdAt = new Date().toISOString();

  const createdIds = [];


  database.exec('BEGIN IMMEDIATE');

  try {

    const insertUnit = database.prepare(`

      INSERT INTO units (

        id,

        code,

        name,

        symbol,

        unit_kind,

        dimension_code,

        reference_factor_num,

        reference_factor_den,

        default_decimal_places,

        is_active,

        created_at,

        created_by_user_id

      )

      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)

    `);


    for (const unit of validatedUnits) {

      // بررسی تکراری نبودن نام و نماد در کل پایگاه داده
      // رکوردهای قبلی همین تراکنش نیز در این بررسی دیده می‌شوند
      assertUniqueUnit(
        database,
        unit
      );


      const unitId = crypto.randomUUID();

      // کد داخلی واحد به‌صورت خودکار و یکتا تولید می‌شود
      const unitCode = `USR-${crypto.randomUUID()}`;


      insertUnit.run(

        unitId,

        unitCode,

        unit.name,

        unit.symbol,

        unit.unitKind,

        unit.dimensionCode,

        unit.referenceFactorNum,

        unit.referenceFactorDen,

        unit.defaultDecimalPlaces,

        createdAt,

        actor.id

      );


      // ثبت سابقه ایجاد واحد
      writeUnitAudit(
        database,
        actor,
        'units.created',
        unitId,
        {
          code: unitCode,
          name: unit.name,
          symbol: unit.symbol,
          unitKind: unit.unitKind,
          dimensionCode: unit.dimensionCode,
          referenceFactorNum: unit.referenceFactorNum,
          referenceFactorDen: unit.referenceFactorDen,
          defaultDecimalPlaces: unit.defaultDecimalPlaces,
        },
        createdAt
      );


      createdIds.push(unitId);

    }


    database.exec('COMMIT');


    return createdIds.map(
      (id) => selectUnitById(database, id)
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


// ایجاد یک واحد
function createUnit(database, actor, input) {

  return createUnits(
    database,
    actor,
    [input]
  )[0];

}


// ویرایش اطلاعات واحد
function updateUnit(
  database,
  actor,
  unitId,
  input
) {

  // بررسی مجوز مدیریت واحدها
  assertPermission(
    database,
    actor,
    'units.manage'
  );


  if (
    typeof unitId !== 'string' ||
    !unitId.trim()
  ) {

    throw new Error(
      'شناسه واحد معتبر نیست.'
    );

  }


  const validated = validateUnitInput(input);

  const updatedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    const existing = database.prepare(`

      SELECT *

      FROM units

      WHERE id = ?

    `).get(unitId);


    if (!existing) {

      throw new Error(
        'واحد موردنظر پیدا نشد.'
      );

    }


    // بررسی تعداد کالاهای وابسته
    const usageCount = getUnitUsageCount(
      database,
      unitId
    );


    const isSystemUnit = SYSTEM_UNIT_CODES.has(
      existing.code
    );



    // تبدیل مقادیر SQLite به ساختار قابل مقایسه
    const existingReferenceFactorNum =
      existing.reference_factor_num === null
        ? null
        : Number(existing.reference_factor_num);

    const existingReferenceFactorDen =
      existing.reference_factor_den === null
        ? null
        : Number(existing.reference_factor_den);


    // بررسی تغییر در ویژگی‌های تعیین‌کننده معنای واحد
    const structuralChange =

      existing.unit_kind !== validated.unitKind ||

      existing.dimension_code !== validated.dimensionCode ||

      existingReferenceFactorNum !== validated.referenceFactorNum ||

      existingReferenceFactorDen !== validated.referenceFactorDen;

    // ساختار واحدهای سیستمی قابل تغییر نیست
    if (isSystemUnit && structuralChange) {

      throw new Error(
        'نوع، بُعد و ضریب مرجع واحدهای استاندارد پیش‌فرض قابل تغییر نیست.'
      );

    }


    // ساختار واحد استفاده‌شده در کالاها قابل تغییر نیست
    if (usageCount > 0 && structuralChange) {

      throw new Error(
        'این واحد در کالاها استفاده شده است؛ نوع، بُعد و ضریب مرجع آن قابل تغییر نیست.'
      );

    }


    // جلوگیری از تکرار نام یا نماد
    assertUniqueUnit(
      database,
      validated,
      unitId
    );


    // به‌روزرسانی اطلاعات واحد
    database.prepare(`

      UPDATE units

      SET

        name = ?,

        symbol = ?,

        unit_kind = ?,

        dimension_code = ?,

        reference_factor_num = ?,

        reference_factor_den = ?,

        default_decimal_places = ?

      WHERE id = ?

    `).run(

      validated.name,

      validated.symbol,

      validated.unitKind,

      validated.dimensionCode,

      validated.referenceFactorNum,

      validated.referenceFactorDen,

      validated.defaultDecimalPlaces,

      unitId

    );


    // ثبت سابقه تغییرات
    writeUnitAudit(
      database,
      actor,
      'units.updated',
      unitId,
      {
        before: {
          name: existing.name,
          symbol: existing.symbol,
          unitKind: existing.unit_kind,
          dimensionCode: existing.dimension_code,
          referenceFactorNum: existing.reference_factor_num,
          referenceFactorDen: existing.reference_factor_den,
          defaultDecimalPlaces: existing.default_decimal_places,
        },

        after: validated,
      },
      updatedAt
    );


    database.exec('COMMIT');


    return selectUnitById(
      database,
      unitId
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


// فعال یا غیرفعال کردن واحد
function setUnitActive(
  database,
  actor,
  unitId,
  isActive
) {

  // بررسی مجوز مدیریت واحدها
  assertPermission(
    database,
    actor,
    'units.manage'
  );


  if (
    typeof unitId !== 'string' ||
    !unitId.trim()
  ) {

    throw new Error(
      'شناسه واحد معتبر نیست.'
    );

  }


  if (typeof isActive !== 'boolean') {

    throw new Error(
      'وضعیت واحد معتبر نیست.'
    );

  }


  const updatedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    const existing = database.prepare(`

      SELECT
        id,
        code,
        name,
        is_active

      FROM units

      WHERE id = ?

    `).get(unitId);


    if (!existing) {

      throw new Error(
        'واحد موردنظر پیدا نشد.'
      );

    }


    const previousStatus = Boolean(
      existing.is_active
    );


    // اگر وضعیت تغییری نکرده، نیازی به ثبت عملیات نیست
    if (previousStatus === isActive) {

      database.exec('COMMIT');

      return selectUnitById(
        database,
        unitId
      );

    }


    // واحد مورد استفاده محصولات نباید غیرفعال شود
    if (!isActive) {

      const usageCount = getUnitUsageCount(
        database,
        unitId
      );


      if (usageCount > 0) {

        throw new Error(
          'این واحد در یک یا چند کالا استفاده شده است و تا زمان حذف وابستگی‌ها قابل غیرفعال‌سازی نیست.'
        );

      }

    }


    database.prepare(`

      UPDATE units

      SET is_active = ?

      WHERE id = ?

    `).run(
      isActive ? 1 : 0,
      unitId
    );


    // ثبت سابقه تغییر وضعیت
    writeUnitAudit(
      database,
      actor,
      isActive
        ? 'units.reactivated'
        : 'units.deactivated',
      unitId,
      {
        code: existing.code,
        name: existing.name,
        previousStatus,
        newStatus: isActive,
      },
      updatedAt
    );


    database.exec('COMMIT');


    return selectUnitById(
      database,
      unitId
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


// حذف واحد سفارشی و بدون وابستگی
function deleteUnit(
  database,
  actor,
  unitId
) {

  // بررسی مجوز مدیریت واحدها
  assertPermission(
    database,
    actor,
    'units.manage'
  );


  if (
    typeof unitId !== 'string' ||
    !unitId.trim()
  ) {

    throw new Error(
      'شناسه واحد معتبر نیست.'
    );

  }


  const deletedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    const existing = database.prepare(`

      SELECT
        id,
        code,
        name,
        symbol,
        unit_kind

      FROM units

      WHERE id = ?

    `).get(unitId);


    if (!existing) {

      throw new Error(
        'واحد موردنظر پیدا نشد.'
      );

    }


    // واحدهای پیش‌فرض سیستم حذف فیزیکی نمی‌شوند
    if (SYSTEM_UNIT_CODES.has(existing.code)) {

      throw new Error(
        'واحدهای پیش‌فرض حساب‌یار حذف نمی‌شوند؛ در صورت نیاز آن‌ها را غیرفعال کن.'
      );

    }


    // جلوگیری از حذف واحدی که محصولی به آن وابسته است
    const usageCount = getUnitUsageCount(
      database,
      unitId
    );


    if (usageCount > 0) {

      throw new Error(
        'این واحد در کالاها استفاده شده است و امکان حذف آن وجود ندارد.'
      );

    }


    // ثبت سابقه حذف پیش از حذف رکورد
    writeUnitAudit(
      database,
      actor,
      'units.deleted',
      unitId,
      {
        code: existing.code,
        name: existing.name,
        symbol: existing.symbol,
        unitKind: existing.unit_kind,
      },
      deletedAt
    );


    database.prepare(`

      DELETE FROM units

      WHERE id = ?

    `).run(unitId);


    database.exec('COMMIT');


    return {
      success: true,
      id: unitId,
    };

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
  getUnits,
  createUnit,
  createUnits,
  updateUnit,
  setUnitActive,
  deleteUnit,
};
