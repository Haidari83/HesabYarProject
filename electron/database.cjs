
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

// آخرین نسخه ساختار پایگاه داده
const SCHEMA_VERSION = 7;

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


/* =========================================
   مهاجرت ساختار پایگاه داده از نسخه ۴ به ۵
   ایجاد ساختار کالاها، واحدهای کالا و قیمت‌ها
========================================= */

function migrateToVersion5(database) {

  // آغاز تراکنش مهاجرت
  database.exec('BEGIN IMMEDIATE');

  try {

    database.exec(`

      /* =====================================
         جدول اصلی کالاها
      ===================================== */

      CREATE TABLE IF NOT EXISTS products (

        id TEXT PRIMARY KEY,

        code TEXT NOT NULL COLLATE NOCASE UNIQUE
          CHECK (
            length(trim(code)) > 0
            AND code = trim(code)
          ),

        name TEXT NOT NULL
          CHECK (length(trim(name)) > 0),

        normalized_name TEXT NOT NULL
          CHECK (length(trim(normalized_name)) > 0),

        category_id TEXT NOT NULL,

        base_unit_id TEXT NOT NULL,

        /* دقت نگهداری مقدار کالا در واحد مبنا */
        base_quantity_decimal_places INTEGER NOT NULL
          CHECK (
            base_quantity_decimal_places BETWEEN 0 AND 6
          ),

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        updated_at TEXT,

        updated_by_user_id TEXT,

        /* اطلاعات ویرایش باید هم‌زمان ثبت شوند */
        CHECK (
          (
            updated_at IS NULL
            AND updated_by_user_id IS NULL
          )
          OR
          (
            updated_at IS NOT NULL
            AND updated_by_user_id IS NOT NULL
          )
        ),

        FOREIGN KEY (category_id)
          REFERENCES categories(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (base_unit_id)
          REFERENCES units(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (updated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         جدول واحدهای مجاز هر کالا
      ===================================== */

      CREATE TABLE IF NOT EXISTS product_units (

        id TEXT PRIMARY KEY,

        product_id TEXT NOT NULL,

        unit_id TEXT NOT NULL,

        /* مشخص می‌کند این ردیف واحد مبنای کالاست */
        is_base_unit INTEGER NOT NULL DEFAULT 0
          CHECK (is_base_unit IN (0, 1)),

        /* نسبت تبدیل واحد بسته‌بندی به واحد مبنا */
        conversion_num INTEGER,

        conversion_den INTEGER,

        /* حداکثر دقت مجاز ورود مقدار با این واحد */
        input_decimal_places INTEGER NOT NULL
          CHECK (
            input_decimal_places BETWEEN 0 AND 6
          ),

        is_active INTEGER NOT NULL DEFAULT 1
          CHECK (is_active IN (0, 1)),

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        deactivated_at TEXT,

        deactivated_by_user_id TEXT,

        /* شناسه واحد همراه با شناسه کالا یکتا است */
        UNIQUE (id, product_id),

        /* نسبت تبدیل یا باید کاملاً خالی باشد یا مثبت و صحیح */
        CHECK (

          (
            conversion_num IS NULL
            AND conversion_den IS NULL
          )

          OR

          (
            typeof(conversion_num) = 'integer'
            AND conversion_num > 0

            AND typeof(conversion_den) = 'integer'
            AND conversion_den > 0
          )

        ),

        /* اطلاعات غیرفعال‌سازی باید کامل ثبت شوند */
        CHECK (

          (
            is_active = 1
            AND deactivated_at IS NULL
            AND deactivated_by_user_id IS NULL
          )

          OR

          (
            is_active = 0
            AND deactivated_at IS NOT NULL
            AND deactivated_by_user_id IS NOT NULL
          )

        ),

        FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (unit_id)
          REFERENCES units(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (deactivated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         جدول سوابق قیمت کالا
      ===================================== */

      CREATE TABLE IF NOT EXISTS product_prices (

        id TEXT PRIMARY KEY,

        product_id TEXT NOT NULL,

        product_unit_id TEXT NOT NULL,

        currency_code TEXT NOT NULL,

        price_type TEXT NOT NULL
          CHECK (
            price_type IN ('purchase', 'sale')
          ),

        /* قیمت با مقیاس یک میلیون ذخیره می‌شود */
        unit_price_scaled INTEGER NOT NULL
          CHECK (
            typeof(unit_price_scaled) = 'integer'
            AND unit_price_scaled >= 0
          ),

        is_current INTEGER NOT NULL DEFAULT 1
          CHECK (is_current IN (0, 1)),

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        note TEXT,

        FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT,

        /* جلوگیری از اتصال قیمت به واحد کالای دیگر */
        FOREIGN KEY (product_unit_id, product_id)
          REFERENCES product_units(id, product_id)
          ON DELETE RESTRICT,

        FOREIGN KEY (currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         شاخص‌های جست‌وجو و جلوگیری از تکرار
      ===================================== */

      CREATE INDEX IF NOT EXISTS
      idx_products_normalized_name

      ON products(normalized_name);


      CREATE INDEX IF NOT EXISTS
      idx_products_category_active

      ON products(category_id, is_active);


      CREATE UNIQUE INDEX IF NOT EXISTS
      ux_product_units_active_product_unit

      ON product_units(product_id, unit_id)

      WHERE is_active = 1;


      /* هر کالا فقط یک واحد مبنای فعال می‌تواند داشته باشد */
      CREATE UNIQUE INDEX IF NOT EXISTS
      ux_product_units_one_active_base

      ON product_units(product_id)

      WHERE is_active = 1 AND is_base_unit = 1;


      CREATE INDEX IF NOT EXISTS
      idx_product_units_product_active

      ON product_units(product_id, is_active);


      /* جلوگیری از ثبت دو قیمت جاری یکسان */
      CREATE UNIQUE INDEX IF NOT EXISTS
      ux_product_prices_current

      ON product_prices(
        product_id,
        product_unit_id,
        currency_code,
        price_type
      )

      WHERE is_current = 1;


      CREATE INDEX IF NOT EXISTS
      idx_product_prices_history

      ON product_prices(
        product_id,
        price_type,
        created_at DESC
      );


      /* =====================================
         کنترل اعتبار کالا
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_products_validate_insert

      BEFORE INSERT ON products

      BEGIN

        /* دسته‌بندی کالا باید فعال باشد */
        SELECT CASE

          WHEN NOT EXISTS (

            SELECT 1
            FROM categories

            WHERE id = NEW.category_id
              AND is_active = 1

          )

          THEN RAISE(
            ABORT,
            'Product category must be active.'
          )

        END;


        /* واحد مبنا باید استاندارد و فعال باشد */
        SELECT CASE

          WHEN NOT EXISTS (

            SELECT 1
            FROM units

            WHERE id = NEW.base_unit_id
              AND unit_kind = 'standard'
              AND is_active = 1

          )

          THEN RAISE(
            ABORT,
            'Product base unit must be an active standard unit.'
          )

        END;

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_products_validate_update

      BEFORE UPDATE OF category_id, base_unit_id
      ON products

      BEGIN

        /* دسته‌بندی جدید باید فعال باشد */
        SELECT CASE

          WHEN NEW.category_id <> OLD.category_id

            AND NOT EXISTS (

              SELECT 1
              FROM categories

              WHERE id = NEW.category_id
                AND is_active = 1

            )

          THEN RAISE(
            ABORT,
            'Product category must be active.'
          )

        END;


        /* واحد مبنای جدید باید استاندارد و فعال باشد */
        SELECT CASE

          WHEN NEW.base_unit_id <> OLD.base_unit_id

            AND NOT EXISTS (

              SELECT 1
              FROM units

              WHERE id = NEW.base_unit_id
                AND unit_kind = 'standard'
                AND is_active = 1

            )

          THEN RAISE(
            ABORT,
            'Product base unit must be an active standard unit.'
          )

        END;

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_products_no_delete

      BEFORE DELETE ON products

      BEGIN

        /* کالاها حذف فیزیکی نمی‌شوند */
        SELECT RAISE(
          ABORT,
          'Products cannot be deleted; deactivate them instead.'
        );

      END;


      /* =====================================
         اعتبارسنجی واحدهای هر کالا
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_validate_insert

      BEFORE INSERT ON product_units

      BEGIN

        /* فقط به کالای فعال می‌توان واحد جدید افزود */
        SELECT CASE

          WHEN NOT EXISTS (

            SELECT 1
            FROM products

            WHERE id = NEW.product_id
              AND is_active = 1

          )

          THEN RAISE(
            ABORT,
            'Product must be active when adding a product unit.'
          )

        END;


        /* واحد عمومی باید فعال باشد */
        SELECT CASE

          WHEN NEW.is_active <> 1

            OR NOT EXISTS (

              SELECT 1
              FROM units

              WHERE id = NEW.unit_id
                AND is_active = 1

            )

          THEN RAISE(
            ABORT,
            'A new product unit must use an active unit.'
          )

        END;


        /* واحد مبنا باید با واحد مبنای خود کالا برابر باشد */
        SELECT CASE

          WHEN NEW.is_base_unit = 1

            AND NOT EXISTS (

              SELECT 1

              FROM products p

              JOIN units u
                ON u.id = p.base_unit_id

              WHERE p.id = NEW.product_id
                AND p.base_unit_id = NEW.unit_id
                AND u.unit_kind = 'standard'
                AND NEW.conversion_num = 1
                AND NEW.conversion_den = 1

            )

          THEN RAISE(
            ABORT,
            'The base product unit must match the product base unit and use ratio 1/1.'
          )

        END;


        /* واحد مبنا نباید به‌عنوان واحد فرعی ثبت شود */
        SELECT CASE

          WHEN NEW.is_base_unit = 0

            AND EXISTS (

              SELECT 1
              FROM products

              WHERE id = NEW.product_id
                AND base_unit_id = NEW.unit_id

            )

          THEN RAISE(
            ABORT,
            'The product base unit must be marked as the base row.'
          )

        END;


        /* واحدهای استاندارد فرعی باید هم‌بُعد با واحد مبنا باشند */
        /* ضریب آن‌ها مستقیماً از جدول units محاسبه می‌شود */
        SELECT CASE

          WHEN EXISTS (

            SELECT 1

            FROM products p

            JOIN units candidate
              ON candidate.id = NEW.unit_id

            JOIN units base
              ON base.id = p.base_unit_id

            WHERE p.id = NEW.product_id

              AND candidate.unit_kind = 'standard'

              AND (

                candidate.dimension_code <> base.dimension_code

                OR (

                  NEW.is_base_unit = 0

                  AND (

                    NEW.conversion_num IS NOT NULL
                    OR NEW.conversion_den IS NOT NULL

                  )

                )

              )

          )

          THEN RAISE(
            ABORT,
            'Standard product units must share the base dimension and must not store a product conversion ratio.'
          )

        END;


        /* واحد بسته‌بندی حتماً به ضریب تبدیل اختصاصی نیاز دارد */
        SELECT CASE

          WHEN EXISTS (

            SELECT 1
            FROM units

            WHERE id = NEW.unit_id
              AND unit_kind = 'package'

          )

          AND (

            NEW.is_base_unit = 1

            OR NEW.conversion_num IS NULL
            OR NEW.conversion_den IS NULL
            OR NEW.conversion_num <= 0
            OR NEW.conversion_den <= 0

          )

          THEN RAISE(
            ABORT,
            'Package units require a positive product-specific conversion ratio and cannot be the base unit.'
          )

        END;

      END;


      /* =====================================
         حفاظت از سوابق واحدهای کالا
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_immutable_fields

      BEFORE UPDATE OF
        product_id,
        unit_id,
        is_base_unit,
        conversion_num,
        conversion_den,
        input_decimal_places,
        created_at,
        created_by_user_id

      ON product_units

      BEGIN

        /* تغییر تعریف واحد با ویرایش مجاز نیست */
        /* باید نسخه قبلی غیرفعال و نسخه جدید ایجاد شود */
        SELECT RAISE(
          ABORT,
          'Product unit definitions are immutable; create a new version instead.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_no_reactivation

      BEFORE UPDATE OF is_active ON product_units

      WHEN OLD.is_active = 0 AND NEW.is_active = 1

      BEGIN

        /* واحد غیرفعال دوباره فعال نمی‌شود */
        SELECT RAISE(
          ABORT,
          'An inactive product unit cannot be reactivated; create a new version instead.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_prevent_current_base_deactivation

      BEFORE UPDATE OF is_active ON product_units

      WHEN OLD.is_active = 1
        AND NEW.is_active = 0
        AND OLD.is_base_unit = 1

        AND EXISTS (

          SELECT 1
          FROM products

          WHERE id = OLD.product_id
            AND base_unit_id = OLD.unit_id

        )

      BEGIN

        /* واحد مبنای جاری تا زمان تغییر واحد مبنای کالا غیرفعال نمی‌شود */
        SELECT RAISE(
          ABORT,
          'The current base unit cannot be deactivated before changing the product base unit.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_deactivation_metadata_immutable

      BEFORE UPDATE OF
        deactivated_at,
        deactivated_by_user_id

      ON product_units

      WHEN OLD.deactivated_at IS NOT NULL

      BEGIN

        /* زمان و ثبت‌کننده غیرفعال‌سازی تغییر نمی‌کنند */
        SELECT RAISE(
          ABORT,
          'Product unit deactivation history is immutable.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_no_delete

      BEFORE DELETE ON product_units

      BEGIN

        /* سوابق تعریف واحد کالا حذف فیزیکی نمی‌شوند */
        SELECT RAISE(
          ABORT,
          'Product unit history cannot be deleted.'
        );

      END;


      /* =====================================
         اعتبارسنجی قیمت‌های کالا
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_product_prices_validate_insert

      BEFORE INSERT ON product_prices

      BEGIN

        /* قیمت فقط برای کالا، واحد و ارز فعال ثبت می‌شود */
        SELECT CASE

          WHEN NOT EXISTS (

            SELECT 1

            FROM products p

            JOIN product_units pu
              ON pu.product_id = p.id

            JOIN currencies c
              ON c.code = NEW.currency_code

            WHERE p.id = NEW.product_id
              AND p.is_active = 1

              AND pu.id = NEW.product_unit_id
              AND pu.is_active = 1

              AND c.is_active = 1

          )

          THEN RAISE(
            ABORT,
            'A price requires an active product, active product unit and active currency.'
          )

        END;

      END;


      /* =====================================
         حفاظت از تاریخچه قیمت‌ها
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_product_prices_immutable_fields

      BEFORE UPDATE OF
        id,
        product_id,
        product_unit_id,
        currency_code,
        price_type,
        unit_price_scaled,
        created_at,
        created_by_user_id,
        note

      ON product_prices

      BEGIN

        /* قیمت قبلی ویرایش نمی‌شود؛ قیمت جدید ثبت خواهد شد */
        SELECT RAISE(
          ABORT,
          'Price history is immutable; create a new price record instead.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_prices_no_reactivation

      BEFORE UPDATE OF is_current ON product_prices

      WHEN OLD.is_current = 0 AND NEW.is_current = 1

      BEGIN

        /* قیمت تاریخی دوباره به قیمت جاری تبدیل نمی‌شود */
        SELECT RAISE(
          ABORT,
          'A historical price cannot become current again; create a new price record instead.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      trg_product_prices_no_delete

      BEFORE DELETE ON product_prices

      BEGIN

        /* سوابق قیمت حذف فیزیکی نمی‌شوند */
        SELECT RAISE(
          ABORT,
          'Product price history cannot be deleted.'
        );

      END;


      /* =====================================
         غیرفعال‌سازی قیمت‌های واحد غیرفعال‌شده
      ===================================== */

      CREATE TRIGGER IF NOT EXISTS
      trg_product_units_deactivate_current_prices

      AFTER UPDATE OF is_active ON product_units

      WHEN OLD.is_active = 1 AND NEW.is_active = 0

      BEGIN

        /* قیمت‌های جاری واحد غیرفعال‌شده تاریخی می‌شوند */
        UPDATE product_prices

        SET is_current = 0

        WHERE product_unit_id = OLD.id
          AND is_current = 1;

      END;

    `);


    // ثبت نسخه پنجم پس از ایجاد موفق تمام ساختارها
    database.exec('PRAGMA user_version = 5');

    // تأیید نهایی تراکنش مهاجرت
    database.exec('COMMIT');

  } catch (error) {

    // در صورت بروز خطا تمام تغییرات این مهاجرت لغو می‌شوند
    try {

      database.exec('ROLLBACK');

    } catch {

      // نادیده‌گرفتن خطای احتمالی هنگام بازگشت تراکنش

    }

    // انتقال خطای اصلی به بخش راه‌اندازی برنامه
    throw error;

  }

}

