
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
        label: 'مدیریت واحدها و تبدیل‌ها',
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


  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error(
      'نام کاربری باید بین ۳ تا ۳۲ نویسه و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.'
    );
  }


  if (password.length < 12 || password.length > 128) {
    throw new Error(
      'گذرواژه باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.'
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
};
