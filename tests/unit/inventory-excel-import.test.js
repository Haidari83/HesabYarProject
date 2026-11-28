import { describe, expect, it } from 'vitest';

import {
  validateInventoryExcelRows,
} from '../../src/pages/Inventory/inventory-excel-validation.js';


// کالای نمونه با واحد پایه و واحد بسته‌بندی
const products = [
  {
    id: 'product-1',

    name: 'کتاب',

    baseQuantityDecimalPlaces: 2,

    productUnits: [

      {
        productUnitId: 'unit-1',

        name: 'عدد',

        symbol: 'عدد',

        isBaseUnit: true,

        conversionNum: 1,

        conversionDen: 1,

        inputDecimalPlaces: 2,
      },

      {
        productUnitId: 'unit-2',

        name: 'بسته',

        symbol: 'بسته',

        isBaseUnit: false,

        conversionNum: 5,

        conversionDen: 1,

        inputDecimalPlaces: 0,
      },

    ],
  },
];


// ارزهای نمونه
const currencies = [
  {
    code: 'AFN',
    name: 'افغانی',
    symbol: '؋',
  },
  {
    code: 'USD',
    name: 'دالر امریکا',
    symbol: '$',
  },
];


// اجرای اعتبارسنجی با داده‌های پیش‌فرض
function validate(rows) {
  return validateInventoryExcelRows({
    rows,
    products,
    currencies,
    baseCurrencyCode: 'AFN',
  });
}


describe('اعتبارسنجی ورود کالا از Excel', () => {

  it('نام فارسی و عربی معادل را شناسایی می‌کند', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'كِتاب',

        unit: 'عدد',

        quantity: '۱٫۵',

        unitPrice: '۱۰',

        currency: 'AFN',
      },
    ]);


    expect(result.identifiedCount).toBe(1);

    expect(result.validCount).toBe(1);

    expect(result.invalidCount).toBe(0);

    expect(result.validRows[0].item).toEqual({

      productId: 'product-1',

      productUnitId: 'unit-1',

      quantity: '1.5',

      unitPrice: '10',

      currencyCode: 'AFN',

    });

  });


  it('وقتی واحد و ارز مشخص نشده باشند، مقدار پیش‌فرض را انتخاب می‌کند', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'کتاب',

        unit: '',

        quantity: '2',

        unitPrice: '15',

        currency: '',
      },
    ]);


    expect(result.validCount).toBe(1);

    expect(result.validRows[0].unit.isBaseUnit).toBe(true);

    expect(result.validRows[0].currency.code).toBe('AFN');

  });


  it('واحد بسته‌بندی را فقط با نسبت تبدیل دقیق می‌پذیرد', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'کتاب',

        unit: 'بسته',

        quantity: '2',

        unitPrice: '50',

        currency: 'USD',
      },
    ]);


    expect(result.validCount).toBe(1);

    expect(result.validRows[0].item).toEqual({

      productId: 'product-1',

      productUnitId: 'unit-2',

      quantity: '2',

      unitPrice: '50',

      currencyCode: 'USD',

    });

  });


  it('کالای ناموجود را رد می‌کند', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'دفتر',

        unit: 'عدد',

        quantity: '1',

        unitPrice: '10',

        currency: 'AFN',
      },
    ]);


    expect(result.identifiedCount).toBe(0);

    expect(result.validCount).toBe(0);

    expect(result.invalidCount).toBe(1);

    expect(result.rows[0].errors.join(' ')).toContain(
      'در فهرست فعال حساب‌یار پیدا نشد'
    );

  });


  it('واحدی را که به کالای دیگری تعلق ندارد رد می‌کند', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'کتاب',

        unit: 'کیلوگرام',

        quantity: '1',

        unitPrice: '10',

        currency: 'AFN',
      },
    ]);


    expect(result.identifiedCount).toBe(1);

    expect(result.validCount).toBe(0);

    expect(result.rows[0].errors.join(' ')).toContain(
      'برای کالای'
    );

  });


  it('بیشتر از دقت اعشاری مجاز واحد را نمی‌پذیرد', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'کتاب',

        unit: 'عدد',

        quantity: '1.234',

        unitPrice: '10',

        currency: 'AFN',
      },
    ]);


    expect(result.validCount).toBe(0);

    expect(result.rows[0].errors.join(' ')).toContain(
      'رقم اعشار داشته باشد'
    );

  });


  it('قیمت صفر را برای جلوگیری از شکست ثبت نهایی رد می‌کند', () => {

    const result = validate([
      {
        excelRow: 2,

        productName: 'کتاب',

        unit: 'عدد',

        quantity: '1',

        unitPrice: '0',

        currency: 'AFN',
      },
    ]);


    expect(result.validCount).toBe(0);

    expect(result.rows[0].errors.join(' ')).toContain(
      'باید بزرگ‌تر از صفر باشد'
    );

  });


  it('مقداری را که به‌صورت دقیق به واحد پایه تبدیل نمی‌شود رد می‌کند', () => {

    const fractionalProduct = [
      {
        id: 'product-2',

        name: 'ماده آزمایشی',

        baseQuantityDecimalPlaces: 2,

        productUnits: [
          {
            productUnitId: 'unit-3',

            name: 'بخش',

            symbol: '',

            isBaseUnit: true,

            conversionNum: 1,

            conversionDen: 1,

            inputDecimalPlaces: 2,
          },

          {
            productUnitId: 'unit-4',

            name: 'سهم',

            symbol: '',

            isBaseUnit: false,

            conversionNum: 1,

            conversionDen: 3,

            inputDecimalPlaces: 2,
          },
        ],
      },
    ];


    const result = validateInventoryExcelRows({

      rows: [
        {
          excelRow: 2,

          productName: 'ماده آزمایشی',

          unit: 'سهم',

          quantity: '1',

          unitPrice: '10',

          currency: 'AFN',
        },
      ],

      products: fractionalProduct,

      currencies,

      baseCurrencyCode: 'AFN',

    });


    expect(result.validCount).toBe(0);

    expect(result.rows[0].errors.join(' ')).toContain(
      'به‌صورت دقیق قابل ذخیره نیست'
    );

  });

});