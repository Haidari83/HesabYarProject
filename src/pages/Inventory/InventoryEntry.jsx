
import { useState } from 'react';
import './inventory-entry.css';

function InventoryEntry() {

  // نوع ورود کالا
  const [entryType, setEntryType] = useState('purchase');

  return (
    <div className="inventory-entry">

      {/* اطلاعات عمومی سند */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>اطلاعات سند</h2>
            <p>اطلاعات عمومی ورود کالا به انبار</p>
          </div>

          <span className="entry-status">پیش‌نویس</span>
        </div>

        <div className="entry-form-grid">

          <label className="entry-field">
            <span>شماره سند</span>
            <input
              type="text"
              value="خودکار پس از ایجاد سند"
              disabled
            />
          </label>

          <label className="entry-field">
            <span>تاریخ ورود</span>
            <input type="date" />
          </label>

          <label className="entry-field entry-field-full">
            <span>نوع ورود کالا</span>

            <select
              value={entryType}
              onChange={(event) =>
                setEntryType(event.target.value)
              }
            >
              <option value="purchase">خرید</option>
              <option value="sales-return">برگشت از فروش</option>
              <option value="opening">موجودی اولیه</option>
              <option value="other">سایر</option>
            </select>
          </label>

        </div>

      </section>

      {/* اطلاعات منبع ورود */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>اطلاعات منبع ورود</h2>
            <p>اطلاعات تکمیلی درباره منشأ کالاهای ورودی</p>
          </div>
        </div>

        <div className="entry-form-grid">

          {entryType === 'purchase' && (
            <>
              <label className="entry-field">
                <span>تأمین‌کننده</span>
                <input
                  type="text"
                  placeholder="جست‌وجوی تأمین‌کننده..."
                />
              </label>

              <label className="entry-field">
                <span>شماره فاکتور خرید</span>
                <input
                  type="text"
                  placeholder="شماره فاکتور (اختیاری)"
                />
              </label>
            </>
          )}

          {entryType === 'sales-return' && (
            <>
              <label className="entry-field">
                <span>مشتری</span>
                <input
                  type="text"
                  placeholder="جست‌وجوی مشتری..."
                />
              </label>

              <label className="entry-field">
                <span>شماره فاکتور فروش</span>
                <input
                  type="text"
                  placeholder="شماره فاکتور (اختیاری)"
                />
              </label>
            </>
          )}

          {entryType === 'opening' && (
            <label className="entry-field">
              <span>تاریخ مبنای موجودی</span>
              <input type="date" />
            </label>
          )}

          {entryType === 'other' && (
            <label className="entry-field entry-field-full">
              <span>علت ورود کالا</span>
              <input
                type="text"
                placeholder="علت ورود کالا را بنویس..."
              />
            </label>
          )}

        </div>

      </section>

      {/* اقلام ورودی */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>اقلام ورودی</h2>
            <p>کالاهایی که قرار است وارد انبار شوند</p>
          </div>

          <span className="entry-item-count">۰ قلم</span>
        </div>

        <div className="entry-empty-items">

          <div className="entry-empty-icon">＋</div>

          <strong>هنوز کالایی به سند اضافه نشده است.</strong>

          <p>
            برای شروع، کالاهای موردنظر را به سند ورود اضافه کن.
          </p>

          <button type="button" disabled>
            افزودن کالا
          </button>

        </div>

      </section>

      {/* خلاصه سند */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>خلاصه سند</h2>
            <p>خلاصه مقادیر و مبلغ ورود کالا</p>
          </div>
        </div>

        <div className="entry-summary">

          <div className="entry-summary-item">
            <span>تعداد اقلام</span>
            <strong>۰</strong>
          </div>

          <div className="entry-summary-item">
            <span>مبلغ کل</span>
            <strong>۰</strong>
          </div>

        </div>

      </section>

      {/* توضیحات و عملیات */}
      <section className="entry-section">

        <div className="entry-section-header">
          <div>
            <h2>توضیحات</h2>
            <p>اطلاعات تکمیلی این سند</p>
          </div>
        </div>

        <label className="entry-field">
          <span>یادداشت</span>
          <textarea
            rows="3"
            placeholder="توضیحات اختیاری درباره این سند..."
          />
        </label>

        <div className="entry-form-actions">

          <button type="button" className="entry-submit-button" disabled>
            ثبت نهایی سند
          </button>

          <button type="button" className="entry-draft-button" disabled>
            ذخیره پیش‌نویس
          </button>

        </div>

      </section>

    </div>
  );
}

export default InventoryEntry;
