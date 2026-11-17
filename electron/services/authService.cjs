
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


// دریافت کلیدهای دسترسی اختصاصی یک کاربر
function getUserPermissionKeys(database, userId) {

  return database.prepare(`

    SELECT permission_key

    FROM user_permissions

    WHERE user_id = ?

    ORDER BY permission_key

  `).all(userId).map(
    (item) => item.permission_key
  );

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


// دریافت اطلاعات امنیتی حساب فعال
function getActiveSecurityUser(database, userId) {

  return database.prepare(`

    SELECT
      id,
      username,
      display_name,
      password_hash,
      password_salt,
      role,
      is_active,
      failed_login_attempts,
      locked_until,
      pin_verifier,
      pin_failed_attempts,
      pin_locked_until

    FROM users

    WHERE id = ?
      AND is_active = 1

  `).get(userId);

}


// بررسی گذرواژه فعلی برای عملیات حساس
function verifyCurrentPassword(database, user, currentPassword) {

  if (
    typeof currentPassword !== 'string' ||
    currentPassword.length === 0 ||
    currentPassword.length > 128
  ) {
    throw new Error('گذرواژه فعلی را وارد کن.');
  }

  // احترام به قفل موقت ورود با گذرواژه
  if (
    user.locked_until &&
    Date.parse(user.locked_until) > Date.now()
  ) {
    throw new Error(
      'به دلیل تلاش‌های ناموفق، تغییر اطلاعات فعلاً محدود شده است.'
    );
  }

  if (!verifyPassword(currentPassword, user)) {

    // ثبت تلاش ناموفق و اعمال محدودیت موجود
    recordFailedLogin(database, user);

    throw new Error('گذرواژه فعلی صحیح نیست.');

  }

}


// ثبت تلاش ناموفق ورود با PIN
function recordFailedPinLogin(database, user) {

  const now = Date.now();

  // اگر قفل قبلی منقضی شده باشد، شمارنده از نو آغاز می‌شود
  const previousLockExpired =
    user.pin_locked_until &&
    Date.parse(user.pin_locked_until) <= now;

  const previousAttempts = previousLockExpired
    ? 0
    : Number(user.pin_failed_attempts || 0);

  const nextAttempts = previousAttempts + 1;

  // پس از پنج تلاش ناموفق، PIN به مدت دو دقیقه قفل می‌شود
  const lockedUntil = nextAttempts >= 5
    ? new Date(now + 2 * 60 * 1000).toISOString()
    : null;

  database.exec('BEGIN IMMEDIATE');

  try {

    database.prepare(`

      UPDATE users

      SET
        pin_failed_attempts = ?,
        pin_locked_until = ?

      WHERE id = ?

    `).run(
      nextAttempts,
      lockedUntil,
      user.id
    );


    writeUserAudit(
      database,
      user,
      'auth.pin_login_failed',
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


// ساخت PIN رمزگذاری‌شده برای نگهداری در پایگاه داده
async function createEncryptedPinVerifier(pin, safeStorage) {

  if (
    !safeStorage ||
    typeof safeStorage.isAsyncEncryptionAvailable !== 'function' ||
    typeof safeStorage.encryptStringAsync !== 'function'
  ) {
    throw new Error(
      'سرویس امن ذخیره‌سازی PIN در دسترس نیست.'
    );
  }

  const encryptionAvailable =
    await safeStorage.isAsyncEncryptionAvailable();

  if (!encryptionAvailable) {
    throw new Error(
      'رمزگذاری امن PIN در سیستم‌عامل در دسترس نیست.'
    );
  }

  // هش PIN با همان الگوریتم امن گذرواژه
  const pinData = createPasswordHash(pin);

  const verifier = JSON.stringify({
    salt: pinData.salt,
    hash: pinData.hash,
  });

  // محافظت از نتیجه هش با کلید سیستم‌عامل
  const encrypted = await safeStorage.encryptStringAsync(
    verifier
  );

  return encrypted.toString('base64');

}


// بررسی PIN واردشده
async function verifyEncryptedPin(
  database,
  user,
  pin,
  safeStorage
) {

  if (
    !safeStorage ||
    typeof safeStorage.isAsyncEncryptionAvailable !== 'function' ||
    typeof safeStorage.decryptStringAsync !== 'function'
  ) {
    throw new Error(
      'سرویس بازیابی امن PIN در دسترس نیست.'
    );
  }

  const encryptionAvailable =
    await safeStorage.isAsyncEncryptionAvailable();

  if (!encryptionAvailable) {
    throw new Error(
      'رمزگذاری امن PIN در سیستم‌عامل در دسترس نیست.'
    );
  }

  // تبدیل متن ذخیره‌شده به Buffer
  const encrypted = Buffer.from(
    user.pin_verifier,
    'base64'
  );

  if (encrypted.length === 0) {
    throw new Error('اطلاعات ذخیره‌شده PIN معتبر نیست.');
  }

  // بازیابی اطلاعات رمزگذاری‌شده
  const decrypted = await safeStorage.decryptStringAsync(
    encrypted
  );

  let verifier;

  try {
    verifier = JSON.parse(decrypted.result);
  } catch {
    throw new Error('ساختار اطلاعات PIN معتبر نیست.');
  }

  // بررسی ساختار Salt و Hash
  if (
    !/^[a-f0-9]{32}$/i.test(verifier?.salt || '') ||
    !/^[a-f0-9]{128}$/i.test(verifier?.hash || '')
  ) {
    throw new Error('اطلاعات امنیتی PIN آسیب دیده است.');
  }

  const salt = Buffer.from(verifier.salt, 'hex');
  const storedHash = Buffer.from(verifier.hash, 'hex');

  const candidateHash = crypto.scryptSync(
    pin,
    salt,
    64,
    SCRYPT_OPTIONS
  );

  const isValid = crypto.timingSafeEqual(
    candidateHash,
    storedHash
  );


  // در صورت چرخش کلید، اطلاعات با کلید جدید ذخیره می‌شود
  if (decrypted.shouldReEncrypt) {

    const reEncrypted = await safeStorage.encryptStringAsync(
      decrypted.result
    );

    database.prepare(`

      UPDATE users

      SET pin_verifier = ?

      WHERE id = ?

    `).run(
      reEncrypted.toString('base64'),
      user.id
    );

  }

  return isValid;

}




// بررسی اطلاعات ورود کاربر با گذرواژه اصلی یا PIN
async function authenticateUser(
  database,
  input,
  safeStorage
) {

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


  const username =
    typeof input.username === 'string'
      ? input.username.trim().toLowerCase()
      : '';

  // برای سازگاری با فرم ورود قبلی، روش پیش‌فرض password است
  const method = input.method ?? 'password';

  if (
    !/^[a-z0-9._-]{3,32}$/.test(username) ||
    !['password', 'pin'].includes(method)
  ) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'اطلاعات ورود معتبر نیست.',
    };
  }


  // دریافت اطلاعات حساب
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
      locked_until,

      pin_verifier,
      pin_failed_attempts,
      pin_locked_until

    FROM users

    WHERE username = ?

  `).get(username);


  if (!user) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'نام کاربری یا رمز ورود صحیح نیست.',
    };
  }


  // ==================================
  // ورود با PIN
  // ==================================
  if (method === 'pin') {

    const pin =
      typeof input.pin === 'string'
        ? input.pin
        : '';

    if (!/^[0-9]{5}$/.test(pin)) {
      return {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'PIN باید دقیقاً پنج رقم انگلیسی باشد.',
      };
    }


    // بررسی قفل موقت PIN
    if (
      user.pin_locked_until &&
      Date.parse(user.pin_locked_until) > Date.now()
    ) {
      return {
        success: false,
        code: 'PIN_ACCOUNT_LOCKED',
        message: 'ورود با PIN موقتاً قفل شده است. دو دقیقه دیگر تلاش کن.',
      };
    }


    if (!user.pin_verifier) {
      return {
        success: false,
        code: 'PIN_NOT_CONFIGURED',
        message: 'برای این حساب هنوز PIN تنظیم نشده است. با گذرواژه اصلی وارد شو.',
      };
    }

    let pinIsValid;
    try {

      pinIsValid = await verifyEncryptedPin(
        database,
        user,
        pin,
        safeStorage
      );

    } catch {

      // در صورت اشکال در رمزگشایی، ورود با گذرواژه همچنان ممکن است
      return {
        success: false,
        code: 'PIN_UNAVAILABLE',
        message: 'بازیابی PIN ممکن نشد. با گذرواژه اصلی وارد شو و PIN را دوباره تنظیم کن.',
      };

    }


    if (!pinIsValid) {

      const failure = recordFailedPinLogin(
        database,
        user
      );

      return {
        success: false,

        code: failure.locked
          ? 'PIN_ACCOUNT_LOCKED'
          : 'INVALID_CREDENTIALS',

        message: failure.locked
          ? 'پنج تلاش ناموفق انجام شد. ورود با PIN به مدت دو دقیقه قفل شد.'
          : 'نام کاربری یا PIN صحیح نیست.',
      };

    }

  }


  // ==================================
  // ورود با گذرواژه اصلی
  // ==================================
  else {

    const password =
      typeof input.password === 'string'
        ? input.password
        : '';

    if (
      password.length === 0 ||
      password.length > 128
    ) {
      return {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'نام کاربری یا گذرواژه صحیح نیست.',
      };
    }


    // بررسی قفل ورود با گذرواژه
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
          method,
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

    if (method === 'pin') {

      // پاک‌کردن فقط تلاش‌های ناموفق PIN
      database.prepare(`

        UPDATE users

        SET
          pin_failed_attempts = 0,
          pin_locked_until = NULL,
          last_login_at = ?

        WHERE id = ?

      `).run(
        loginTime,
        user.id
      );

    } else {

      // پاک‌کردن فقط تلاش‌های ناموفق گذرواژه
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

    }


    // ثبت نوع ورود موفق
    writeUserAudit(
      database,
      user,
      method === 'pin'
        ? 'auth.pin_login_succeeded'
        : 'auth.login_succeeded',
      {
        role: user.role,
        method,
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

    success: true,

    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,

      mustChangePassword: Boolean(
        user.must_change_password
      ),

      permissions: getUserPermissionKeys(
        database,
        user.id
      ),

      // فقط وضعیت تنظیم بودن PIN ارسال می‌شود، نه اطلاعات PIN
      hasPin: Boolean(user.pin_verifier),
    },

  };

}


// تغییر نام کاربری حساب فعلی
function changeUsername(database, actor, input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات ارسالی معتبر نیست.');
  }

  const currentPassword = input.currentPassword;

  const newUsername =
    typeof input.newUsername === 'string'
      ? input.newUsername.trim().toLowerCase()
      : '';

  if (!/^[a-z0-9._-]{3,32}$/.test(newUsername)) {
    throw new Error(
      'نام کاربری باید بین ۳ تا ۳۲ نویسه و شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.'
    );
  }

  const user = getActiveSecurityUser(
    database,
    actor.id
  );

  if (!user) {
    throw new Error('حساب کاربری فعال پیدا نشد.');
  }

  verifyCurrentPassword(
    database,
    user,
    currentPassword
  );

  if (newUsername === user.username) {
    return {
      success: true,
      username: user.username,
      changed: false,
    };
  }

  const updatedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    // بررسی تکراری نبودن نام کاربری
    const duplicate = database.prepare(`

      SELECT 1

      FROM users

      WHERE username = ?
        AND id <> ?

    `).get(
      newUsername,
      user.id
    );

    if (duplicate) {
      throw new Error(
        'این نام کاربری قبلاً توسط حساب دیگری انتخاب شده است.'
      );
    }


    // تغییر نام کاربری
    database.prepare(`

      UPDATE users

      SET
        username = ?,
        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      newUsername,
      updatedAt,
      actor.id,
      user.id
    );


    // ثبت سابقه تغییر نام کاربری
    writeUserAudit(
      database,
      user,
      'auth.username_changed',
      {
        previousUsername: user.username,
        newUsername,
      }
    );


    database.exec('COMMIT');

    return {
      success: true,
      username: newUsername,
      changed: true,
    };

  } catch (error) {

    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    // کنترل نهایی برخورد با محدودیت یکتایی SQLite
    if (
      String(error.message).includes(
        'UNIQUE constraint failed: users.username'
      )
    ) {
      throw new Error(
        'این نام کاربری قبلاً توسط حساب دیگری انتخاب شده است.',
        { cause: error }
      );
    }

    throw error;

  }

}


