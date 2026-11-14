
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


// بررسی گذرواژه واردشده با هش ذخیره‌شده
function verifyPassword(password, user) {

  try {

    const salt = Buffer.from(user.password_salt, 'hex');
    const storedHash = Buffer.from(user.password_hash, 'hex');

    // بررسی ساختار اطلاعات امنیتی ذخیره‌شده
    if (salt.length !== 16 || storedHash.length !== 64) {
      return false;
    }

    // محاسبه هش گذرواژه واردشده
    const candidateHash = crypto.scryptSync(
      password,
      salt,
      64,
      SCRYPT_OPTIONS
    );

    // مقایسه امن دو هش
    return crypto.timingSafeEqual(
      candidateHash,
      storedHash
    );

  } catch {

    return false;

  }

}


// ثبت رویداد مربوط به کاربر در دفتر سوابق
function writeUserAudit(
  database,
  user,
  actionKey,
  details = {}
) {

  const createdAt = new Date().toISOString();

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
    user.id,
    user.username,
    user.display_name,

    actionKey,
    'user',
    user.id,

    JSON.stringify(details),
    createdAt

  );

}


// ثبت تلاش ناموفق ورود
function recordFailedLogin(database, user) {

  const now = Date.now();

  // اگر محدودیت قبلی منقضی شده باشد، شمارنده از نو آغاز می‌شود
  const previousLockExpired =
    user.locked_until &&
    Date.parse(user.locked_until) <= now;

  const previousAttempts = previousLockExpired
    ? 0
    : Number(user.failed_login_attempts || 0);

  const nextAttempts = previousAttempts + 1;

  const lockedUntil = nextAttempts >= 5
    ? new Date(now + 2 * 60 * 1000).toISOString()
    : null;

  database.exec('BEGIN IMMEDIATE');

  try {

    database.prepare(`

      UPDATE users

      SET
        failed_login_attempts = ?,
        locked_until = ?

      WHERE id = ?

    `).run(
      nextAttempts,
      lockedUntil,
      user.id
    );


    writeUserAudit(
      database,
      user,
      'auth.login_failed',
      {
        failedAttempts: nextAttempts,
        accountLocked: Boolean(lockedUntil),
      }
    );


    database.exec('COMMIT');

  } catch (error) {

    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;

  }

  return {
    locked: Boolean(lockedUntil),
  };

}


// بررسی اطلاعات ورود کاربر
function authenticateUser(database, input) {

  // کنترل ساختار اطلاعات ورودی
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      message: 'اطلاعات ورود معتبر نیست.',
    };
  }


  // یکسان‌سازی نام کاربری
  const username =
    typeof input.username === 'string'
      ? input.username.trim().toLowerCase()
      : '';

  const password =
    typeof input.password === 'string'
      ? input.password
      : '';


  if (
    !/^[a-z0-9._-]{3,32}$/.test(username) ||
    password.length === 0 ||
    password.length > 128
  ) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'نام کاربری یا گذرواژه صحیح نیست.',
    };
  }


  // دریافت حساب کاربری
  const user = database.prepare(`

    SELECT

      id,
      username,
      display_name,

      password_hash,
      password_salt,

      role,
      is_active,
      must_change_password,

      failed_login_attempts,
      locked_until

    FROM users

    WHERE username = ?

  `).get(username);


  // پاسخ یکسان برای نام کاربری ناشناخته
  if (!user) {

    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'نام کاربری یا گذرواژه صحیح نیست.',
    };

  }


  // بررسی محدودیت زمانی ورود
  if (
    user.locked_until &&
    Date.parse(user.locked_until) > Date.now()
  ) {

    return {
      success: false,
      code: 'ACCOUNT_LOCKED',
      message: 'تعداد تلاش‌های ناموفق زیاد بوده است. دو دقیقه دیگر دوباره تلاش کن.',
    };

  }


  // بررسی گذرواژه
  const passwordIsValid = verifyPassword(
    password,
    user
  );


  if (!passwordIsValid) {

    const failure = recordFailedLogin(
      database,
      user
    );

    return {
      success: false,

      code: failure.locked
        ? 'ACCOUNT_LOCKED'
        : 'INVALID_CREDENTIALS',

      message: failure.locked
        ? 'به دلیل پنج تلاش ناموفق، ورود به مدت دو دقیقه محدود شد.'
        : 'نام کاربری یا گذرواژه صحیح نیست.',
    };

  }


  // جلوگیری از ورود حساب غیرفعال
  if (!user.is_active) {

    database.exec('BEGIN IMMEDIATE');

    try {

      writeUserAudit(
        database,
        user,
        'auth.login_blocked',
        {
          reason: 'account_disabled',
        }
      );

      database.exec('COMMIT');

    } catch (error) {

      try {
        database.exec('ROLLBACK');
      } catch {
        // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
      }

      throw error;

    }

    return {
      success: false,
      code: 'ACCOUNT_DISABLED',
      message: 'این حساب کاربری غیرفعال است. با مدیر سیستم تماس بگیر.',
    };

  }


  // ورود موفق
  const loginTime = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    // پاک‌کردن تلاش‌های ناموفق قبلی
    database.prepare(`

      UPDATE users

      SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = ?

      WHERE id = ?

    `).run(
      loginTime,
      user.id
    );


    // ثبت سابقه ورود موفق
    writeUserAudit(
      database,
      user,
      'auth.login_succeeded',
      {
        role: user.role,
      }
    );


    database.exec('COMMIT');

  } catch (error) {

    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;

  }


  // فقط اطلاعات غیرمحرمانه به Renderer بازگردانده می‌شود
  return {

    success: true,

    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      mustChangePassword: Boolean(
        user.must_change_password
      ),
    },

  };

}


// دریافت اطلاعات امن کاربر از روی شناسه نشست
function getSessionUser(database, userId) {

  const user = database.prepare(`

    SELECT
      id,
      username,
      display_name,
      role,
      must_change_password

    FROM users

    WHERE id = ?
      AND is_active = 1

  `).get(userId);


  if (!user) {
    return null;
  }


  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: Boolean(
      user.must_change_password
    ),
  };

}


// ثبت خروج کاربر
function recordLogout(database, userId) {

  const user = database.prepare(`

    SELECT
      id,
      username,
      display_name

    FROM users

    WHERE id = ?

  `).get(userId);


  if (!user) {
    return;
  }


  database.exec('BEGIN IMMEDIATE');

  try {

    writeUserAudit(
      database,
      user,
      'auth.logout'
    );

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

module.exports = {
  createInitialAdmin,
  authenticateUser,
  getSessionUser,
  recordLogout,
};