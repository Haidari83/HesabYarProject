
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

// آخرین نسخه ساختار پایگاه داده
const SCHEMA_VERSION = 4;

// نسخه ساختار اولیه‌ای که جدول‌های کاربران را ایجاد می‌کند
const INITIAL_SCHEMA_VERSION = 3;

// ایجاد جداول اولیه سیستم کاربران
function createInitialSchema(database) {

  database.exec('BEGIN IMMEDIATE');

  try {

    database.exec(`

      /* تنظیمات عمومی برنامه */
      CREATE TABLE IF NOT EXISTS app_settings (

        setting_key TEXT PRIMARY KEY,

        setting_value TEXT NOT NULL,

        updated_at TEXT NOT NULL,

        updated_by_user_id TEXT,

        FOREIGN KEY (updated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* حساب‌های کاربران */
      CREATE TABLE IF NOT EXISTS users (

        id TEXT PRIMARY KEY,

        username TEXT NOT NULL COLLATE NOCASE UNIQUE,

        display_name TEXT NOT NULL,

        /* تصویر پروفایل کاربر */
        profile_image_data BLOB,

        profile_image_mime TEXT,

        password_hash TEXT NOT NULL,

        password_salt TEXT NOT NULL,

        /* اطلاعات امنیتی PIN */
        pin_verifier TEXT,

        pin_failed_attempts INTEGER NOT NULL DEFAULT 0
          CHECK (pin_failed_attempts >= 0),

        pin_locked_until TEXT,

        pin_changed_at TEXT,

        role TEXT NOT NULL
          CHECK (role IN ('admin', 'user')),

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        must_change_password INTEGER NOT NULL DEFAULT 0
          CHECK (must_change_password IN (0, 1)),

        failed_login_attempts INTEGER NOT NULL DEFAULT 0
          CHECK (failed_login_attempts >= 0),

        locked_until TEXT,

        last_login_at TEXT,

        password_changed_at TEXT,

        recovery_code_hash TEXT,

        recovery_code_salt TEXT,

        recovery_code_used_at TEXT,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT,

        updated_at TEXT,

        updated_by_user_id TEXT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (updated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* دسترسی‌های اختصاصی کاربران عادی */
      CREATE TABLE IF NOT EXISTS user_permissions (

        user_id TEXT NOT NULL,

        permission_key TEXT NOT NULL,

        granted_at TEXT NOT NULL,

        granted_by_user_id TEXT,

        PRIMARY KEY (user_id, permission_key),

        FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (granted_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* سابقه عملیات کاربران */
      CREATE TABLE IF NOT EXISTS audit_logs (

        id TEXT PRIMARY KEY,

        actor_user_id TEXT,

        actor_username TEXT NOT NULL,

        actor_display_name TEXT NOT NULL,

        action_key TEXT NOT NULL,

        entity_type TEXT NOT NULL,

        entity_id TEXT,

        details_json TEXT,

        created_at TEXT NOT NULL,

        FOREIGN KEY (actor_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* بهینه‌سازی جست‌وجوی کاربران */
      CREATE INDEX IF NOT EXISTS idx_users_active
      ON users(is_active);


      /* بهینه‌سازی بررسی دسترسی‌ها */
      CREATE INDEX IF NOT EXISTS idx_user_permissions_user
      ON user_permissions(user_id);


      /* بهینه‌سازی مشاهده سوابق */
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created
      ON audit_logs(created_at DESC);


      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
      ON audit_logs(actor_user_id, created_at DESC);


      /* جلوگیری از ویرایش سوابق ثبت‌شده */
      CREATE TRIGGER IF NOT EXISTS prevent_audit_update

      BEFORE UPDATE ON audit_logs

      BEGIN

        SELECT RAISE(
          ABORT,
          'Audit records cannot be updated.'
        );

      END;


      /* جلوگیری از حذف سوابق ثبت‌شده */
      CREATE TRIGGER IF NOT EXISTS prevent_audit_delete

      BEFORE DELETE ON audit_logs

      BEGIN

        SELECT RAISE(
          ABORT,
          'Audit records cannot be deleted.'
        );

      END;

    `);


    // ثبت نسخه اولیه ساختار پایگاه داده
    // مهاجرت نسخه چهارم در مرحله بعد اجرا می‌شود
    database.exec(`PRAGMA user_version = ${INITIAL_SCHEMA_VERSION}`);

    database.exec('COMMIT');

  } catch (error) {

    // در صورت شکست ایجاد جداول، تغییرات برگشت داده شوند
    try {
      database.exec('ROLLBACK');
    } catch {
      // ممکن است تراکنش قبلاً بسته شده باشد
    }

    throw error;

  }

}


