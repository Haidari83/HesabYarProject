
// دریافت فهرست مرکزی مجوزهای تعریف‌شده در برنامه
const {
  getPermissionCatalog,
} = require('./userService.cjs');


// ساخت مجموعه کلیدهای معتبر مجوزها
const ALLOWED_PERMISSION_KEYS = new Set(

  getPermissionCatalog().flatMap((group) =>
    group.permissions.map(
      (permission) => permission.key
    )
  )

);


// بررسی مجوز کاربر برای انجام یک عملیات
function assertPermission(
  database,
  actor,
  permissionKey
) {

  // اعتبارسنجی هویت کاربر
  if (
    !actor ||
    typeof actor.id !== 'string' ||
    !['admin', 'user'].includes(actor.role)
  ) {
    throw new Error(
      'نشست کاربر برای بررسی دسترسی معتبر نیست.'
    );
  }


  // جلوگیری از استفاده از کلیدهای تعریف‌نشده
  if (
    typeof permissionKey !== 'string' ||
    !ALLOWED_PERMISSION_KEYS.has(permissionKey)
  ) {
    throw new Error(
      'مجوز درخواستی در سیستم تعریف نشده است.'
    );
  }


  // مدیر سیستم تمام مجوزها را دارد
  if (actor.role === 'admin') {
    return true;
  }


  // بررسی مستقیم مجوز در SQLite
  const permission = database.prepare(`

    SELECT 1 AS allowed

    FROM user_permissions

    WHERE user_id = ?
      AND permission_key = ?

  `).get(
    actor.id,
    permissionKey
  );


  // رد عملیات در صورت نداشتن مجوز
  if (!permission) {
    throw new Error(
      'برای انجام این عملیات مجوز لازم را نداری.'
    );
  }


  return true;

}


module.exports = {
  assertPermission,
};
