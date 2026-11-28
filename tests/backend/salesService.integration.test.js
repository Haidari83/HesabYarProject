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
  postSalesDocument,
  getSalesDocuments,
  getSalesDocumentDetails,
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

  it(
    'فروش را ثبت نهایی می‌کند و بهای تمام‌شده را به ترتیب FIFO تخصیص می‌دهد',
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
          name: 'کالاهای آزمون FIFO فروش',
          description: 'آزمون تخصیص لایه‌های FIFO',
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
          name: 'کالای آزمون FIFO',
          categoryId: category.id,
          baseUnitId: unit.id,
          unitOptions: [],

          prices: [
            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'purchase',
              unitPrice: '10',
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


      // ثبت ورود اول: پنج واحد با بهای هر واحد ۱۰ افغانی
      const firstEntryDraft = createInventoryEntryDraft(
        database,
        admin,
        {
          documentType: 'purchase',
          documentDate: '2026-11-26',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '5',
              unitPrice: '10',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      postInventoryDocument(
        database,
        admin,
        firstEntryDraft.id
      );


      // ثبت ورود دوم: هفت واحد با بهای هر واحد ۲۰ افغانی
      const secondEntryDraft = createInventoryEntryDraft(
        database,
        admin,
        {
          documentType: 'purchase',
          documentDate: '2026-11-27',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '7',
              unitPrice: '20',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      postInventoryDocument(
        database,
        admin,
        secondEntryDraft.id
      );


      // ایجاد پیش‌نویس فروش اول: هشت واحد
      const firstSalesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-28',
          customerName: 'مشتری اول',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '8',
              unitPrice: '65',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // ایجاد پیش‌نویس فروش دوم پیش از ثبت نهایی اول
      // هر دو پیش‌نویس در زمان ایجاد، موجودی کافی مشاهده می‌کنند.
      const secondSalesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-28',
          customerName: 'مشتری دوم',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '6',
              unitPrice: '65',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // ثبت نهایی فاکتور اول
      const postedSale = postSalesDocument(
        database,
        admin,
        firstSalesDraft.id
      );


      // بررسی نتیجه ثبت نهایی
      expect(postedSale).toMatchObject({
        id: firstSalesDraft.id,
        documentNumber: firstSalesDraft.documentNumber,
        documentType: 'sale',
        documentDate: '2026-11-28',
        customerName: 'مشتری اول',
        status: 'posted',
        itemCount: 1,
      });


      // بهای تمام‌شده FIFO:
      // پنج واحد اول × ۱۰ = ۵۰
      // سه واحد بعدی × ۲۰ = ۶۰
      // جمع = ۱۱۰ افغانی
      expect(postedSale.totalCostByCurrency).toEqual([
        expect.objectContaining({
          currencyCode: 'AFN',
          totalCostScaled: 110_000_000,
          totalCost: 110,
        }),
      ]);


      // دریافت گردش خروجی فاکتور
      const movement = database.prepare(`
      SELECT
        id,
        movement_direction,
        base_quantity_scaled
      FROM inventory_movements
      WHERE document_id = ?
    `).get(firstSalesDraft.id);


      expect(movement).toMatchObject({
        movement_direction: 'out',
        base_quantity_scaled: 8_000_000,
      });


      // بررسی تخصیص لایه‌های FIFO
      const allocations = database.prepare(`
      SELECT

        allocation.allocated_quantity_base_scaled,
        allocation.unit_cost_scaled,
        allocation.allocated_cost_scaled,

        allocation.valuation_currency_code,

        layer.received_at

      FROM inventory_fifo_allocations AS allocation

      JOIN inventory_cost_layers AS layer
        ON layer.id = allocation.cost_layer_id

      WHERE allocation.outbound_movement_id = ?

      ORDER BY
        layer.received_at ASC,
        layer.created_at ASC,
        layer.id ASC
    `).all(movement.id);


      expect(allocations).toHaveLength(2);


      // ابتدا تمام لایه قدیمی‌تر مصرف شده است.
      expect(allocations[0]).toMatchObject({
        allocated_quantity_base_scaled: 5_000_000,
        unit_cost_scaled: 10_000_000,
        allocated_cost_scaled: 50_000_000,
        valuation_currency_code: 'AFN',
        received_at: expect.stringContaining('2026-11-26'),
      });


      // سپس سه واحد از لایه دوم مصرف شده است.
      expect(allocations[1]).toMatchObject({
        allocated_quantity_base_scaled: 3_000_000,
        unit_cost_scaled: 20_000_000,
        allocated_cost_scaled: 60_000_000,
        valuation_currency_code: 'AFN',
        received_at: expect.stringContaining('2026-11-27'),
      });


      // بررسی مانده واقعی موجودی پس از فروش
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


      // از ۱۲ واحد، ۸ واحد فروخته شده و ۴ واحد باقی مانده است.
      expect(Number(stock.stock_scaled)).toBe(4_000_000);


      // فروش دوم اکنون موجودی کافی ندارد و نباید ثبت شود.
      expect(() =>
        postSalesDocument(
          database,
          admin,
          secondSalesDraft.id
        )
      ).toThrow('موجودی قابل فروش');


      // اطمینان از باقی‌ماندن فاکتور دوم در وضعیت پیش‌نویس
      const secondDocument = database.prepare(`
      SELECT status
      FROM inventory_documents
      WHERE id = ?
    `).get(secondSalesDraft.id);


      expect(secondDocument.status).toBe('draft');


      // فاکتور دوم نباید هیچ گردش خروجی ایجاد کرده باشد.
      const secondMovementCount = database.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory_movements
      WHERE document_id = ?
    `).get(secondSalesDraft.id);


      expect(Number(secondMovementCount.total)).toBe(0);

    }
  );

  it(
    'ثبت نهایی فاکتور را برای کاربر فاقد مجوز رد می‌کند',
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
          name: 'کالاهای آزمون مجوز فروش',
          description: 'آزمون مجوز ثبت نهایی',
        }
      );


      // دریافت واحد پایه
      const unit = database.prepare(`
      SELECT id
      FROM units
      WHERE code = ?
        AND is_active = 1
      LIMIT 1
    `).get('KG');


      // ایجاد کالا
      const product = createProduct(
        database,
        admin,
        {
          name: 'کالای آزمون مجوز',
          categoryId: category.id,
          baseUnitId: unit.id,
          unitOptions: [],

          prices: [
            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'purchase',
              unitPrice: '10',
            },
            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'sale',
              unitPrice: '15',
            },
          ],
        }
      );


      const baseProductUnit = product.units.find(
        (item) => item.isBaseUnit
      );


      // ایجاد موجودی واقعی
      const entryDraft = createInventoryEntryDraft(
        database,
        admin,
        {
          documentType: 'purchase',
          documentDate: '2026-11-27',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '5',
              unitPrice: '10',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      postInventoryDocument(
        database,
        admin,
        entryDraft.id
      );


      // ایجاد پیش‌نویس فروش با مدیر
      const salesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-28',
          customerName: 'مشتری آزمون',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '2',
              unitPrice: '15',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // کاربری که مجوز ثبت نهایی فروش ندارد
      const restrictedUser = {
        id: 'restricted-post-user',
        username: 'restricted',
        displayName: 'کاربر محدود',
        role: 'user',
      };


      // درخواست ثبت نهایی باید رد شود.
      expect(() =>
        postSalesDocument(
          database,
          restrictedUser,
          salesDraft.id
        )
      ).toThrow(
        'برای انجام این عملیات مجوز لازم را نداری.'
      );


      // فاکتور باید پیش‌نویس باقی بماند.
      const savedDocument = database.prepare(`
      SELECT status
      FROM inventory_documents
      WHERE id = ?
    `).get(salesDraft.id);


      expect(savedDocument.status).toBe('draft');


      // هیچ گردش خروجی نباید ایجاد شده باشد.
      const movementCount = database.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory_movements
      WHERE document_id = ?
    `).get(salesDraft.id);


      expect(Number(movementCount.total)).toBe(0);

    }
  );
  it(
    'فهرست فاکتورهای فروش و جزئیات آن‌ها را با مبالغ صحیح دریافت می‌کند',
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
          name: 'کالاهای آزمون فهرست فروش',
          description: 'آزمون دریافت فهرست و جزئیات فاکتور',
        }
      );


      // دریافت واحد پایه کیلوگرم
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
          name: 'کالای آزمون فهرست فروش',
          categoryId: category.id,
          baseUnitId: unit.id,
          unitOptions: [],

          prices: [
            {
              unitId: unit.id,
              currencyCode: 'AFN',
              priceType: 'purchase',
              unitPrice: '10',
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


      const baseProductUnit = product.units.find(
        (item) => item.isBaseUnit
      );

      expect(baseProductUnit).toBeDefined();


      // ایجاد موجودی واقعی برای فروش
      const entryDraft = createInventoryEntryDraft(
        database,
        admin,
        {
          documentType: 'purchase',
          documentDate: '2026-11-26',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '30',
              unitPrice: '10',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      postInventoryDocument(
        database,
        admin,
        entryDraft.id
      );


      // ایجاد فاکتور اول با دو ردیف کالا
      const firstSalesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-27',

          customerName: 'مشتری اول',

          sourceInvoiceNumber: 'EXTERNAL-001',

          notes: 'فاکتور آزمون دریافت جزئیات',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '2',
              unitPrice: '65',
              currencyCode: 'AFN',
            },
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '3',
              unitPrice: '70',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // ایجاد فاکتور دوم برای آزمون فهرست و صفحه‌بندی
      const secondSalesDraft = createSalesDraft(
        database,
        admin,
        {
          documentDate: '2026-11-28',

          customerName: 'مشتری دوم',

          items: [
            {
              productId: product.id,
              productUnitId: baseProductUnit.productUnitId,
              quantity: '1',
              unitPrice: '65',
              currencyCode: 'AFN',
            },
          ],
        }
      );


      // ثبت نهایی فاکتور اول
      const postedSale = postSalesDocument(
        database,
        admin,
        firstSalesDraft.id
      );

      expect(postedSale.status).toBe('posted');


      // دریافت فهرست تمام فاکتورهای فروش
      const allSales = getSalesDocuments(
        database,
        admin,
        {
          status: 'all',
          limit: 10,
          offset: 0,
        }
      );


      expect(allSales.totalCount).toBe(2);

      expect(allSales.documents).toHaveLength(2);
      // اطمینان از اینکه فاکتور دوم نیز در فهرست فروش وجود دارد.
      expect(
        allSales.documents.some(
          (item) => item.id === secondSalesDraft.id
        )
      ).toBe(true);

      expect(allSales.limit).toBe(10);

      expect(allSales.offset).toBe(0);


      // سند خرید نباید وارد فهرست فروش شود.
      expect(
        allSales.documents.some(
          (item) => item.id === entryDraft.id
        )
      ).toBe(false);


      // بررسی فیلتر وضعیت، جست‌وجو و بازه تاریخ
      const filteredSales = getSalesDocuments(
        database,
        admin,
        {
          status: 'posted',
          search: 'EXTERNAL-001',
          fromDate: '2026-11-27',
          toDate: '2026-11-27',
          limit: 10,
          offset: 0,
        }
      );


      expect(filteredSales.totalCount).toBe(1);

      expect(filteredSales.documents).toHaveLength(1);


      const listedInvoice =
        filteredSales.documents[0];


      expect(listedInvoice).toMatchObject({

        id: firstSalesDraft.id,

        documentNumber: firstSalesDraft.documentNumber,

        documentType: 'sale',

        documentDate: '2026-11-27',

        status: 'posted',

        customerName: 'مشتری اول',

        sourceInvoiceNumber: 'EXTERNAL-001',

        itemCount: 2,

      });


      // دو ردیف: ۲ × ۶۵ + ۳ × ۷۰ = ۳۴۰ افغانی
      expect(listedInvoice.totalsByCurrency).toEqual([
        expect.objectContaining({
          currencyCode: 'AFN',
          totalAmountScaled: 340_000_000,
          totalAmount: 340,
        }),
      ]);


      // بررسی صفحه‌بندی
      const secondPage = getSalesDocuments(
        database,
        admin,
        {
          status: 'all',
          limit: 1,
          offset: 1,
        }
      );


      expect(secondPage.documents).toHaveLength(1);

      expect(
        secondPage.documents[0].id
      ).toBe(firstSalesDraft.id);


      // دریافت جزئیات فاکتور اول
      const details = getSalesDocumentDetails(
        database,
        admin,
        firstSalesDraft.id
      );


      expect(details).toMatchObject({

        id: firstSalesDraft.id,

        documentNumber: firstSalesDraft.documentNumber,

        documentType: 'sale',

        documentDate: '2026-11-27',

        status: 'posted',

        customerName: 'مشتری اول',

        sourceInvoiceNumber: 'EXTERNAL-001',

        itemCount: 2,

      });


      // بررسی اطلاعات کاربر ایجادکننده و ثبت‌کننده
      expect(details.createdBy).toMatchObject({

        id: admin.id,

        username: admin.username,

        displayName: admin.displayName,

      });


      expect(
        details.postedByDisplayName
      ).toBe(admin.displayName);


      // بررسی مقادیر و مبالغ هر ردیف
      expect(
        details.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          currencyCode: item.currency.code,
        }))
      ).toEqual([
        {
          quantity: 2,
          unitPrice: 65,
          lineTotal: 130,
          currencyCode: 'AFN',
        },
        {
          quantity: 3,
          unitPrice: 70,
          lineTotal: 210,
          currencyCode: 'AFN',
        },
      ]);


      // جمع کل فاکتور در جزئیات نیز باید ۳۴۰ افغانی باشد.
      expect(details.totalsByCurrency).toEqual([
        expect.objectContaining({
          currencyCode: 'AFN',
          totalAmountScaled: 340_000_000,
          totalAmount: 340,
        }),
      ]);


      // کاربر فاقد مجوز نباید بتواند فهرست فروش را مشاهده کند.
      const restrictedUser = {
        id: 'restricted-sales-view-user',
        username: 'restricted',
        displayName: 'کاربر محدود',
        role: 'user',
      };


      expect(() =>
        getSalesDocuments(
          database,
          restrictedUser
        )
      ).toThrow(
        'برای انجام این عملیات مجوز لازم را نداری.'
      );


      // کاربر فاقد مجوز نباید بتواند جزئیات فاکتور را دریافت کند.
      expect(() =>
        getSalesDocumentDetails(
          database,
          restrictedUser,
          firstSalesDraft.id
        )
      ).toThrow(
        'برای انجام این عملیات مجوز لازم را نداری.'
      );


      // شناسه یک سند خرید نباید به‌عنوان فاکتور فروش پذیرفته شود.
      expect(() =>
        getSalesDocumentDetails(
          database,
          admin,
          entryDraft.id
        )
      ).toThrow(
        'فاکتور فروش موردنظر پیدا نشد.'
      );

    }
  );
});