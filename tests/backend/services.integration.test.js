import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import inventoryService from '../../electron/services/inventoryService.cjs';
import productService from '../../electron/services/productService.cjs';

import databaseModule from '../../electron/database.cjs'
import authService from '../../electron/services/authService.cjs'
import categoryService from '../../electron/services/categoryService.cjs'

const { openDatabase, SCHEMA_VERSION } = databaseModule
const { createInitialAdmin, authenticateUser } = authService
const { createCategory, createCategories, getCategories } = categoryService

const {
  createInventoryEntryDraft,
  postInventoryDocument,
  getInventoryStockList,
} = inventoryService;

const { createProduct } = productService;


const adminInput = {
  displayName: 'مدیر آزمایشی',
  username: 'qaadmin',
  password: 'TestPassword123!',
  confirmPassword: 'TestPassword123!',
}

let temporaryDirectory
let database

beforeEach(() => {
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'hesabyar-test-'))
  database = openDatabase(path.join(temporaryDirectory, 'hesabyar-test.sqlite'))
})

afterEach(() => {
  if (database) {
    database.close()
    database = null
  }

  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = null
  }
})

describe('پایگاه داده و سرویس‌های اصلی', () => {
  it('پایگاه داده خالی را تا آخرین نسخه schema مهاجرت می‌دهد', () => {
    const version = Number(database.prepare('PRAGMA user_version').get().user_version)
    const usersTable = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).get()

    expect(version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(7)
    expect(usersTable?.name).toBe('users')
  })

  it('مدیر اولیه را ایجاد می‌کند و ورود با گذرواژه را می‌پذیرد', async () => {
    const setup = createInitialAdmin(database, adminInput)

    expect(setup.success).toBe(true)
    expect(setup.user.username).toBe('qaadmin')
    expect(setup.user.role).toBe('admin')
    expect(setup.recoveryCode).toMatch(/[A-F0-9]{4}-/)

    const login = await authenticateUser(
      database,
      {
        username: 'QAADMIN',
        method: 'password',
        password: adminInput.password,
      },
      null
    )

    expect(login.success).toBe(true)
    expect(login.user.username).toBe('qaadmin')

    await expect(
      authenticateUser(
        database,
        {
          username: 'qaadmin',
          method: 'password',
          password: 'wrong-password',
        },
        null
      )
    ).resolves.toMatchObject({ success: false })

    expect(() => createInitialAdmin(database, adminInput)).toThrow('مدیر اولیه قبلاً ایجاد شده است.')
  })

  it('ایجاد گروهی دسته‌بندی را در صورت شکست یک ردیف به صورت کامل بازمی‌گرداند', () => {
    const setup = createInitialAdmin(database, adminInput)
    const admin = setup.user

    const existingCategory = createCategory(database, admin, {
      name: 'مواد غذایی',
      description: 'دسته موجود در آزمون',
    })

    expect(existingCategory.name).toBe('مواد غذایی')

    expect(() => createCategories(database, admin, [
      {
        name: 'دسته جدید',
        description: 'این ردیف باید rollback شود',
      },
      {
        name: 'مواد غذایی',
        description: 'نام تکراری',
      },
    ])).toThrow('قبلاً ثبت شده است.')

    const categories = getCategories(database, admin)

    expect(categories).toHaveLength(1)
    expect(categories[0].name).toBe('مواد غذایی')
  })

  it('برای کاربر فاقد مجوز، دریافت دسته‌بندی را رد می‌کند', () => {
    const restrictedUser = {
      id: 'restricted-user',
      username: 'restricted',
      displayName: 'کاربر محدود',
      role: 'user',
    }

    expect(() => getCategories(database, restrictedUser)).toThrow(
      'برای انجام این عملیات مجوز لازم را نداری.'
    )
  })

  it('موجودی را از گردش‌های ثبت‌نهایی‌شده محاسبه می‌کند و پیش‌نویس را نادیده می‌گیرد', () => {

    // ایجاد مدیر آزمایشی با مجوزهای مدیریتی
    const setup = createInitialAdmin(
      database,
      adminInput
    );

    const admin = setup.user;


    // ایجاد دسته‌بندی آزمایشی
    const category = createCategory(
      database,
      admin,
      {
        name: 'مواد غذایی',
        description: 'دسته‌بندی آزمون موجودی',
      }
    );


    // ایجاد واحد پایه کالا
    // استفاده از واحد کیلوگرم پیش‌فرض حساب‌یار
    const unit = database.prepare(`
      SELECT
        id,
        code,
        name,
        symbol
      FROM units
      WHERE code = ?
        AND is_active = 1
      LIMIT 1
    `).get('KG');

    // اطمینان از وجود واحد پایه در پایگاه داده آزمایشی
    expect(unit).toBeDefined();


    // ایجاد کالا همراه با قیمت خرید در ارز مبنا
    const product = createProduct(
      database,
      admin,
      {
        name: 'آرد آزمایشی',
        categoryId: category.id,
        baseUnitId: unit.id,
        unitOptions: [],
        prices: [
          {
            unitId: unit.id,
            currencyCode: 'AFN',
            priceType: 'purchase',
            unitPrice: '45',
          },
        ],
      }
    );


    // دریافت فهرست موجودی پیش از ایجاد سند
    const initialStock = getInventoryStockList(
      database,
      admin
    );


    expect(initialStock.baseCurrencyCode).toBe('AFN');

    expect(initialStock.products).toHaveLength(1);

    expect(initialStock.products[0]).toMatchObject({
      id: product.id,
      name: 'آرد آزمایشی',
      stock: 0,
      purchasePrice: 45,
      purchasePriceCurrencyCode: 'AFN',
    });


    // دریافت شناسه نسخه واحد پایه کالا
    const baseProductUnit = product.units.find(
      (item) => item.isBaseUnit
    );


    // ساخت پیش‌نویس ورود کالا
    const draft = createInventoryEntryDraft(
      database,
      admin,
      {
        documentType: 'purchase',
        documentDate: '2026-11-28',
        items: [
          {
            productId: product.id,
            productUnitId: baseProductUnit.productUnitId,
            quantity: '12.5',
            unitPrice: '45',
            currencyCode: 'AFN',
          },
        ],
      }
    );


    // پیش‌نویس نباید موجودی واقعی را تغییر دهد
    const stockAfterDraft = getInventoryStockList(
      database,
      admin
    );

    expect(
      stockAfterDraft.products[0].stock
    ).toBe(0);


    // ثبت نهایی سند و ایجاد گردش ورود
    postInventoryDocument(
      database,
      admin,
      draft.id
    );


    // دریافت دوباره موجودی پس از ثبت نهایی
    const stockAfterPosting = getInventoryStockList(
      database,
      admin
    );


    expect(
      stockAfterPosting.products[0].stock
    ).toBe(12.5);

    expect(
      stockAfterPosting.products[0].stockScaled
    ).toBe(12_500_000);

  });

})
