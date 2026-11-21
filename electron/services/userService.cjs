
const crypto = require('node:crypto');

const {
  createPasswordHash,
} = require('./authService.cjs');


// فهرست مرکزی مجوزهای قابل اعطا به کاربران عادی
const PERMISSION_GROUPS = [

  {
    id: 'dashboard',
    label: 'داشبورد',
    permissions: [
      {
        key: 'dashboard.view',
        label: 'مشاهده داشبورد',
      },
    ],
  },

  {
    id: 'products',
    label: 'محصولات',
    permissions: [
      {
        key: 'products.view',
        label: 'مشاهده محصولات',
      },
      {
        key: 'products.create',
        label: 'ایجاد محصول',
      },
      {
        key: 'products.update',
        label: 'ویرایش محصول',
      },
      {
        key: 'products.prices.manage',
        label: 'مدیریت قیمت محصولات',
      },
      {
        key: 'products.deactivate',
        label: 'فعال و غیرفعال کردن محصول',
      },
    ],
  },

  {
    id: 'categories',
    label: 'دسته‌بندی‌ها',
    permissions: [
      {
        key: 'categories.view',
        label: 'مشاهده دسته‌بندی‌ها',
      },
      {
        key: 'categories.manage',
        label: 'مدیریت دسته‌بندی‌ها',
      },
    ],
  },

  {
    id: 'units',
    label: 'واحدهای اندازه‌گیری',
    permissions: [
      {
        key: 'units.view',
        label: 'مشاهده واحدها',
      },
      {
        key: 'units.manage',
        label: 'مدیریت واحدهای اندازه‌گیری',
      },
    ],
  },

  {
    id: 'inventory',
    label: 'انبار',
    permissions: [
      {
        key: 'inventory.view',
        label: 'مشاهده نمای کلی انبار',
      },
      {
        key: 'inventory.stock_list.view',
        label: 'مشاهده فهرست موجودی',
      },
      {
        key: 'inventory.opening.create',
        label: 'ثبت موجودی اولیه',
      },
      {
        key: 'inventory.entry.create',
        label: 'ثبت ورود کالا',
      },
      {
        key: 'inventory.adjustment.create',
        label: 'اصلاح موجودی',
      },
    ],
  },

];


// مجموعه کلیدهای مجاز برای کنترل سمت Main Process
const ALLOWED_PERMISSION_KEYS = new Set(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => permission.key)
  )
);


// اعتبارسنجی اطلاعات کاربر جدید
function validateNewUserInput(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات کاربر معتبر نیست.');
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

  const role = input.role;


  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error(
      'نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد.'
    );
  }


  if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
    throw new Error(
      'نام کاربری باید بین ۲ تا ۳۲ نویسه و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.'
    );
  }


  if (password.length < 8 || password.length > 128) {
    throw new Error(
      'گذرواژه باید حداقل ۸ و حداکثر ۱۲۸ نویسه باشد.'
    );
  }


  if (password !== confirmPassword) {
    throw new Error(
      'گذرواژه و تکرار آن یکسان نیستند.'
    );
  }


  if (!['admin', 'user'].includes(role)) {
    throw new Error('نقش کاربر معتبر نیست.');
  }


  const permissions = input.permissions ?? [];

  if (!Array.isArray(permissions)) {
    throw new Error('فهرست دسترسی‌های کاربر معتبر نیست.');
  }


  // جلوگیری از ثبت مجوز تکراری
  const uniquePermissions = [...new Set(permissions)];

  if (uniquePermissions.length !== permissions.length) {
    throw new Error('یک مجوز بیش از یک بار انتخاب شده است.');
  }


  // جلوگیری از ثبت مجوزهای تعریف‌نشده
  for (const permission of uniquePermissions) {

    if (
      typeof permission !== 'string' ||
      !ALLOWED_PERMISSION_KEYS.has(permission)
    ) {
      throw new Error(
        'یکی از دسترسی‌های انتخاب‌شده معتبر نیست.'
      );
    }

  }


  // مدیر سیستم تمام دسترسی‌ها را دارد و مجوز جداگانه نمی‌گیرد
  if (role === 'admin' && uniquePermissions.length > 0) {
    throw new Error(
      'برای مدیر سیستم نیازی به انتخاب دسترسی‌های جداگانه نیست.'
    );
  }


  return {
    displayName,
    username,
    password,
    role,
    permissions: uniquePermissions,
  };

}


