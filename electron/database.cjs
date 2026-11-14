
const { DatabaseSync } = require('node:sqlite');


// نسخه ساختار پایگاه داده
const SCHEMA_VERSION = 1;


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

        password_hash TEXT NOT NULL,

        password_salt TEXT NOT NULL,

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


    // ثبت نسخه ساختار پایگاه داده
    database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

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


// اتصال به پایگاه داده یا ایجاد آن
function openDatabase(databasePath) {

  const database = new DatabaseSync(databasePath);

  try {

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


    // ایجاد جداول در اولین اجرا
    if (currentVersion === 0) {
      createInitialSchema(database);
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