/* =========================================
   مهاجرت ساختار پایگاه داده از نسخه ۳ به ۴
========================================= */

function migrateToVersion4(database) {

  // زمان اجرای مهاجرت
  const now = new Date().toISOString();

  // آغاز تراکنش؛ تمام تغییرات باید با هم ثبت شوند
  database.exec('BEGIN IMMEDIATE');

  try {

    database.exec(`

      /* =====================================
         جدول ارزها
      ===================================== */

      CREATE TABLE IF NOT EXISTS currencies (

        code TEXT PRIMARY KEY COLLATE NOCASE
          CHECK (
            length(code) = 3
            AND code = upper(code)
          ),

        name TEXT NOT NULL
          CHECK (length(trim(name)) > 0),

        symbol TEXT,

        minor_unit_digits INTEGER NOT NULL
          CHECK (minor_unit_digits BETWEEN 0 AND 6),

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        created_at TEXT NOT NULL

      );


      /* =====================================
         جدول تاریخچه نرخ ارز
      ===================================== */

      CREATE TABLE IF NOT EXISTS exchange_rates (

        id TEXT PRIMARY KEY,

        from_currency_code TEXT NOT NULL,

        to_currency_code TEXT NOT NULL,

        rate_num INTEGER NOT NULL
          CHECK (rate_num > 0),

        rate_den INTEGER NOT NULL
          CHECK (rate_den > 0),

        effective_at TEXT NOT NULL,

        source TEXT,

        note TEXT,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        CHECK (
          upper(from_currency_code) <> upper(to_currency_code)
        ),

        UNIQUE (
          from_currency_code,
          to_currency_code,
          effective_at
        ),

        FOREIGN KEY (from_currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (to_currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         جدول واحدهای اندازه‌گیری
      ===================================== */

      CREATE TABLE IF NOT EXISTS units (

        id TEXT PRIMARY KEY,

        code TEXT NOT NULL UNIQUE COLLATE NOCASE,

        name TEXT NOT NULL
          CHECK (length(trim(name)) > 0),

        symbol TEXT,

        unit_kind TEXT NOT NULL
          CHECK (
            unit_kind IN ('standard', 'package')
          ),

        dimension_code TEXT,

        reference_factor_num INTEGER,

        reference_factor_den INTEGER,

        default_decimal_places INTEGER NOT NULL DEFAULT 0
          CHECK (
            default_decimal_places BETWEEN 0 AND 6
          ),

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        created_at TEXT NOT NULL,

        created_by_user_id TEXT,

        CHECK (

          (
            unit_kind = 'standard'

            AND dimension_code IS NOT NULL

            AND dimension_code IN (
              'count',
              'mass',
              'volume',
              'length'
            )

            AND reference_factor_num IS NOT NULL
            AND reference_factor_num > 0

            AND reference_factor_den IS NOT NULL
            AND reference_factor_den > 0
          )

          OR

          (
            unit_kind = 'package'

            AND dimension_code IS NULL

            AND reference_factor_num IS NULL
            AND reference_factor_den IS NULL
          )

        ),

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         جدول دسته‌بندی محصولات
      ===================================== */

      CREATE TABLE IF NOT EXISTS categories (

        id TEXT PRIMARY KEY,

        name TEXT NOT NULL
          CHECK (length(trim(name)) > 0),

        normalized_name TEXT NOT NULL
          CHECK (length(trim(normalized_name)) > 0),

        description TEXT,

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        created_at TEXT NOT NULL,

        created_by_user_id TEXT,

        updated_at TEXT,

        updated_by_user_id TEXT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (updated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         شاخص‌های بهینه‌سازی جست‌وجو
      ===================================== */

      CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup

      ON exchange_rates (
        from_currency_code,
        to_currency_code,
        effective_at DESC
      );


      CREATE INDEX IF NOT EXISTS idx_units_active

      ON units(is_active);


      /* جلوگیری از تکرار نام دسته‌بندی‌های فعال */
      CREATE UNIQUE INDEX IF NOT EXISTS
      ux_categories_active_name

      ON categories(normalized_name)

      WHERE is_active = 1;

    `);


    /* =====================================
       ثبت ارزهای اولیه حساب‌یار
    ===================================== */

    const insertCurrency = database.prepare(`

      INSERT OR IGNORE INTO currencies (

        code,
        name,
        symbol,
        minor_unit_digits,
        is_active,
        created_at

      )

      VALUES (?, ?, ?, ?, 1, ?)

    `);

    // ثبت افغانی به‌عنوان ارز مبنا
    insertCurrency.run(
      'AFN',
      'افغانی',
      '؋',
      2,
      now
    );

    // ثبت دلار به‌عنوان ارز دوم
    insertCurrency.run(
      'USD',
      'دلار آمریکا',
      '$',
      2,
      now
    );


    /* =====================================
       تعریف واحدهای اولیه
    ===================================== */

    const initialUnits = [

      // واحدهای شمارشی

      {
        code: 'PIECE',
        name: 'عدد',
        symbol: 'عدد',
        unitKind: 'standard',
        dimension: 'count',
        factorNum: 1,
        factorDen: 1,
        decimalPlaces: 0,
      },

      {
        code: 'PAIR',
        name: 'جفت',
        symbol: 'جفت',
        unitKind: 'standard',
        dimension: 'count',
        factorNum: 2,
        factorDen: 1,
        decimalPlaces: 0,
      },

      {
        code: 'DOZEN',
        name: 'دوجین',
        symbol: 'دوجین',
        unitKind: 'standard',
        dimension: 'count',
        factorNum: 12,
        factorDen: 1,
        decimalPlaces: 0,
      },


      // واحدهای وزن

      {
        code: 'GRAM',
        name: 'گرم',
        symbol: 'g',
        unitKind: 'standard',
        dimension: 'mass',
        factorNum: 1,
        factorDen: 1,
        decimalPlaces: 0,
      },

      {
        code: 'KG',
        name: 'کیلوگرم',
        symbol: 'kg',
        unitKind: 'standard',
        dimension: 'mass',
        factorNum: 1000,
        factorDen: 1,
        decimalPlaces: 3,
      },

      {
        code: 'TON',
        name: 'تن',
        symbol: 't',
        unitKind: 'standard',
        dimension: 'mass',
        factorNum: 1000000,
        factorDen: 1,
        decimalPlaces: 3,
      },


      // واحدهای حجم

      {
        code: 'MILLILITER',
        name: 'میلی‌لیتر',
        symbol: 'ml',
        unitKind: 'standard',
        dimension: 'volume',
        factorNum: 1,
        factorDen: 1,
        decimalPlaces: 0,
      },

      {
        code: 'LITER',
        name: 'لیتر',
        symbol: 'L',
        unitKind: 'standard',
        dimension: 'volume',
        factorNum: 1000,
        factorDen: 1,
        decimalPlaces: 3,
      },


      // واحدهای طول

      {
        code: 'MILLIMETER',
        name: 'میلی‌متر',
        symbol: 'mm',
        unitKind: 'standard',
        dimension: 'length',
        factorNum: 1,
        factorDen: 1,
        decimalPlaces: 0,
      },

      {
        code: 'CENTIMETER',
        name: 'سانتی‌متر',
        symbol: 'cm',
        unitKind: 'standard',
        dimension: 'length',
        factorNum: 10,
        factorDen: 1,
        decimalPlaces: 1,
      },

      {
        code: 'METER',
        name: 'متر',
        symbol: 'm',
        unitKind: 'standard',
        dimension: 'length',
        factorNum: 1000,
        factorDen: 1,
        decimalPlaces: 2,
      },


      // واحدهای بسته‌بندی عمومی
      // ضریب تبدیل آن‌ها در product_units تعیین می‌شود

      {
        code: 'CARTON',
        name: 'کارتن',
        symbol: 'کارتن',
        unitKind: 'package',
        dimension: null,
        factorNum: null,
        factorDen: null,
        decimalPlaces: 0,
      },

      {
        code: 'BOX',
        name: 'جعبه',
        symbol: 'جعبه',
        unitKind: 'package',
        dimension: null,
        factorNum: null,
        factorDen: null,
        decimalPlaces: 0,
      },

      {
        code: 'PACK',
        name: 'بسته',
        symbol: 'بسته',
        unitKind: 'package',
        dimension: null,
        factorNum: null,
        factorDen: null,
        decimalPlaces: 0,
      },

      {
        code: 'BAG',
        name: 'کیسه',
        symbol: 'کیسه',
        unitKind: 'package',
        dimension: null,
        factorNum: null,
        factorDen: null,
        decimalPlaces: 0,
      },

    ];


    // آماده‌سازی دستور ثبت واحدها
    const insertUnit = database.prepare(`

      INSERT OR IGNORE INTO units (

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
        created_at

      )

      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)

    `);


    // ثبت واحدهای اولیه با شناسه یکتا
    for (const unit of initialUnits) {

      insertUnit.run(

        randomUUID(),

        unit.code,

        unit.name,

        unit.symbol,

        unit.unitKind,

        unit.dimension,

        unit.factorNum,

        unit.factorDen,

        unit.decimalPlaces,

        now

      );

    }


    /* =====================================
       ثبت تنظیمات ارز حساب‌یار
    ===================================== */

    const insertSetting = database.prepare(`

      INSERT OR IGNORE INTO app_settings (

        setting_key,
        setting_value,
        updated_at

      )

      VALUES (?, ?, ?)

    `);


    // تعیین ارز اصلی ارزش‌گذاری و گزارش‌ها
    insertSetting.run(
      'base_currency_code',
      'AFN',
      now
    );


    // تعیین ارز دوم معاملات
    insertSetting.run(
      'secondary_currency_code',
      'USD',
      now
    );


    /* =====================================
       ثبت موفقیت‌آمیز مهاجرت
    ===================================== */

    // فقط پس از اجرای موفق تمام عملیات، نسخه به ۴ ارتقا می‌یابد
    database.exec('PRAGMA user_version = 4');

    database.exec('COMMIT');

  } catch (error) {

    // در صورت بروز خطا، تمام تغییرات این مهاجرت لغو می‌شوند
    try {

      database.exec('ROLLBACK');

    } catch {

      // خطای احتمالی هنگام بازگشت تراکنش نادیده گرفته می‌شود

    }

    // خطای اصلی به فراخواننده منتقل می‌شود
    throw error;

  }

}