// ثبت رویداد ایجاد کاربر
function writeUserCreatedAudit(
  database,
  actor,
  newUser,
  permissions
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

    actor.id,
    actor.username,
    actor.displayName,

    'users.created',
    'user',
    newUser.id,

    JSON.stringify({
      username: newUser.username,
      role: newUser.role,
      permissionCount: permissions.length,
    }),

    createdAt

  );

}


// ایجاد کاربر جدید
function createUser(database, actor, input) {

  const {
    displayName,
    username,
    password,
    role,
    permissions,
  } = validateNewUserInput(input);


  // تولید شناسه و اطلاعات امنیتی
  const userId = crypto.randomUUID();

  const passwordData = createPasswordHash(password);

  const createdAt = new Date().toISOString();


  // ثبت کاربر و دسترسی‌ها در یک تراکنش
  database.exec('BEGIN IMMEDIATE');

  try {

    // ایجاد حساب کاربری
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

        ?, 1, 0,

        0,
        NULL,
        NULL,
        ?,

        NULL,
        NULL,
        NULL,

        ?,
        ?,
        NULL,
        NULL

      )

    `).run(

      userId,
      username,
      displayName,

      passwordData.hash,
      passwordData.salt,

      role,

      createdAt,

      createdAt,
      actor.id

    );


    // ثبت مجوزهای کاربر عادی
    const insertPermission = database.prepare(`

      INSERT INTO user_permissions (

        user_id,
        permission_key,
        granted_at,
        granted_by_user_id

      )

      VALUES (?, ?, ?, ?)

    `);


    for (const permission of permissions) {

      insertPermission.run(
        userId,
        permission,
        createdAt,
        actor.id
      );

    }


    const newUser = {
      id: userId,
      username,
      displayName,
      role,
      isActive: true,
      createdAt,
    };


    // ثبت سابقه ایجاد کاربر
    writeUserCreatedAudit(
      database,
      actor,
      newUser,
      permissions
    );


    database.exec('COMMIT');


    return {
      ...newUser,
      permissions,
    };

  } catch (error) {

    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }


    // تبدیل خطای نام کاربری تکراری به پیام قابل فهم
    if (
      String(error.message).includes('users.username')
    ) {
      throw new Error(
        'این نام کاربری قبلاً ثبت شده است.',
        { cause: error }
      );
    }


    throw error;

  }

}


// دریافت فهرست کاربران
function getUsers(database) {

  const users = database.prepare(`

    SELECT

      id,
      username,
      display_name,
      role,
      is_active,
      must_change_password,
      last_login_at,
      created_at,

      created_by_user_id,
      updated_at

    FROM users

    ORDER BY created_at DESC

  `).all();


  const getPermissions = database.prepare(`

    SELECT permission_key

    FROM user_permissions

    WHERE user_id = ?

    ORDER BY permission_key

  `);


  return users.map((user) => ({

    id: user.id,

    username: user.username,

    displayName: user.display_name,

    role: user.role,

    isActive: Boolean(user.is_active),

    mustChangePassword: Boolean(
      user.must_change_password
    ),

    lastLoginAt: user.last_login_at,

    createdAt: user.created_at,

    createdByUserId: user.created_by_user_id,

    updatedAt: user.updated_at,

    permissions: getPermissions
      .all(user.id)
      .map((item) => item.permission_key),

  }));

}


// اعتبارسنجی اطلاعات ویرایش حساب کاربری
function validateUserUpdateInput(input) {

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

  const role = input.role;
  const permissions = input.permissions;

  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error(
      'نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد.'
    );
  }

  if (!['admin', 'user'].includes(role)) {
    throw new Error('نقش کاربر معتبر نیست.');
  }

  if (!Array.isArray(permissions)) {
    throw new Error('فهرست دسترسی‌های کاربر معتبر نیست.');
  }

  // حذف موارد تکراری و کنترل تعداد
  const uniquePermissions = [...new Set(permissions)];

  if (uniquePermissions.length !== permissions.length) {
    throw new Error('یک دسترسی بیش از یک بار انتخاب شده است.');
  }

  // بررسی اعتبار تک‌تک دسترسی‌ها
  for (const permission of uniquePermissions) {

    if (
      typeof permission !== 'string' ||
      !ALLOWED_PERMISSION_KEYS.has(permission)
    ) {
      throw new Error(
        'یکی از دسترسی‌های انتخاب‌شده معتبر نیست.'
      );
    }

  }

  // مدیر سیستم مجوزهای اختصاصی دریافت نمی‌کند
  if (role === 'admin' && uniquePermissions.length > 0) {
    throw new Error(
      'مدیر سیستم تمام دسترسی‌ها را دارد و نیازی به انتخاب مجوز جداگانه نیست.'
    );
  }

  return {
    displayName,
    role,
    permissions: uniquePermissions,
  };

}


// ثبت سابقه عملیات مدیریتی روی حساب کاربران
function writeUserManagementAudit(
  database,
  actor,
  actionKey,
  targetUserId,
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
    'user',
    targetUserId,

    JSON.stringify(details),
    createdAt

  );

}


// ویرایش اطلاعات و دسترسی‌های کاربر
function updateUser(database, actor, userId, input) {

  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('شناسه کاربر معتبر نیست.');
  }

  const {
    displayName,
    role,
    permissions,
  } = validateUserUpdateInput(input);

  const updatedAt = new Date().toISOString();

  // آغاز تراکنش
  database.exec('BEGIN IMMEDIATE');

  try {

    // دریافت اطلاعات فعلی کاربر
    const existingUser = database.prepare(`

      SELECT
        id,
        username,
        display_name,
        role,
        is_active

      FROM users

      WHERE id = ?

    `).get(userId);


    if (!existingUser) {
      throw new Error('کاربر موردنظر پیدا نشد.');
    }


    // جلوگیری از تغییر نقش حسابی که با آن وارد شده‌ایم
    if (
      actor.id === userId &&
      existingUser.role !== role
    ) {
      throw new Error(
        'امکان تغییر نقش حساب فعلی وجود ندارد.'
      );
    }

    // دریافت دسترسی‌های فعلی
    const currentPermissions = database.prepare(`

      SELECT permission_key

      FROM user_permissions

      WHERE user_id = ?

      ORDER BY permission_key

    `).all(userId).map((item) => item.permission_key);


    // تشخیص دسترسی‌های اضافه‌شده
    const addedPermissions = permissions.filter(
      (permission) => !currentPermissions.includes(permission)
    );


    // تشخیص دسترسی‌های حذف‌شده
    const removedPermissions = currentPermissions.filter(
      (permission) => !permissions.includes(permission)
    );


    const nameChanged =
      existingUser.display_name !== displayName;

    const roleChanged =
      existingUser.role !== role;

    const permissionsChanged =
      addedPermissions.length > 0 ||
      removedPermissions.length > 0;


    // جلوگیری از ثبت تغییرات غیرضروری
    if (
      !nameChanged &&
      !roleChanged &&
      !permissionsChanged
    ) {

      database.exec('COMMIT');

      return getUsers(database).find(
        (user) => user.id === userId
      );

    }


    // به‌روزرسانی اطلاعات اصلی حساب
    database.prepare(`

      UPDATE users

      SET
        display_name = ?,
        role = ?,
        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      displayName,
      role,
      updatedAt,
      actor.id,
      userId
    );


    // حذف دسترسی‌های قبلی
    database.prepare(`

      DELETE FROM user_permissions

      WHERE user_id = ?

    `).run(userId);


    // آماده‌سازی دستور ثبت دسترسی‌ها
    const insertPermission = database.prepare(`

      INSERT INTO user_permissions (

        user_id,
        permission_key,
        granted_at,
        granted_by_user_id

      )

      VALUES (?, ?, ?, ?)

    `);


    // ثبت دسترسی‌های جدید
    for (const permission of permissions) {

      insertPermission.run(
        userId,
        permission,
        updatedAt,
        actor.id
      );

    }


    // ثبت سابقه تغییرات
    writeUserManagementAudit(
      database,
      actor,
      'users.updated',
      userId,
      {
        before: {
          displayName: existingUser.display_name,
          role: existingUser.role,
          permissions: currentPermissions,
        },

        after: {
          displayName,
          role,
          permissions,
        },

        addedPermissions,
        removedPermissions,
      },
      updatedAt
    );


    // نهایی‌کردن تراکنش
    database.exec('COMMIT');


    // بازگرداندن اطلاعات جدید کاربر
    return getUsers(database).find(
      (user) => user.id === userId
    );


  } catch (error) {

    // بازگرداندن تغییرات در صورت بروز خطا
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;

  }

}


