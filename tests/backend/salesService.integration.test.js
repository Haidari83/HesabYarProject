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

const {
  getSalesFormOptions,
  createSalesDraft,
} = salesService;

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
  it(
    'پیش‌نویس فروش را ذخیره می‌کند، اما موجودی انبار را تغییر نمی‌دهد',
    () => {

      // ایجاد مدیر آزمایشی
      const setup = createInitialAdmin(
        database,
        adminInput
      );

      const admin = setup.user;


      // ایجاد دسته‌بندی
      const category = createCategory(
        database,
        admin,
        {
          name: 'کالاهای آزمون پیش‌نویس فروش',
          description: 'آزمون ایجاد پیش‌نویس فروش',
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


      // ایجاد کالا با قیمت فروش
      const product = createProduct(
        database,
        admin,
        {
          name: 'کالای پیش‌نویس فروش',
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
          ],
        }
      );


      // دریافت واحد پایه اختصاصی کالا
      const baseProductUnit = product.units.find(
        (item) => item.isBaseUnit
      );

      expect(baseProductUnit).toBeDefined();


      // ثبت پیش‌نویس ورود کالا
      const entryDraft = createInventoryEntryDraft(
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
        entryDraft.id
      );


      // ایجاد پیش‌نویس فروش دو واحد از کالا
      const salesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-28',

          customerName: 'مشتری آزمایشی',

          sourceInvoiceNumber: 'CUSTOMER-REF-001',

          notes: 'آزمون ذخیره پیش‌نویس فروش',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '2',
              unitPrice: '65',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // بررسی پاسخ سرویس
      expect(salesDraft).toMatchObject({
        documentType: 'sale',
        documentDate: '2026-11-28',
        customerName: 'مشتری آزمایشی',
        status: 'draft',
        itemCount: 1,
      });


      expect(salesDraft.id).toBeTruthy();

      expect(salesDraft.documentNumber).toMatch(
        /^SL-20261128-\d{5}$/
      );


      // بررسی اطلاعات اصلی سند در SQLite
      const savedDocument = database.prepare(`
      SELECT
        document_type,
        document_date,
        status,
        source_party_type,
        source_party_name,
        source_invoice_number,
        notes
      FROM inventory_documents
      WHERE id = ?
    `).get(salesDraft.id);


      expect(savedDocument).toMatchObject({
        document_type: 'sale',
        document_date: '2026-11-28',
        status: 'draft',
        source_party_type: 'customer',
        source_party_name: 'مشتری آزمایشی',
        source_invoice_number: 'CUSTOMER-REF-001',
        notes: 'آزمون ذخیره پیش‌نویس فروش',
      });


      // بررسی اطلاعات ردیف ذخیره‌شده
      const savedItem = database.prepare(`
      SELECT
        product_id,
        product_unit_id,
        quantity_scaled,
        base_quantity_scaled,
        unit_price_scaled,
        currency_code,
        valuation_currency_code,
        exchange_rate_num,
        exchange_rate_den
      FROM inventory_document_items
      WHERE document_id = ?
    `).get(salesDraft.id);


      expect(savedItem).toMatchObject({
        product_id: product.id,
        product_unit_id: baseProductUnit.productUnitId,
        quantity_scaled: 2_000_000,
        base_quantity_scaled: 2_000_000,
        unit_price_scaled: 65_000_000,
        currency_code: 'AFN',
        valuation_currency_code: 'AFN',
        exchange_rate_num: 1,
        exchange_rate_den: 1,
      });


      // پیش‌نویس فروش نباید گردش خروجی ایجاد کند
      const salesMovements = database.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory_movements
      WHERE document_id = ?
    `).get(salesDraft.id);


      expect(Number(salesMovements.total)).toBe(0);


      // موجودی واقعی همچنان باید ۱۲٫۵ باشد
      const stock = database.prepare(`
      SELECT
        SUM(
          CASE
            WHEN movement_direction = 'in'
              THEN base_quantity_scaled
            WHEN movement_direction = 'out'
              THEN -base_quantity_scaled
            ELSE 0
          END
        ) AS stock_scaled
      FROM inventory_movements
      WHERE product_id = ?
    `).get(product.id);


      expect(Number(stock.stock_scaled)).toBe(12_500_000);


      // فروش بیش از موجودی نباید پیش‌نویس ایجاد کند
      expect(() =>
        createSalesDraft(
          database,
          admin,
          {
            documentDate: '2026-11-28',

            customerName: 'مشتری دوم',

            items: [
              {
                productId: product.id,
                productUnitId: baseProductUnit.productUnitId,
                quantity: '20',
                unitPrice: '65',
                currencyCode: 'AFN',
              },
            ],
          }
        )
      ).toThrow('موجودی کافی');


      // فقط همان پیش‌نویس معتبر اول باید ذخیره شده باشد
      const saleDocumentCount = database.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory_documents
      WHERE document_type = 'sale'
    `).get();


      expect(Number(saleDocumentCount.total)).toBe(1);

    }
  );


  it(
    'ایجاد پیش‌نویس فروش را برای کاربر فاقد مجوز رد می‌کند',
    () => {

      const restrictedUser = {
        id: 'restricted-sales-user',
        username: 'restricted',
        displayName: 'کاربر محدود',
        role: 'user',
      };


      expect(() =>
        createSalesDraft(
          database,
          restrictedUser,
          {}
        )
      ).toThrow(
        'برای انجام این عملیات مجوز لازم را نداری.'
      );

    }
  );

});