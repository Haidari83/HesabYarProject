import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  mkdtempSync,
  rmSync,
} from 'node:fs';

import { tmpdir } from 'node:os';
import path from 'node:path';

import databaseModule from '../../electron/database.cjs';
import authService from '../../electron/services/authService.cjs';
import categoryService from '../../electron/services/categoryService.cjs';
import productService from '../../electron/services/productService.cjs';
import inventoryService from '../../electron/services/inventoryService.cjs';
import salesService from '../../electron/services/salesService.cjs';


const { openDatabase } = databaseModule;

const { createInitialAdmin } = authService;

const { createCategory } = categoryService;

const { createProduct } = productService;

const {
  createInventoryEntryDraft,
  postInventoryDocument,
} = inventoryService;

const { getSalesFormOptions } = salesService;


const adminInput = {
  displayName: 'مدیر فروش آزمایشی',
  username: 'salesadmin',
  password: 'TestPassword123!',
  confirmPassword: 'TestPassword123!',
};


let temporaryDirectory;
let database;


beforeEach(() => {

  temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), 'hesabyar-sales-test-')
  );

  database = openDatabase(
    path.join(
      temporaryDirectory,
      'hesabyar-sales-test.sqlite'
    )
  );

});


afterEach(() => {

  if (database) {
    database.close();
    database = null;
  }

  if (temporaryDirectory) {
    rmSync(
      temporaryDirectory,
      {
        recursive: true,
        force: true,
      }
    );

    temporaryDirectory = null;
  }

});


describe('سرویس فروش حساب‌یار', () => {


  it(
    'اطلاعات کالا، قیمت فروش و موجودی واقعی را برای فرم فروش دریافت می‌کند',
    () => {

      // ایجاد مدیر آزمایشی
      const setup = createInitialAdmin(
        database,
        adminInput
      );

      const admin = setup.user;


      // ایجاد دسته‌بندی کالا
      const category = createCategory(
        database,
        admin,
        {
          name: 'کالاهای فروشگاهی',
          description: 'دسته‌بندی آزمون فروش',
        }
      );


      // استفاده از واحد پایه کیلوگرم
      const unit = database.prepare(`
        SELECT id
        FROM units
        WHERE code = ?
          AND is_active = 1
        LIMIT 1
      `).get('KG');

      expect(unit).toBeDefined();


      // ایجاد کالا با قیمت خرید و فروش
      const product = createProduct(
        database,
        admin,
        {
          name: 'کالای آزمایشی فروش',
          categoryId: category.id,
          baseUnitId: unit.id,
          unitOptions: [],

          prices: [

            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'purchase',
              unitPrice: '40',
            },

            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'sale',
              unitPrice: '65',
            },

            {
              unitId: unit.id,
              currencyCode: 'USD',
              priceType: 'sale',
              unitPrice: '0.8',
            },

          ],

        }
      );


      // دریافت واحد پایه اختصاص‌یافته به کالا
      const baseProductUnit = product.units.find(
        (item) => item.isBaseUnit
      );

      expect(baseProductUnit).toBeDefined();


      // ایجاد پیش‌نویس ورود کالا
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
              unitPrice: '40',
              currencyCode: 'AFN',
            },
          ],

        }
      );


      // ثبت نهایی ورود برای ایجاد موجودی واقعی
      postInventoryDocument(
        database,
        admin,
        draft.id
      );


      // دریافت اطلاعات فرم فروش
      const result = getSalesFormOptions(
        database,
        admin
      );


      // بررسی ارز مبنای سیستم
      expect(result.baseCurrencyCode).toBe('AFN');


      // بررسی ارزهای فعال
      expect(result.currencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'AFN',
            symbol: '؋',
          }),

          expect.objectContaining({
            code: 'USD',
            symbol: '$',
          }),
        ])
      );


      // دریافت کالای ایجادشده
      const salesProduct = result.products.find(
        (item) => item.id === product.id
      );

      expect(salesProduct).toBeDefined();


      // بررسی موجودی واقعی کالا
      expect(salesProduct).toMatchObject({

        id: product.id,

        name: 'کالای آزمایشی فروش',

        availableStockScaled: 12_500_000,

        availableStock: 12.5,

        canSell: true,

      });


      // دریافت واحد پایه در اطلاعات فروش
      const salesBaseUnit = salesProduct.productUnits.find(
        (item) => item.isBaseUnit
      );

      expect(salesBaseUnit).toBeDefined();


      // بررسی قیمت فروش به افغانی
      expect(salesBaseUnit.salePrices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            currencyCode: 'AFN',
            unitPrice: 65,
          }),
        ])
      );


      // بررسی قیمت فروش به دلار
      expect(salesBaseUnit.salePrices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            currencyCode: 'USD',
            unitPrice: 0.8,
          }),
        ])
      );


    }
  );


  it(
    'دریافت اطلاعات فرم فروش را برای کاربر فاقد مجوز رد می‌کند',
    () => {

      const restrictedUser = {
        id: 'restricted-sales-user',
        username: 'restricted',
        displayName: 'کاربر محدود',
        role: 'user',
      };


      expect(
        () => getSalesFormOptions(
          database,
          restrictedUser
        )
      ).toThrow(
        'برای انجام این عملیات مجوز لازم را نداری.'
      );

    }
  );


});