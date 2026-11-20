
const crypto = require('node:crypto');

const {
  assertPermission,
} = require('./authorizationService.cjs');


// یکسان‌سازی نام دسته‌بندی برای تشخیص نام‌های مشابه
function normalizeCategoryName(value) {

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


// اعتبارسنجی اطلاعات ورودی دسته‌بندی
function validateCategoryInput(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('اطلاعات دسته‌بندی معتبر نیست.');
  }


  const name =
    typeof input.name === 'string'
      ? input.name.trim()
      : '';


  const description =
    input.description === undefined ||
      input.description === null
      ? ''
      : typeof input.description === 'string'
        ? input.description.trim()
        : null;


  if (!name) {
    throw new Error('نام دسته‌بندی را وارد کنید.');
  }


  if (description === null) {
    throw new Error('توضیحات دسته‌بندی معتبر نیست.');
  }


  const normalizedName = normalizeCategoryName(name);


  if (!normalizedName) {
    throw new Error('نام دسته‌بندی معتبر نیست.');
  }


  return {
    name,
    normalizedName,
    description,
  };

}


// دریافت یک دسته‌بندی همراه با تعداد کالاهای وابسته
function selectCategoryById(database, categoryId) {

  const category = database.prepare(`

    SELECT

      c.id,
      c.name,
      c.description,
      c.normalized_name,
      c.is_active,

      c.created_at,
      c.created_by_user_id,

      c.updated_at,
      c.updated_by_user_id,

      COUNT(p.id) AS product_count

    FROM categories c

    LEFT JOIN products p
      ON p.category_id = c.id

    WHERE c.id = ?

    GROUP BY c.id

  `).get(categoryId);


  if (!category) {
    return null;
  }


  return {

    id: category.id,

    name: category.name,

    description: category.description || '',

    isActive: Boolean(category.is_active),

    createdAt: category.created_at,

    createdByUserId: category.created_by_user_id,

    updatedAt: category.updated_at,

    updatedByUserId: category.updated_by_user_id,

    productCount: Number(category.product_count),

  };

}


// ثبت سابقه عملیات دسته‌بندی
function writeCategoryAudit(
  database,
  actor,
  actionKey,
  categoryId,
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
    'category',
    categoryId,

    JSON.stringify(details),

    createdAt

  );

}


// بررسی تکراری بودن نام دسته‌بندی
function findDuplicateCategory(
  database,
  normalizedName,
  excludedId = null
) {

  if (excludedId) {

    return database.prepare(`

      SELECT id

      FROM categories

      WHERE normalized_name = ?
        AND id <> ?

      LIMIT 1

    `).get(
      normalizedName,
      excludedId
    );

  }


  return database.prepare(`

    SELECT id

    FROM categories

    WHERE normalized_name = ?

    LIMIT 1

  `).get(normalizedName);

}


// دریافت فهرست دسته‌بندی‌ها
function getCategories(database, actor) {

  // بررسی مجوز مشاهده دسته‌بندی‌ها
  assertPermission(
    database,
    actor,
    'categories.view'
  );


  const categories = database.prepare(`

    SELECT

      c.id,
      c.name,
      c.description,
      c.is_active,

      c.created_at,
      c.created_by_user_id,

      c.updated_at,
      c.updated_by_user_id,

      COUNT(p.id) AS product_count

    FROM categories c

    LEFT JOIN products p
      ON p.category_id = c.id

    GROUP BY c.id

    ORDER BY
      c.created_at ASC,
      c.name COLLATE NOCASE ASC

  `).all();


  return categories.map((category) => ({

    id: category.id,

    name: category.name,

    description: category.description || '',

    isActive: Boolean(category.is_active),

    createdAt: category.created_at,

    createdByUserId: category.created_by_user_id,

    updatedAt: category.updated_at,

    updatedByUserId: category.updated_by_user_id,

    productCount: Number(category.product_count),

  }));

}


