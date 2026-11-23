import { useBusinessData } from '../../context/BusinessDataContext';
import { canAccessPage } from '../../routes/pageRegistry';
import { formatNumber } from '../../utils/numberFormat';

import './inventory-overview.css';

// تنظیم قالب اعداد در نمای کلی انبار
const INVENTORY_OVERVIEW_NUMBER_OPTIONS = {
  maximumFractionDigits: 3,
};

// اطلاعات نمایشی عملیات امروز
const todayOperations = [
  { id: 1, title: 'ورود کالا', count: 4, symbol: '+' },
  { id: 2, title: 'خروج کالا', count: 7, symbol: '−' },
  { id: 3, title: 'اصلاح موجودی', count: 2, symbol: '↻' },
];

// اطلاعات نمایشی فعالیت‌های اخیر
const recentActivities = [
  {
    id: 1,
    title: 'ثبت ورود کالا',
    description: 'برنج پاکستانی',
    user: 'مدیر سیستم',
    time: '۱۰:۴۵',
    type: 'in',
  },
  {
    id: 2,
    title: 'ثبت خروج کالا',
    description: 'روغن مایع ۵ لیتری',
    user: 'کاربر انبار',
    time: '۱۰:۲۰',
    type: 'out',
  },
  {
    id: 3,
    title: 'اصلاح موجودی',
    description: 'چای سیاه',
    user: 'مدیر سیستم',
    time: '۰۹:۵۵',
    type: 'adjust',
  },
];


const quickActions = [
  {
    id: 1,
    title: 'ورود کالا',
    description: 'ثبت ورود کالا به انبار',
    icon: '＋',
    className: 'quick-action-in',
    pageId: 'inventory-entry',
  },
  {
    id: 2,
    title: 'خروج کالا',
    description: 'ثبت خروج کالا از انبار',
    icon: '−',
    className: 'quick-action-out',
  },
  {
    id: 3,
    title: 'اصلاح موجودی',
    description: 'اصلاح مقدار موجودی کالا',
    icon: '↻',
    className: 'quick-action-adjust',
  },
  {
    id: 4,
    title: 'فهرست موجودی',
    description: 'مشاهده موجودی تمام کالاها',
    icon: '▤',
    className: 'quick-action-list',
    pageId: 'inventory-stock-list',
  },
];

// فقط عملیات‌هایی که کاربر اجازه مشاهده آن‌ها را دارد
function getVisibleQuickActions(user) {

  return quickActions.filter((action) => {

    // گزینه‌های نمایشی و غیرفعال بدون تغییر باقی می‌مانند
    if (!action.pageId) {
      return true;
    }

    return canAccessPage(
      user,
      action.pageId
    );

  });

}