// تغییر گذرواژه اصلی حساب فعلی
function changePassword(database, actor, input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات ارسالی معتبر نیست.');
  }

  const currentPassword = input.currentPassword;

  const newPassword =
    typeof input.newPassword === 'string'
      ? input.newPassword
      : '';

  const confirmPassword =
    typeof input.confirmPassword === 'string'
      ? input.confirmPassword
      : '';

  const user = getActiveSecurityUser(
    database,
    actor.id
  );

  if (!user) {
    throw new Error('حساب کاربری فعال پیدا نشد.');
  }

  verifyCurrentPassword(
    database,
    user,
    currentPassword
  );


  if (
    newPassword.length < 12 ||
    newPassword.length > 128
  ) {
    throw new Error(
      'گذرواژه جدید باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.'
    );
  }

  if (newPassword !== confirmPassword) {
    throw new Error(
      'گذرواژه جدید و تکرار آن یکسان نیستند.'
    );
  }

  if (verifyPassword(newPassword, user)) {
    throw new Error(
      'گذرواژه جدید نباید با گذرواژه فعلی یکسان باشد.'
    );
  }


  // محاسبه هش جدید پیش از آغاز تراکنش
  const passwordData = createPasswordHash(
    newPassword
  );

  const changedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    database.prepare(`

      UPDATE users

      SET
        password_hash = ?,
        password_salt = ?,
        password_changed_at = ?,

        failed_login_attempts = 0,
        locked_until = NULL,

        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      passwordData.hash,
      passwordData.salt,
      changedAt,
      changedAt,
      actor.id,
      user.id
    );


    // ثبت رویداد بدون ثبت گذرواژه یا هش آن
    writeUserAudit(
      database,
      user,
      'auth.password_changed',
      {
        changedAt,
      }
    );


    database.exec('COMMIT');

    return {
      success: true,
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


// تنظیم یا تغییر PIN پنج‌رقمی
async function setUserPin(
  database,
  actor,
  input,
  safeStorage
) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات ارسالی معتبر نیست.');
  }

  const currentPassword = input.currentPassword;

  const pin =
    typeof input.pin === 'string'
      ? input.pin
      : '';

  const confirmPin =
    typeof input.confirmPin === 'string'
      ? input.confirmPin
      : '';

  const user = getActiveSecurityUser(
    database,
    actor.id
  );

  if (!user) {
    throw new Error('حساب کاربری فعال پیدا نشد.');
  }

  verifyCurrentPassword(
    database,
    user,
    currentPassword
  );


  if (!/^[0-9]{5}$/.test(pin)) {
    throw new Error(
      'PIN باید دقیقاً پنج رقم انگلیسی باشد.'
    );
  }

  if (pin !== confirmPin) {
    throw new Error(
      'PIN و تکرار آن یکسان نیستند.'
    );
  }


  // ساخت و رمزگذاری اطلاعات PIN
  const encryptedVerifier = await createEncryptedPinVerifier(
    pin,
    safeStorage
  );

  const changedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    const latestUser = getActiveSecurityUser(
      database,
      actor.id
    );

    if (
      !latestUser ||
      latestUser.password_hash !== user.password_hash ||
      latestUser.password_salt !== user.password_salt
    ) {
      throw new Error(
        'اطلاعات حساب در حین عملیات تغییر کرده است. دوباره تلاش کن.'
      );
    }


    // تعیین رویداد متناسب با وضعیت قبلی PIN
    const actionKey = latestUser.pin_verifier
      ? 'auth.pin_changed'
      : 'auth.pin_set';


    database.prepare(`

      UPDATE users

      SET
        pin_verifier = ?,

        pin_failed_attempts = 0,
        pin_locked_until = NULL,

        pin_changed_at = ?,

        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      encryptedVerifier,
      changedAt,
      changedAt,
      actor.id,
      actor.id
    );


    // ثبت سابقه تنظیم یا تغییر PIN
    writeUserAudit(
      database,
      user,
      actionKey,
      {
        pinConfigured: true,
        changedAt,
      }
    );


    database.exec('COMMIT');

    return {
      success: true,
      hasPin: true,
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


// حذف PIN حساب فعلی
function removeUserPin(database, actor, input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات ارسالی معتبر نیست.');
  }

  const user = getActiveSecurityUser(
    database,
    actor.id
  );

  if (!user) {
    throw new Error('حساب کاربری فعال پیدا نشد.');
  }

  verifyCurrentPassword(
    database,
    user,
    input.currentPassword
  );


  if (!user.pin_verifier) {
    throw new Error(
      'برای این حساب PIN تنظیم نشده است.'
    );
  }


  const changedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    database.prepare(`

      UPDATE users

      SET
        pin_verifier = NULL,

        pin_failed_attempts = 0,
        pin_locked_until = NULL,

        pin_changed_at = ?,

        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      changedAt,
      changedAt,
      actor.id,
      actor.id
    );


    // ثبت رویداد حذف PIN
    writeUserAudit(
      database,
      user,
      'auth.pin_removed',
      {
        pinConfigured: false,
        changedAt,
      }
    );


    database.exec('COMMIT');

    return {
      success: true,
      hasPin: false,
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



// دریافت اطلاعات امن کاربر از روی شناسه نشست
function getSessionUser(database, userId) {

  const user = database.prepare(`

    SELECT
      id,
      username,
      display_name,
      role,
      must_change_password
      pin_verifier

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
    // دریافت مجوزهای فعلی از پایگاه داده
    permissions: getUserPermissionKeys(
      database,
      user.id
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
  createPasswordHash,

  changeUsername,
  changePassword,
  setUserPin,
  removeUserPin,
};