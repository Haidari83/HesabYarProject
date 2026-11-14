
const crypto = require('node:crypto');


// تنظیمات الگوریتم هش گذرواژه
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};


// اعتبارسنجی اطلاعات مدیر اولیه
function validateInitialAdminInput(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات ارسالی معتبر نیست.');
  }

  const displayName =
    typeof input.displayName === 'string'
      ? input.displayName.trim()
      : '';

  const username =
    typeof input.username === 'string'
      ? input.username.trim().toLowerCase()
      : '';

  const password =
    typeof input.password === 'string'
      ? input.password
      : '';

  const confirmPassword =
    typeof input.confirmPassword === 'string'
      ? input.confirmPassword
      : '';


  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error(
      'نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد.'
    );
  }


  // نام کاربری با حروف انگلیسی و اعداد تعریف می‌شود
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error(
      'نام کاربری باید بین ۳ تا ۳۲ نویسه و شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.'
    );
  }


  if (
    password.length < 12 ||
    password.length > 128
  ) {
    throw new Error(
      'گذرواژه باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.'
    );
  }


  if (password !== confirmPassword) {
    throw new Error(
      'گذرواژه و تکرار آن یکسان نیستند.'
    );
  }


  return {
    displayName,
    username,
    password,
  };

}


// ایجاد هش امن گذرواژه
function createPasswordHash(password) {

  // Salt تصادفی و اختصاصی هر کاربر
  const salt = crypto.randomBytes(16);

  // مشتق‌سازی هش گذرواژه
  const hash = crypto.scryptSync(
    password,
    salt,
    64,
    SCRYPT_OPTIONS
  );

  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex'),
  };

}


// ایجاد کد بازیابی تصادفی
function createRecoveryCode() {

  // تولید ۱۲۸ بیت تصادفی
  const rawCode = crypto
    .randomBytes(16)
    .toString('hex')
    .toUpperCase();

  // تقسیم کد به گروه‌های چهارحرفی برای خوانایی
  const recoveryCode = rawCode
    .match(/.{1,4}/g)
    .join('-');

  const salt = crypto.randomBytes(16);

  // کد بازیابی تصادفی و پرآنتروپی است؛
  // اثر SHA-256 آن همراه Salt ذخیره می‌شود.
  const hash = crypto
    .createHash('sha256')
    .update(salt)
    .update(rawCode)
    .digest('hex');

  return {
    recoveryCode,
    hash,
    salt: salt.toString('hex'),
  };

}


// ایجاد اولین مدیر سیستم
function createInitialAdmin(database, input) {

  // اعتبارسنجی مستقل در Main Process
  const {
    displayName,
    username,
    password,
  } = validateInitialAdminInput(input);


  // محاسبه اطلاعات امنیتی پیش از آغاز تراکنش
  const passwordData = createPasswordHash(password);

  const recoveryData = createRecoveryCode();

  // شناسه یکتای مدیر
  const userId = crypto.randomUUID();

  // زمان استاندارد UTC
  const createdAt = new Date().toISOString();


  // آغاز تراکنش انحصاری برای جلوگیری از ساخت هم‌زمان دو مدیر اولیه
  database.exec('BEGIN IMMEDIATE');

  try {

    // بررسی مجدد تعداد کاربران داخل تراکنش
    const result = database
      .prepare('SELECT COUNT(*) AS userCount FROM users')
      .get();

    if (Number(result.userCount) > 0) {
      throw new Error(
        'مدیر اولیه قبلاً ایجاد شده است.'
      );
    }


    // ثبت حساب مدیر اولیه
    database.prepare(`

      INSERT INTO users (

        id,
        username,
        display_name,

        password_hash,
        password_salt,

        role,
        is_active,
        must_change_password,

        failed_login_attempts,
        locked_until,
        last_login_at,
        password_changed_at,

        recovery_code_hash,
        recovery_code_salt,
        recovery_code_used_at,

        created_at,
        created_by_user_id,
        updated_at,
        updated_by_user_id

      )

      VALUES (

        ?, ?, ?,

        ?, ?,

        'admin',
        1,
        0,

        0,
        NULL,
        NULL,
        ?,

        ?, ?,
        NULL,

        ?,
        NULL,
        NULL,
        NULL

      )

    `).run(

      userId,
      username,
      displayName,

      passwordData.hash,
      passwordData.salt,

      createdAt,

      recoveryData.hash,
      recoveryData.salt,

      createdAt

    );


    // ثبت رویداد راه‌اندازی اولیه
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
      userId,
      username,
      displayName,

      'auth.initial_admin_created',
      'user',
      userId,

      JSON.stringify({
        role: 'admin',
        initialSetup: true,
      }),

      createdAt

    );


    // نهایی‌کردن تغییرات
    database.exec('COMMIT');


    // فقط اطلاعات غیرمحرمانه و کد بازیابی یک‌بارنمایش داده می‌شوند
    return {
      success: true,

      user: {
        id: userId,
        username,
        displayName,
        role: 'admin',
      },

      recoveryCode: recoveryData.recoveryCode,
    };

  } catch (error) {

    // لغو تمام تغییرات در صورت بروز خطا
    try {
      database.exec('ROLLBACK');
    } catch {
      // در صورت بسته بودن تراکنش، خطای دوم نادیده گرفته می‌شود
    }

    throw error;

  }

}


module.exports = {
  createInitialAdmin,
};