/* =========================================
   مهاجرت ساختار پایگاه داده از نسخه ۵ به ۶
   یکسان‌سازی دقت اعشاری واحدها و کالاها
========================================= */

function migrateToVersion6(database) {
  // آغاز تراکنش مهاجرت
  database.exec('BEGIN IMMEDIATE');

  try {
    // یکسان‌سازی دقت پیش‌فرض واحدهای اندازه‌گیری
    database.exec(`
      UPDATE units
      SET default_decimal_places = 2;
    `);

    // یکسان‌سازی دقت مقدار پایه تمام کالاها
    database.exec(`
      UPDATE products
      SET base_quantity_decimal_places = 2;
    `);

    // ثبت نسخه ششم پس از تکمیل موفق عملیات
    database.exec('PRAGMA user_version = 6');

    database.exec('COMMIT');
  } catch (error) {
    // در صورت شکست، تمام تغییرات مهاجرت لغو می‌شوند
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;
  }
}

/* =========================================
   مهاجرت ساختار پایگاه داده از نسخه ۶ به ۷

   ایجاد ساختار اسناد انبار، گردش موجودی
   و لایه‌های بهای تمام‌شده FIFO
========================================= */

function migrateToVersion7(database) {

  // آغاز تراکنش مهاجرت
  // تمام جداول، شاخص‌ها و محدودیت‌ها باید با هم ایجاد شوند.
  database.exec('BEGIN IMMEDIATE');

  try {

    database.exec(`

      /* =====================================
         ۱. اسناد انبار
      ===================================== */

      CREATE TABLE IF NOT EXISTS inventory_documents (

        id TEXT PRIMARY KEY,

        /* شماره یکتای سند که در سرویس انبار تولید می‌شود */
        document_number TEXT NOT NULL UNIQUE COLLATE NOCASE
          CHECK (
            length(trim(document_number)) > 0
          ),

        /* نوع سند انبار */
        document_type TEXT NOT NULL
          CHECK (
            document_type IN (
              'purchase',
              'sales_return',
              'opening',
              'other',
              'sale',
              'purchase_return',
              'adjustment_in',
              'adjustment_out'
            )
          ),

        /* تاریخ سند با قالب YYYY-MM-DD */
        document_date TEXT NOT NULL
          CHECK (
            date(document_date) IS NOT NULL
            AND date(document_date) = document_date
          ),

        /* وضعیت سند */
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (
            status IN (
              'draft',
              'posted',
              'cancelled'
            )
          ),

        /* نوع طرف حساب سند */
        source_party_type TEXT
          CHECK (
            source_party_type IS NULL
            OR source_party_type IN (
              'supplier',
              'customer',
              'other'
            )
          ),

        /* نام تأمین‌کننده، مشتری یا طرف حساب */
        source_party_name TEXT,

        /* شماره فاکتور یا مرجع خارجی */
        source_invoice_number TEXT,

        /* علت ثبت سند؛ برای اسناد متفرقه و اصلاحی */
        reason TEXT,

        /* توضیحات تکمیلی */
        notes TEXT,

        /* اطلاعات ایجاد */
        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        /* اطلاعات آخرین ویرایش پیش‌نویس */
        updated_at TEXT,

        updated_by_user_id TEXT,

        /* اطلاعات ثبت نهایی */
        posted_at TEXT,

        posted_by_user_id TEXT,

        /* اطلاعات لغو پیش‌نویس */
        cancelled_at TEXT,

        cancelled_by_user_id TEXT,

        /* اطلاعات ویرایش باید هم‌زمان ثبت شوند */
        CHECK (
          (
            updated_at IS NULL
            AND updated_by_user_id IS NULL
          )
          OR
          (
            updated_at IS NOT NULL
            AND updated_by_user_id IS NOT NULL
          )
        ),

        /* وضعیت سند باید با اطلاعات ثبت و لغو هماهنگ باشد */
        CHECK (

          (
            status = 'draft'

            AND posted_at IS NULL
            AND posted_by_user_id IS NULL

            AND cancelled_at IS NULL
            AND cancelled_by_user_id IS NULL
          )

          OR

          (
            status = 'posted'

            AND posted_at IS NOT NULL
            AND posted_by_user_id IS NOT NULL

            AND cancelled_at IS NULL
            AND cancelled_by_user_id IS NULL
          )

          OR

          (
            status = 'cancelled'

            AND posted_at IS NULL
            AND posted_by_user_id IS NULL

            AND cancelled_at IS NOT NULL
            AND cancelled_by_user_id IS NOT NULL
          )

        ),

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (updated_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (posted_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (cancelled_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         ۲. اقلام اسناد انبار
      ===================================== */

      CREATE TABLE IF NOT EXISTS inventory_document_items (

        id TEXT PRIMARY KEY,

        document_id TEXT NOT NULL,

        /* شماره ردیف در داخل سند */
        line_number INTEGER NOT NULL
          CHECK (line_number > 0),

        product_id TEXT NOT NULL,

        /* شناسه نسخه واحد مجاز برای محصول */
        product_unit_id TEXT NOT NULL,

        /* اطلاعات تاریخی محصول در زمان ثبت سند */
        product_code_snapshot TEXT NOT NULL,

        product_name_snapshot TEXT NOT NULL
          CHECK (
            length(trim(product_name_snapshot)) > 0
          ),

        unit_name_snapshot TEXT NOT NULL
          CHECK (
            length(trim(unit_name_snapshot)) > 0
          ),

        unit_symbol_snapshot TEXT,

        /* نسبت تبدیل واحد انتخاب‌شده به واحد پایه */
        conversion_num INTEGER NOT NULL
          CHECK (conversion_num > 0),

        conversion_den INTEGER NOT NULL
          CHECK (conversion_den > 0),

        /*
          مقدار با مقیاس یک میلیون ذخیره می‌شود.

          مثال:
          ۲۵٫۵ کیلوگرم = ۲۵۵۰۰۰۰۰
        */
        quantity_scaled INTEGER NOT NULL
          CHECK (
            typeof(quantity_scaled) = 'integer'
            AND quantity_scaled > 0
          ),

        /*
          مقدار تبدیل‌شده به واحد پایه محصول
          با همان مقیاس یک میلیون
        */
        base_quantity_scaled INTEGER NOT NULL
          CHECK (
            typeof(base_quantity_scaled) = 'integer'
            AND base_quantity_scaled > 0
          ),

        /*
          قیمت خرید هر واحد در ارز انتخاب‌شده
          برای اسنادی که قیمت ندارند، این فیلد NULL است.
        */
        unit_price_scaled INTEGER
          CHECK (
            unit_price_scaled IS NULL
            OR (
              typeof(unit_price_scaled) = 'integer'
              AND unit_price_scaled >= 0
            )
          ),

        /* ارز قیمت ثبت‌شده در سند */
        currency_code TEXT,

        /* ارز مبنای ارزش‌گذاری موجودی */
        valuation_currency_code TEXT,

        /*
          نرخ تبدیل ارز به‌صورت نسبت صحیح

          نرخ = exchange_rate_num / exchange_rate_den

          جهت تبدیل:
          ارز سند به ارز مبنای ارزش‌گذاری
        */
        exchange_rate_num INTEGER,

        exchange_rate_den INTEGER,

        notes TEXT,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        /* شماره ردیف در یک سند نباید تکرار شود */
        UNIQUE (
          document_id,
          line_number
        ),

        /*
          این قید برای اطمینان از ارتباط صحیح
          سند، محصول و ردیف آن استفاده می‌شود.
        */
        UNIQUE (
          id,
          product_id,
          document_id
        ),

        /*
          اطلاعات قیمت یا باید کاملاً خالی باشند
          یا تمام اطلاعات قیمت و نرخ ارز ثبت شده باشند.
        */
        CHECK (

          (
            unit_price_scaled IS NULL
            AND currency_code IS NULL
            AND valuation_currency_code IS NULL
            AND exchange_rate_num IS NULL
            AND exchange_rate_den IS NULL
          )

          OR

          (
            unit_price_scaled IS NOT NULL

            AND currency_code IS NOT NULL

            AND valuation_currency_code IS NOT NULL

            AND exchange_rate_num IS NOT NULL
            AND exchange_rate_num > 0

            AND exchange_rate_den IS NOT NULL
            AND exchange_rate_den > 0
          )

        ),

        FOREIGN KEY (document_id)
          REFERENCES inventory_documents(id)
          ON DELETE CASCADE,

        FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT,

        /* واحد حتماً باید متعلق به همین محصول باشد */
        FOREIGN KEY (product_unit_id, product_id)
          REFERENCES product_units(id, product_id)
          ON DELETE RESTRICT,

        FOREIGN KEY (currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (valuation_currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         ۳. گردش موجودی انبار
      ===================================== */

      CREATE TABLE IF NOT EXISTS inventory_movements (

        id TEXT PRIMARY KEY,

        document_id TEXT NOT NULL,

        document_item_id TEXT NOT NULL,

        product_id TEXT NOT NULL,

        /* جهت گردش */
        movement_direction TEXT NOT NULL
          CHECK (
            movement_direction IN (
              'in',
              'out'
            )
          ),

        /* مقدار گردش در واحد پایه محصول */
        base_quantity_scaled INTEGER NOT NULL
          CHECK (
            typeof(base_quantity_scaled) = 'integer'
            AND base_quantity_scaled > 0
          ),

        /* تاریخ وقوع گردش */
        movement_at TEXT NOT NULL,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        /*
          هر ردیف سند فقط یک گردش ایجاد می‌کند.
          خروجی‌های چندلایه FIFO در جدول تخصیص ثبت می‌شوند.
        */
        UNIQUE (document_item_id),

        /* کلید مرکب برای ارتباط با لایه‌های FIFO */
        UNIQUE (
          id,
          product_id
        ),

        FOREIGN KEY (document_id)
          REFERENCES inventory_documents(id)
          ON DELETE RESTRICT,

        /*
          اطمینان از اینکه محصول و سند ردیف گردش
          دقیقاً با ردیف سند انبار یکسان هستند.
        */
        FOREIGN KEY (
          document_item_id,
          product_id,
          document_id
        )
          REFERENCES inventory_document_items (
            id,
            product_id,
            document_id
          )
          ON DELETE RESTRICT,

        FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         ۴. لایه‌های بهای تمام‌شده FIFO
      ===================================== */

      CREATE TABLE IF NOT EXISTS inventory_cost_layers (

        id TEXT PRIMARY KEY,

        /* گردش ورودی ایجادکننده لایه */
        source_movement_id TEXT NOT NULL UNIQUE,

        product_id TEXT NOT NULL,

        /* تاریخ ورود کالا به انبار */
        received_at TEXT NOT NULL,

        /* مقدار اولیه لایه در واحد پایه */
        original_quantity_base_scaled INTEGER NOT NULL
          CHECK (
            typeof(original_quantity_base_scaled) = 'integer'
            AND original_quantity_base_scaled > 0
          ),

        /*
          بهای هر واحد پایه در ارز مبنای ارزش‌گذاری
          با مقیاس یک میلیون
        */
        unit_cost_scaled INTEGER NOT NULL
          CHECK (
            typeof(unit_cost_scaled) = 'integer'
            AND unit_cost_scaled >= 0
          ),

        valuation_currency_code TEXT NOT NULL,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        /*
          کلید مرکب برای اطمینان از ارتباط ارز،
          محصول و لایه در تخصیص FIFO
        */
        UNIQUE (
          id,
          product_id,
          valuation_currency_code
        ),

        /* هر لایه باید از گردش ورودی همان محصول ساخته شود */
        FOREIGN KEY (source_movement_id, product_id)
          REFERENCES inventory_movements(id, product_id)
          ON DELETE RESTRICT,

        FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT,

        FOREIGN KEY (valuation_currency_code)
          REFERENCES currencies(code)
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         ۵. تخصیص خروج کالا به لایه‌های FIFO
      ===================================== */

      CREATE TABLE IF NOT EXISTS inventory_fifo_allocations (

        id TEXT PRIMARY KEY,

        /* گردش خروجی که از این لایه مصرف کرده است */
        outbound_movement_id TEXT NOT NULL,

        /* لایه بهای تمام‌شده مصرف‌شده */
        cost_layer_id TEXT NOT NULL,

        product_id TEXT NOT NULL,

        /* مقدار مصرف‌شده از لایه در واحد پایه */
        allocated_quantity_base_scaled INTEGER NOT NULL
          CHECK (
            typeof(allocated_quantity_base_scaled) = 'integer'
            AND allocated_quantity_base_scaled > 0
          ),

        /* بهای واحد مصرف‌شده */
        unit_cost_scaled INTEGER NOT NULL
          CHECK (
            typeof(unit_cost_scaled) = 'integer'
            AND unit_cost_scaled >= 0
          ),

        /* بهای کل تخصیص */
        allocated_cost_scaled INTEGER NOT NULL
          CHECK (
            typeof(allocated_cost_scaled) = 'integer'
            AND allocated_cost_scaled >= 0
          ),

        valuation_currency_code TEXT NOT NULL,

        created_at TEXT NOT NULL,

        created_by_user_id TEXT NOT NULL,

        /*
          یک گردش خروجی نمی‌تواند
          یک لایه را چند بار تخصیص دهد.
        */
        UNIQUE (
          outbound_movement_id,
          cost_layer_id
        ),

        FOREIGN KEY (outbound_movement_id, product_id)
          REFERENCES inventory_movements(id, product_id)
          ON DELETE RESTRICT,

        FOREIGN KEY (
          cost_layer_id,
          product_id,
          valuation_currency_code
        )
          REFERENCES inventory_cost_layers (
            id,
            product_id,
            valuation_currency_code
          )
          ON DELETE RESTRICT,

        FOREIGN KEY (created_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT

      );


      /* =====================================
         ۶. شاخص‌های بهینه‌سازی جست‌وجو
      ===================================== */

      CREATE INDEX IF NOT EXISTS
      idx_inventory_documents_type_date

      ON inventory_documents (
        document_type,
        document_date DESC
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_documents_status_date

      ON inventory_documents (
        status,
        document_date DESC
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_documents_created_by

      ON inventory_documents (
        created_by_user_id,
        created_at DESC
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_document_items_document

      ON inventory_document_items (
        document_id,
        line_number
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_document_items_product

      ON inventory_document_items(product_id);


      CREATE INDEX IF NOT EXISTS
      idx_inventory_movements_product_date

      ON inventory_movements (
        product_id,
        movement_at,
        created_at
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_movements_document

      ON inventory_movements(document_id);


      CREATE INDEX IF NOT EXISTS
      idx_inventory_cost_layers_product_fifo

      ON inventory_cost_layers (
        product_id,
        received_at,
        created_at,
        id
      );


      CREATE INDEX IF NOT EXISTS
      idx_inventory_fifo_allocations_layer

      ON inventory_fifo_allocations(cost_layer_id);


      CREATE INDEX IF NOT EXISTS
      idx_inventory_fifo_allocations_outbound

      ON inventory_fifo_allocations(outbound_movement_id);


      /* =====================================
         ۷. مشاهده مانده هر لایه FIFO
      ===================================== */

      /*
        مانده لایه از تفاضل مقدار اولیه و
        مجموع تخصیص‌های انجام‌شده محاسبه می‌شود.

        این View مقدار موجودی را ذخیره نمی‌کند؛
        بلکه آن را از سابقه تخصیص FIFO به دست می‌آورد.
      */

      CREATE VIEW IF NOT EXISTS inventory_cost_layer_balances AS

      SELECT

        layer.id,

        layer.source_movement_id,

        layer.product_id,

        layer.received_at,

        layer.original_quantity_base_scaled,

        layer.unit_cost_scaled,

        layer.valuation_currency_code,

        layer.created_at,

        layer.created_by_user_id,

        layer.original_quantity_base_scaled
          - COALESCE(
              SUM(
                allocation.allocated_quantity_base_scaled
              ),
              0
            ) AS remaining_quantity_base_scaled

      FROM inventory_cost_layers AS layer

      LEFT JOIN inventory_fifo_allocations AS allocation

        ON allocation.cost_layer_id = layer.id

      GROUP BY layer.id;


      /* =====================================
         ۸. محافظت از اسناد ثبت‌شده
      ===================================== */

      /* جلوگیری از ویرایش سند ثبت‌شده یا لغوشده */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_update_after_posting

      BEFORE UPDATE ON inventory_documents

      WHEN OLD.status <> 'draft'

      BEGIN

        SELECT RAISE(
          ABORT,
          'Posted or cancelled inventory documents are immutable.'
        );

      END;


      /* فقط انتقال پیش‌نویس به ثبت‌شده یا لغوشده مجاز است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_status_reversal

      BEFORE UPDATE OF status ON inventory_documents

      WHEN OLD.status <> 'draft'
        OR NEW.status NOT IN ('posted', 'cancelled')

      BEGIN

        SELECT RAISE(
          ABORT,
          'Invalid inventory document status transition.'
        );

      END;


      /* سند بدون قلم قابل ثبت نهایی نیست */

      CREATE TRIGGER IF NOT EXISTS
      require_inventory_document_items_before_posting

      BEFORE UPDATE OF status ON inventory_documents

      WHEN OLD.status = 'draft'
        AND NEW.status = 'posted'
        AND NOT EXISTS (
          SELECT 1
          FROM inventory_document_items
          WHERE document_id = OLD.id
        )

      BEGIN

        SELECT RAISE(
          ABORT,
          'An inventory document must contain at least one item.'
        );

      END;


      /* اسناد ثبت‌شده یا لغوشده حذف نمی‌شوند */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_delete_after_draft

      BEFORE DELETE ON inventory_documents

      WHEN OLD.status <> 'draft'

      BEGIN

        SELECT RAISE(
          ABORT,
          'Only draft inventory documents can be deleted.'
        );

      END;


      /* =====================================
         ۹. محافظت از اقلام سند
      ===================================== */

      /* افزودن قلم فقط به سند پیش‌نویس مجاز است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_item_insert_after_draft

      BEFORE INSERT ON inventory_document_items

      WHEN COALESCE(
        (
          SELECT status
          FROM inventory_documents
          WHERE id = NEW.document_id
        ),
        ''
      ) <> 'draft'

      BEGIN

        SELECT RAISE(
          ABORT,
          'Inventory document items can only be added to drafts.'
        );

      END;


      /* ویرایش قلم فقط برای اسناد پیش‌نویس مجاز است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_item_update_after_draft

      BEFORE UPDATE ON inventory_document_items

      WHEN

        COALESCE(
          (
            SELECT status
            FROM inventory_documents
            WHERE id = OLD.document_id
          ),
          ''
        ) <> 'draft'

        OR

        COALESCE(
          (
            SELECT status
            FROM inventory_documents
            WHERE id = NEW.document_id
          ),
          ''
        ) <> 'draft'

      BEGIN

        SELECT RAISE(
          ABORT,
          'Only draft inventory document items can be changed.'
        );

      END;


      /* حذف قلم فقط از اسناد پیش‌نویس مجاز است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_document_item_delete_after_draft

      BEFORE DELETE ON inventory_document_items

      WHEN COALESCE(
        (
          SELECT status
          FROM inventory_documents
          WHERE id = OLD.document_id
        ),
        ''
      ) <> 'draft'

      BEGIN

        SELECT RAISE(
          ABORT,
          'Only draft inventory document items can be deleted.'
        );

      END;


      /* =====================================
         ۱۰. کنترل ثبت گردش موجودی
      ===================================== */

      /*
        گردش فقط برای سند ثبت‌شده مجاز است.

        نوع سند و جهت گردش نیز باید هماهنگ باشند.
      */

      CREATE TRIGGER IF NOT EXISTS
      validate_inventory_movement_insert

      BEFORE INSERT ON inventory_movements

      WHEN NOT EXISTS (

        SELECT 1

        FROM inventory_documents AS document

        WHERE document.id = NEW.document_id

          AND document.status = 'posted'

          AND (

            (
              document.document_type IN (
                'purchase',
                'sales_return',
                'opening',
                'other',
                'adjustment_in'
              )

              AND NEW.movement_direction = 'in'
            )

            OR

            (
              document.document_type IN (
                'sale',
                'purchase_return',
                'adjustment_out'
              )

              AND NEW.movement_direction = 'out'
            )

          )

      )

      BEGIN

        SELECT RAISE(
          ABORT,
          'Inventory movement does not match a posted document type.'
        );

      END;


      /* گردش موجودی تغییرناپذیر است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_movement_update

      BEFORE UPDATE ON inventory_movements

      BEGIN

        SELECT RAISE(
          ABORT,
          'Inventory movements are immutable.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_movement_delete

      BEFORE DELETE ON inventory_movements

      BEGIN

        SELECT RAISE(
          ABORT,
          'Inventory movements cannot be deleted.'
        );

      END;


      /* =====================================
         ۱۱. کنترل ایجاد لایه FIFO
      ===================================== */

      /* لایه فقط از یک گردش ورودی ثبت‌شده ساخته می‌شود */

      CREATE TRIGGER IF NOT EXISTS
      validate_inventory_cost_layer_insert

      BEFORE INSERT ON inventory_cost_layers

      WHEN NOT EXISTS (

        SELECT 1

        FROM inventory_movements AS movement

        JOIN inventory_documents AS document

          ON document.id = movement.document_id

        WHERE movement.id = NEW.source_movement_id

          AND movement.product_id = NEW.product_id

          AND movement.movement_direction = 'in'

          AND document.status = 'posted'

      )

      BEGIN

        SELECT RAISE(
          ABORT,
          'A FIFO cost layer must originate from a posted inbound movement.'
        );

      END;


      /* لایه بهای FIFO تغییرناپذیر است */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_cost_layer_update

      BEFORE UPDATE ON inventory_cost_layers

      BEGIN

        SELECT RAISE(
          ABORT,
          'FIFO cost layers are immutable.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_cost_layer_delete

      BEFORE DELETE ON inventory_cost_layers

      BEGIN

        SELECT RAISE(
          ABORT,
          'FIFO cost layers cannot be deleted.'
        );

      END;


      /* =====================================
         ۱۲. کنترل تخصیص FIFO
      ===================================== */

      /*
        تخصیص باید:

        ۱. به یک گردش خروجی ثبت‌شده متصل باشد.
        ۲. متعلق به همان محصول باشد.
        ۳. از یک لایه موجود استفاده کند.
        ۴. از مقدار باقی‌مانده لایه بیشتر نباشد.
        ۵. بهای واحد آن با لایه مبدأ برابر باشد.
        ۶. ترتیب FIFO را رعایت کند.
      */

      CREATE TRIGGER IF NOT EXISTS
      validate_inventory_fifo_allocation_insert

      BEFORE INSERT ON inventory_fifo_allocations

      WHEN

        /* بررسی گردش خروجی */

        NOT EXISTS (

          SELECT 1

          FROM inventory_movements AS movement

          JOIN inventory_documents AS document

            ON document.id = movement.document_id

          WHERE movement.id = NEW.outbound_movement_id

            AND movement.product_id = NEW.product_id

            AND movement.movement_direction = 'out'

            AND document.status = 'posted'

        )

        OR

        /* بررسی موجودی قابل تخصیص در لایه انتخاب‌شده */

        NOT EXISTS (

          SELECT 1

          FROM inventory_cost_layers AS layer

          WHERE layer.id = NEW.cost_layer_id

            AND layer.product_id = NEW.product_id

            AND layer.valuation_currency_code =
              NEW.valuation_currency_code

            AND layer.unit_cost_scaled = NEW.unit_cost_scaled

            AND layer.original_quantity_base_scaled

              - COALESCE(

                  (

                    SELECT SUM(
                      allocation.allocated_quantity_base_scaled
                    )

                    FROM inventory_fifo_allocations AS allocation

                    WHERE allocation.cost_layer_id = layer.id

                  ),

                  0

                ) >= NEW.allocated_quantity_base_scaled

        )

        OR

        /* جلوگیری از مصرف لایه جدیدتر در حضور لایه قدیمی‌تر */

        EXISTS (

          SELECT 1

          FROM inventory_cost_layers AS older_layer

          JOIN inventory_cost_layers AS selected_layer

            ON selected_layer.id = NEW.cost_layer_id

          WHERE older_layer.product_id = NEW.product_id

            AND (

              older_layer.received_at < selected_layer.received_at

              OR (

                older_layer.received_at = selected_layer.received_at

                AND older_layer.created_at < selected_layer.created_at

              )

              OR (

                older_layer.received_at = selected_layer.received_at

                AND older_layer.created_at = selected_layer.created_at

                AND older_layer.id < selected_layer.id

              )

            )

            AND older_layer.original_quantity_base_scaled

              - COALESCE(

                  (

                    SELECT SUM(
                      allocation.allocated_quantity_base_scaled
                    )

                    FROM inventory_fifo_allocations AS allocation

                    WHERE allocation.cost_layer_id = older_layer.id

                  ),

                  0

                ) > 0

        )

      BEGIN

        SELECT RAISE(
          ABORT,
          'FIFO allocation is invalid or violates FIFO order.'
        );

      END;


      /* تخصیص‌های FIFO تغییرناپذیر هستند */

      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_fifo_allocation_update

      BEFORE UPDATE ON inventory_fifo_allocations

      BEGIN

        SELECT RAISE(
          ABORT,
          'FIFO allocations are immutable.'
        );

      END;


      CREATE TRIGGER IF NOT EXISTS
      prevent_inventory_fifo_allocation_delete

      BEFORE DELETE ON inventory_fifo_allocations

      BEGIN

        SELECT RAISE(
          ABORT,
          'FIFO allocations cannot be deleted.'
        );

      END;

    `);


    // ثبت نسخه هفتم فقط پس از ایجاد موفق تمام ساختارها
    database.exec('PRAGMA user_version = 7');


    // پایان موفق تراکنش مهاجرت
    database.exec('COMMIT');


  } catch (error) {

    // در صورت شکست، تمام ساختارهای ایجادشده بازگردانده می‌شوند
    try {

      database.exec('ROLLBACK');

    } catch {

      // نادیده‌گرفتن خطای احتمالی هنگام بازگشت تراکنش

    }

    // انتقال خطای اصلی به بخش راه‌اندازی برنامه
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
      createInitialSchema(database);
      migrateToVersion4(database);
      migrateToVersion5(database);
      migrateToVersion6(database);
      migrateToVersion7(database);
    }

    // ارتقای پایگاه داده نسخه ۲ به نسخه ۶
    else if (currentVersion === 2) {
      migrateToVersion3(database);
      migrateToVersion4(database);
      migrateToVersion5(database);
      migrateToVersion6(database);
      migrateToVersion7(database);
    }

    // ارتقای پایگاه داده نسخه ۳ به نسخه ۶
    else if (currentVersion === 3) {
      migrateToVersion4(database);
      migrateToVersion5(database);
      migrateToVersion6(database);
      migrateToVersion7(database);
    }

    // ارتقای پایگاه داده نسخه ۴ به نسخه ۶
    else if (currentVersion === 4) {
      migrateToVersion5(database);
      migrateToVersion6(database);
      migrateToVersion7(database);
    }

    // ارتقای پایگاه داده نسخه ۵ به نسخه ۶
    else if (currentVersion === 5) {
      migrateToVersion6(database);
      migrateToVersion7(database);
    }

    // ارتقای پایگاه داده نسخه ۶ به نسخه ۷
    else if (currentVersion === 6) {
      migrateToVersion7(database);
    }

    // بررسی سازگاری نسخه نهایی
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