// ایجاد یک یا چند دسته‌بندی
function createCategories(database, actor, inputs) {

  // بررسی مجوز مدیریت دسته‌بندی‌ها
  assertPermission(
    database,
    actor,
    'categories.manage'
  );


  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('حداقل یک دسته‌بندی باید ارسال شود.');
  }


  // اعتبارسنجی تمام ردیف‌ها پیش از آغاز ثبت
  const validatedCategories = inputs.map(
    validateCategoryInput
  );


  // بررسی تکراری نبودن نام‌ها در همان درخواست
  const batchNames = new Set();

  for (const category of validatedCategories) {

    if (batchNames.has(category.normalizedName)) {
      throw new Error(
        `نام دسته‌بندی «${category.name}» در فهرست ارسالی تکراری است.`
      );
    }

    batchNames.add(category.normalizedName);

  }


  const createdAt = new Date().toISOString();

  const createdIds = [];


  // آغاز تراکنش ثبت دسته‌بندی‌ها
  database.exec('BEGIN IMMEDIATE');

  try {

    const insertCategory = database.prepare(`

      INSERT INTO categories (

        id,
        name,
        normalized_name,
        description,

        is_active,

        created_at,
        created_by_user_id,

        updated_at,
        updated_by_user_id

      )

      VALUES (?, ?, ?, ?, 1, ?, ?, NULL, NULL)

    `);


    // ثبت تک‌تک دسته‌بندی‌ها
    for (const category of validatedCategories) {

      // جلوگیری از تکرار نام در کل پایگاه داده
      const duplicate = findDuplicateCategory(
        database,
        category.normalizedName
      );


      if (duplicate) {
        throw new Error(
          `دسته‌بندی «${category.name}» قبلاً ثبت شده است.`
        );
      }


      const categoryId = crypto.randomUUID();


      insertCategory.run(

        categoryId,

        category.name,

        category.normalizedName,

        category.description,

        createdAt,

        actor.id

      );


      // ثبت سابقه ایجاد دسته‌بندی
      writeCategoryAudit(
        database,
        actor,
        'categories.created',
        categoryId,
        {
          name: category.name,
          description: category.description,
        },
        createdAt
      );


      createdIds.push(categoryId);

    }


    // ثبت نهایی همه دسته‌بندی‌ها
    database.exec('COMMIT');


    // بازگرداندن اطلاعات دسته‌بندی‌های ایجادشده
    return createdIds.map(
      (id) => selectCategoryById(database, id)
    );


  } catch (error) {

    // اگر حتی یکی از ردیف‌ها خطا داشته باشد،
    // تمام دسته‌بندی‌های همین درخواست لغو می‌شوند
    try {
      database.exec('ROLLBACK');
    } catch {
      // نادیده‌گرفتن خطای احتمالی بازگشت تراکنش
    }

    throw error;

  }

}


// ایجاد یک دسته‌بندی
function createCategory(database, actor, input) {

  const result = createCategories(
    database,
    actor,
    [input]
  );

  return result[0];

}