// اتصال به پایگاه داده یا ایجاد آن
function openDatabase(databasePath) {

  const database = new DatabaseSync(databasePath);

  try {

    // ارتقای ساختار پایگاه داده از نسخه ۲ به ۳
    function migrateToVersion3(database) {

      database.exec('BEGIN IMMEDIATE');

      try {

        // دریافت ستون‌های فعلی جدول کاربران
        const columns = database
          .prepare('PRAGMA table_info(users)')
          .all();

        const columnNames = new Set(
          columns.map(column => column.name)
        );

        // افزودن ستون داده تصویر در صورت نبودن آن
        if (!columnNames.has('profile_image_data')) {

          database.exec(`
        ALTER TABLE users
        ADD COLUMN profile_image_data BLOB
      `);

        }

        // افزودن نوع تصویر در صورت نبودن آن
        if (!columnNames.has('profile_image_mime')) {

          database.exec(`
        ALTER TABLE users
        ADD COLUMN profile_image_mime TEXT
      `);

        }

        // ثبت نسخه جدید ساختار
        database.exec('PRAGMA user_version = 3');

        database.exec('COMMIT');

      } catch (error) {

        try {
          database.exec('ROLLBACK');
        } catch {
          // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
        }

        throw error;

      }

    }

    // فعال‌کردن کنترل ارتباط میان جداول
    database.exec('PRAGMA foreign_keys = ON');

    // حداکثر زمان انتظار برای آزادشدن قفل پایگاه داده
    database.exec('PRAGMA busy_timeout = 5000');

    // استفاده از حالت WAL برای مدیریت بهتر خواندن و نوشتن
    database.exec('PRAGMA journal_mode = WAL');

    // اولویت‌دادن به اطمینان از ثبت تغییرات
    database.exec('PRAGMA synchronous = FULL');


    // بررسی نسخه فعلی ساختار پایگاه داده
    const result = database
      .prepare('PRAGMA user_version')
      .get();

    const currentVersion = Number(result.user_version);


    // جلوگیری از بازکردن پایگاه داده با نسخه جدیدتر و ناسازگار
    if (currentVersion > SCHEMA_VERSION) {

      throw new Error(
        'نسخه پایگاه داده از نسخه پشتیبانی‌شده برنامه جدیدتر است.'
      );

    }



    // ایجاد پایگاه داده در اولین اجرا
    if (currentVersion === 0) {

      // ابتدا ساختار پایه کاربران در نسخه ۳ ایجاد می‌شود
      createInitialSchema(database);

      // سپس جداول اطلاعات پایه به نسخه ۴ اضافه می‌شوند
      migrateToVersion4(database);

    }

    // ارتقای پایگاه داده نسخه ۲ به نسخه ۴
    else if (currentVersion === 2) {

      // ابتدا پایگاه داده از نسخه ۲ به نسخه ۳ ارتقا می‌یابد
      migrateToVersion3(database);

      // سپس مهاجرت نسخه ۴ اجرا می‌شود
      migrateToVersion4(database);

    }

    // ارتقای پایگاه داده نسخه ۳ به نسخه ۴
    else if (currentVersion === 3) {

      migrateToVersion4(database);

    }

    // اگر نسخه فعلی با آخرین نسخه برابر باشد، نیازی به مهاجرت نیست
    else if (currentVersion !== SCHEMA_VERSION) {

      throw new Error(
        'نسخه ساختار پایگاه داده پشتیبانی نمی‌شود.'
      );

    }


    return database;

  } catch (error) {

    // بستن اتصال در صورت بروز خطا
    database.close();

    throw error;

  }

}


module.exports = {
  openDatabase,
  SCHEMA_VERSION,
};