function InventoryOverview({ onNavigate, currentUser }) {
  const { products, units } = useBusinessData();
  const visibleQuickActions = getVisibleQuickActions(currentUser);

  // فقط کالاهای فعال در شاخص تعداد کالاهای فعال محاسبه می‌شوند
  const activeProducts = products.filter(
    (product) => product.isActive
  );

  // وضعیت موجودی همه کالاها بررسی می‌شود؛
  // زیرا غیرفعال بودن کالا لزوماً به معنی صفر بودن موجودی آن نیست.
  const inStockProducts = products.filter(
    (product) => Number(product.stock) > 0
  );

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.stock) > 0 &&
      product.minStock !== undefined &&
      Number(product.stock) <= Number(product.minStock)
  );

  const outOfStockProducts = products.filter(
    (product) => Number(product.stock) <= 0
  );

  // پیدا کردن واحد اندازه‌گیری هر کالا
  const getUnitName = (unitId) => {
    const unit = units.find((item) => item.id === unitId);
    return unit?.symbol || unit?.name || '';
  };

  const metrics = [
    {
      id: 1,
      title: 'کالاهای فعال',
      value: activeProducts.length,
      description: 'کالاهای قابل استفاده در سیستم',
      icon: '▦',
      className: 'inventory-metric-primary',
    },
    {
      id: 2,
      title: 'دارای موجودی',
      value: inStockProducts.length,
      description: 'کالاهای دارای موجودی مثبت',
      icon: '✓',
      className: 'inventory-metric-success',
    },
    {
      id: 3,
      title: 'کم‌موجود',
      value: lowStockProducts.length,
      description: 'رسیده به حداقل موجودی یا کمتر',
      icon: '!',
      className: 'inventory-metric-warning',
    },
    {
      id: 4,
      title: 'ناموجود',
      value: outOfStockProducts.length,
      description: 'کالاهای دارای موجودی صفر',
      icon: '×',
      className: 'inventory-metric-danger',
    },
  ];

  return (
    <div className="inventory-overview">

      {/* پیام نمایشی بودن اطلاعات */}
      <div className="inventory-demo-notice">
        <span className="inventory-demo-dot"></span>
        اطلاعات این صفحه در حال حاضر آزمایشی است.
      </div>

      {/* شاخص‌های اصلی انبار */}
      <section className="inventory-metrics">
        {metrics.map((metric) => (
          <article className="inventory-metric-card" key={metric.id}>
            <div className="inventory-metric-top">
              <div className={`inventory-metric-icon ${metric.className}`}>
                {metric.icon}
              </div>

              <span className="inventory-metric-title">
                {metric.title}
              </span>
            </div>

            <strong className="inventory-metric-value">
              {formatNumber(
                metric.value,
                INVENTORY_OVERVIEW_NUMBER_OPTIONS
              )}
              <span>کالا</span>
            </strong>

            <p className="inventory-metric-description">
              {metric.description}
            </p>
          </article>
        ))}
      </section>

      {/* عملیات امروز */}
      <section className="inventory-section">
        <div className="inventory-section-header">
          <div>
            <h2>عملیات امروز</h2>
            <p>خلاصه اسناد ثبت‌شده در انبار</p>
          </div>
          <span className="inventory-section-date">امروز</span>
        </div>

        <div className="inventory-operations">
          {todayOperations.map((operation) => (
            <div className="inventory-operation-card" key={operation.id}>
              <span className="inventory-operation-symbol">
                {operation.symbol}
              </span>

              <div>
                <strong>
                  {formatNumber(
                    operation.count,
                    INVENTORY_OVERVIEW_NUMBER_OPTIONS
                  )}
                </strong>
                <span>{operation.title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* دسترسی سریع */}
      <section className="inventory-section">
        <div className="inventory-section-header">
          <div>
            <h2>دسترسی سریع</h2>
            <p>دسترسی به عملیات پرکاربرد انبار</p>
          </div>
        </div>

        <div className="inventory-quick-actions">
          {visibleQuickActions.map((action) => (
            <button
              type="button"
              className="inventory-quick-action"
              key={action.id}
              disabled={!action.pageId}
              onClick={() => {
                if (action.pageId) {
                  onNavigate(action.pageId);
                }
              }}
              title={
                action.pageId
                  ? 'مشاهده فهرست موجودی'
                  : 'این قابلیت در مرحله بعد فعال خواهد شد'
              }
            >
              <span className={`inventory-quick-action-icon ${action.className}`}>
                {action.icon}
              </span>

              <span className="inventory-quick-action-content">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>

              <span className="inventory-quick-action-arrow">←</span>
            </button>
          ))}
        </div>
      </section>


      {/* هشدارهای موجودی */}
      <section className="inventory-section">
        <div className="inventory-section-header">
          <div>
            <h2>هشدارهای موجودی</h2>
            <p>کالاهایی که نیاز به بررسی دارند</p>
          </div>
          <span className="inventory-alert-count">
            {formatNumber(
              lowStockProducts.length + outOfStockProducts.length,
              INVENTORY_OVERVIEW_NUMBER_OPTIONS
            )} مورد
          </span>
        </div>

        <div className="inventory-alert-list">
          {lowStockProducts.length === 0 &&
            outOfStockProducts.length === 0 ? (
            <p className="inventory-empty">
              در حال حاضر هشداری برای موجودی کالاها وجود ندارد.
            </p>
          ) : (
            <>
              {outOfStockProducts.map((product) => (
                <div className="inventory-alert-item" key={product.id}>
                  <span className="inventory-alert-icon danger">×</span>
                  <div className="inventory-alert-info">
                    <strong>{product.name}</strong>
                    <span>موجودی این کالا به صفر رسیده است.</span>
                  </div>
                  <span className="inventory-alert-status danger">
                    ناموجود
                  </span>
                </div>
              ))}

              {lowStockProducts.map((product) => (
                <div className="inventory-alert-item" key={product.id}>
                  <span className="inventory-alert-icon warning">!</span>
                  <div className="inventory-alert-info">
                    <strong>{product.name}</strong>
                    <span>
                      حداقل موجودی: {formatNumber(
                        product.minStock,
                        INVENTORY_OVERVIEW_NUMBER_OPTIONS
                      )}{' '}
                      {getUnitName(product.unitId)}
                    </span>
                  </div>
                  <span className="inventory-alert-status warning">
                    {formatNumber(
                      product.stock,
                      INVENTORY_OVERVIEW_NUMBER_OPTIONS
                    )}{' '}
                    {getUnitName(product.unitId)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* فعالیت‌های اخیر */}
      <section className="inventory-section">
        <div className="inventory-section-header">
          <div>
            <h2>فعالیت‌های اخیر</h2>
            <p>آخرین رویدادهای ثبت‌شده در انبار</p>
          </div>
          <span className="inventory-section-date">نمایشی</span>
        </div>

        <div className="inventory-activity-list">
          {recentActivities.map((activity) => (
            <div className="inventory-activity-item" key={activity.id}>
              <span className={`inventory-activity-icon ${activity.type}`}>
                {activity.type === 'in'
                  ? '+'
                  : activity.type === 'out'
                    ? '−'
                    : '↻'}
              </span>

              <div className="inventory-activity-info">
                <strong>{activity.title}</strong>
                <span>{activity.description}</span>
              </div>

              <div className="inventory-activity-user">
                <strong>{activity.user}</strong>
                <span>{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

export default InventoryOverview;