// ویرایش اطلاعات دسته‌بندی
function updateCategory(
  database,
  actor,
  categoryId,
  input
) {

  // بررسی مجوز مدیریت
  assertPermission(
    database,
    actor,
    'categories.manage'
  );


  if (
    typeof categoryId !== 'string' ||
    !categoryId.trim()
  ) {
    throw new Error('شناسه دسته‌بندی معتبر نیست.');
  }


  const validated = validateCategoryInput(input);

  const updatedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    // دریافت اطلاعات قبلی
    const existing = database.prepare(`

      SELECT
        id,
        name,
        description,
        normalized_name

      FROM categories

      WHERE id = ?

    `).get(categoryId);


    if (!existing) {
      throw new Error('دسته‌بندی موردنظر پیدا نشد.');
    }


    // جلوگیری از تکرار نام با دسته‌بندی‌های دیگر
    const duplicate = findDuplicateCategory(
      database,
      validated.normalizedName,
      categoryId
    );


    if (duplicate) {
      throw new Error(
        `نام «${validated.name}» قبلاً برای دسته‌بندی دیگری ثبت شده است.`
      );
    }


    // ثبت تغییرات
    database.prepare(`

      UPDATE categories

      SET

        name = ?,
        normalized_name = ?,
        description = ?,

        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(

      validated.name,
      validated.normalizedName,
      validated.description,

      updatedAt,
      actor.id,

      categoryId

    );


    // ثبت سابقه تغییرات
    writeCategoryAudit(
      database,
      actor,
      'categories.updated',
      categoryId,
      {
        before: {
          name: existing.name,
          description: existing.description,
        },

        after: {
          name: validated.name,
          description: validated.description,
        },
      },
      updatedAt
    );


    database.exec('COMMIT');


    return selectCategoryById(
      database,
      categoryId
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


// فعال یا غیرفعال کردن دسته‌بندی
function setCategoryActive(
  database,
  actor,
  categoryId,
  isActive
) {

  // بررسی مجوز مدیریت
  assertPermission(
    database,
    actor,
    'categories.manage'
  );


  if (
    typeof categoryId !== 'string' ||
    !categoryId.trim()
  ) {
    throw new Error('شناسه دسته‌بندی معتبر نیست.');
  }


  if (typeof isActive !== 'boolean') {
    throw new Error('وضعیت دسته‌بندی معتبر نیست.');
  }


  const updatedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    const existing = database.prepare(`

      SELECT
        id,
        name,
        normalized_name,
        is_active

      FROM categories

      WHERE id = ?

    `).get(categoryId);


    if (!existing) {
      throw new Error('دسته‌بندی موردنظر پیدا نشد.');
    }


    const previousStatus = Boolean(existing.is_active);


    // اگر وضعیت تغییری نکرده باشد، عملیات جدیدی ثبت نمی‌کنیم
    if (previousStatus === isActive) {

      database.exec('COMMIT');

      return selectCategoryById(
        database,
        categoryId
      );

    }


    // هنگام فعال‌سازی، نام دسته‌بندی نباید با
    // یک دسته‌بندی فعال دیگر تکراری باشد
    if (isActive) {

      const duplicate = database.prepare(`

        SELECT id

        FROM categories

        WHERE normalized_name = ?
          AND is_active = 1
          AND id <> ?

        LIMIT 1

      `).get(
        existing.normalized_name,
        categoryId
      );


      if (duplicate) {
        throw new Error(
          'دسته‌بندی دیگری با همین نام فعال است.'
        );
      }

    }


    // تغییر وضعیت و ثبت هویت ویرایش‌کننده
    database.prepare(`

      UPDATE categories

      SET

        is_active = ?,
        updated_at = ?,
        updated_by_user_id = ?

      WHERE id = ?

    `).run(

      isActive ? 1 : 0,

      updatedAt,

      actor.id,

      categoryId

    );


    // ثبت سابقه فعال‌سازی یا غیرفعال‌سازی
    writeCategoryAudit(
      database,
      actor,
      isActive
        ? 'categories.reactivated'
        : 'categories.deactivated',
      categoryId,
      {
        name: existing.name,
        previousStatus,
        newStatus: isActive,
      },
      updatedAt
    );


    database.exec('COMMIT');


    return selectCategoryById(
      database,
      categoryId
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


// حذف دسته‌بندی بدون کالای وابسته
function deleteCategory(
  database,
  actor,
  categoryId
) {

  // بررسی مجوز مدیریت
  assertPermission(
    database,
    actor,
    'categories.manage'
  );


  if (
    typeof categoryId !== 'string' ||
    !categoryId.trim()
  ) {
    throw new Error('شناسه دسته‌بندی معتبر نیست.');
  }


  const deletedAt = new Date().toISOString();


  database.exec('BEGIN IMMEDIATE');

  try {

    const existing = database.prepare(`

      SELECT
        id,
        name,
        description

      FROM categories

      WHERE id = ?

    `).get(categoryId);


    if (!existing) {
      throw new Error('دسته‌بندی موردنظر پیدا نشد.');
    }


    // بررسی وابستگی کالاها
    const productCount = database.prepare(`

      SELECT COUNT(*) AS total

      FROM products

      WHERE category_id = ?

    `).get(categoryId);


    if (Number(productCount.total) > 0) {
      throw new Error(
        'این دسته‌بندی دارای کالای وابسته است و امکان حذف آن وجود ندارد.'
      );
    }


    // ثبت سابقه پیش از حذف رکورد
    writeCategoryAudit(
      database,
      actor,
      'categories.deleted',
      categoryId,
      {
        name: existing.name,
        description: existing.description,
      },
      deletedAt
    );


    // حذف فقط در صورت نداشتن کالای وابسته
    database.prepare(`

      DELETE FROM categories

      WHERE id = ?

    `).run(categoryId);


    database.exec('COMMIT');


    return {
      success: true,
      id: categoryId,
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
  getCategories,
  createCategory,
  createCategories,
  updateCategory,
  setCategoryActive,
  deleteCategory,
};