// فعال یا غیرفعال کردن حساب کاربری
function setUserActive(database, actor, userId, isActive) {

  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('شناسه کاربر معتبر نیست.');
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('وضعیت حساب کاربری معتبر نیست.');
  }

  const updatedAt = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');

  try {

    // دریافت اطلاعات حساب
    const targetUser = database.prepare(`

      SELECT
        id,
        username,
        display_name,
        role,
        is_active

      FROM users

      WHERE id = ?

    `).get(userId);


    if (!targetUser) {
      throw new Error('کاربر موردنظر پیدا نشد.');
    }


    // جلوگیری از غیرفعال کردن حساب فعلی
    if (
      actor.id === userId &&
      isActive === false
    ) {
      throw new Error(
        'نمی‌توانی حسابی را که با آن وارد شده‌ای غیرفعال کنی.'
      );
    }


    // اگر وضعیت حساب از قبل همین باشد، کاری انجام نمی‌دهیم
    if (Boolean(targetUser.is_active) === isActive) {

      database.exec('COMMIT');

      return getUsers(database).find(
        (user) => user.id === userId
      );

    }



    // تغییر وضعیت حساب
    database.prepare(`

      UPDATE users

      SET
        is_active = ?,
        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(
      isActive ? 1 : 0,
      updatedAt,
      actor.id,
      userId
    );


    // ثبت سابقه عملیات
    writeUserManagementAudit(
      database,
      actor,
      isActive
        ? 'users.reactivated'
        : 'users.deactivated',
      userId,
      {
        username: targetUser.username,
        previousStatus: Boolean(targetUser.is_active),
        newStatus: isActive,
      },
      updatedAt
    );


    database.exec('COMMIT');


    // بازگرداندن اطلاعات به‌روز کاربر
    return getUsers(database).find(
      (user) => user.id === userId
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


// دریافت فهرست مجوزها برای رابط کاربری
function getPermissionCatalog() {

  // برگرداندن نسخه‌ای مستقل از آرایه اصلی
  return PERMISSION_GROUPS.map((group) => ({

    id: group.id,

    label: group.label,

    permissions: group.permissions.map((permission) => ({
      key: permission.key,
      label: permission.label,
    })),

  }));

}

module.exports = {
  createUser,
  getUsers,
  getPermissionCatalog,
  updateUser,
  setUserActive,
};