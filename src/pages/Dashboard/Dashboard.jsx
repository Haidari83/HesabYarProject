import Alert from '../../components/ui/Alert';

// قاب مشترک جدول‌ها
import DataTableShell from '../../components/ui/DataTableShell';

// نمایش وضعیت خالی جدول
import EmptyState from '../../components/ui/EmptyState';
import './dashboard.css';

// اطلاعات آزمایشی کارت‌های داشبورد
const metrics = [
  {
    id: 'sales',
    title: 'فروش خالص',
    value: '۸۶٬۴۵۰',
    unit: 'افغانی',
    change: '۱۲٫۸٪',
    description: 'نسبت به دوره قبل',
    icon: 'sales',
    trend: 'positive',
  },
  {
    id: 'profit',
    title: 'سود ناخالص',
    value: '۱۴٬۷۲۰',
    unit: 'افغانی',
    change: '۸٫۲٪',
    description: 'نسبت به دوره قبل',
    icon: 'profit',
    trend: 'positive',
  },
  {
    id: 'invoices',
    title: 'تعداد فاکتورها',
    value: '۱۲۶',
    unit: 'فاکتور',
    change: '۵٫۴٪',
    description: 'نسبت به دوره قبل',
    icon: 'invoice',
    trend: 'positive',
  },
  {
    id: 'receipts',
    title: 'دریافت‌ها',
    value: '۷۲٬۳۰۰',
    unit: 'افغانی',
    change: '۹٫۱٪',
    description: 'نسبت به دوره قبل',
    icon: 'payment',
    trend: 'positive',
  },
];

// اطلاعات آزمایشی نمودار فروش هفتگی
const weeklySales = [
  { day: 'شنبه', amount: '۱۲٬۵۰۰', height: 42 },
  { day: 'یکشنبه', amount: '۱۸٬۲۰۰', height: 61 },
  { day: 'دوشنبه', amount: '۱۴٬۶۰۰', height: 49 },
  { day: 'سه‌شنبه', amount: '۲۲٬۸۰۰', height: 76 },
  { day: 'چهارشنبه', amount: '۱۷٬۴۰۰', height: 58 },
  { day: 'پنجشنبه', amount: '۲۷٬۵۰۰', height: 92 },
  { day: 'جمعه', amount: '۲۰٬۱۰۰', height: 68 },
];

// اطلاعات آزمایشی خلاصه مالی
const financialSummary = [
  {
    id: 'cash',
    title: 'موجودی صندوق',
    value: '۴۵٬۰۰۰',
    unit: 'افغانی',
  },
  {
    id: 'bank',
    title: 'موجودی بانک',
    value: '۱۲۰٬۰۰۰',
    unit: 'افغانی',
  },
  {
    id: 'receivables',
    title: 'مطالبات از مشتریان',
    value: '۲۳٬۶۰۰',
    unit: 'افغانی',
  },
  {
    id: 'payables',
    title: 'بدهی به تأمین‌کنندگان',
    value: '۱۸٬۲۰۰',
    unit: 'افغانی',
  },
];

// اطلاعات آزمایشی کالاهای کم‌موجود
const stockAlerts = [
  {
    id: 1,
    name: 'روغن مایع ۵ لیتری',
    code: 'PR-1002',
    current: '۳ عدد',
    minimum: '۱۰ عدد',
  },
  {
    id: 2,
    name: 'برنج پاکستانی',
    code: 'PR-1015',
    current: '۵ کیلوگرام',
    minimum: '۲۰ کیلوگرام',
  },
  {
    id: 3,
    name: 'چای سیاه',
    code: 'PR-1031',
    current: '۲ بسته',
    minimum: '۸ بسته',
  },
];

// اطلاعات آزمایشی آخرین فروش‌ها
const recentSales = [
  {
    id: 'INV-1026',
    customer: 'احمد محمدی',
    time: '۱۰:۲۵',
    amount: '۳٬۵۰۰',
    status: 'paid',
    statusLabel: 'تسویه‌شده',
  },
  {
    id: 'INV-1025',
    customer: 'فروش نقدی',
    time: '۱۰:۱۰',
    amount: '۱٬۸۰۰',
    status: 'paid',
    statusLabel: 'تسویه‌شده',
  },
  {
    id: 'INV-1024',
    customer: 'محمد رضایی',
    time: '۰۹:۴۵',
    amount: '۵٬۲۰۰',
    status: 'pending',
    statusLabel: 'باقی‌مانده',
  },
  {
    id: 'INV-1023',
    customer: 'علی احمدی',
    time: '۰۹:۲۰',
    amount: '۲٬۴۰۰',
    status: 'paid',
    statusLabel: 'تسویه‌شده',
  },
];

// اطلاعات آزمایشی کالاهای پرفروش
const topProducts = [
  {
    id: 1,
    name: 'برنج پاکستانی',
    sold: '۸۴',
    percentage: 88,
  },
  {
    id: 2,
    name: 'روغن مایع',
    sold: '۶۷',
    percentage: 70,
  },
  {
    id: 3,
    name: 'چای سیاه',
    sold: '۵۲',
    percentage: 55,
  },
  {
    id: 4,
    name: 'شکر',
    sold: '۳۸',
    percentage: 40,
  },
];

// نمایش آیکون کارت‌های آماری
function MetricIcon({ type }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (type) {
    case 'sales':
      return (
        <svg {...commonProps}>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 4 3 6-7" />
        </svg>
      );

    case 'profit':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 .8-3 2s1.3 2 3 2 3 .8 3 2-1.3 2-3 2c-1.3 0-2.3-.3-3-1" />
          <path d="M12.5 5.5v13" />
        </svg>
      );

    case 'invoice':
      return (
        <svg {...commonProps}>
          <path d="M7 3h10l3 3v15H7z" />
          <path d="M17 3v4h4" />
          <path d="M10 12h7M10 16h7" />
        </svg>
      );

    case 'payment':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );

    default:
      return null;
  }
}

function Dashboard() {
  return (
    <div className="dashboard">

      {/* هشدار نمایشی بودن اطلاعات */}

      <Alert variant="info" inline role="note">
        این صفحه با اطلاعات آزمایشی نمایش داده می‌شود.
      </Alert>

      {/* کارت‌های شاخص اصلی */}
      <section className="dashboard-metrics">
        {metrics.map((item) => (
          <article className="dashboard-metric-card" key={item.id}>
            <div className="dashboard-metric-heading">
              <span className={`dashboard-metric-icon icon-${item.icon}`}>
                <MetricIcon type={item.icon} />
              </span>

              <span className="dashboard-metric-title">
                {item.title}
              </span>
            </div>

            <div className="dashboard-metric-value">
              {item.value}
              <span>{item.unit}</span>
            </div>

            <div className="dashboard-metric-footer">
              <span className={`dashboard-trend ${item.trend}`}>
                ↑ {item.change}
              </span>
              <span>{item.description}</span>
            </div>
          </article>
        ))}
      </section>

      {/* نمودار فروش و خلاصه مالی */}
      <div className="dashboard-main-grid">

        <section className="dashboard-card dashboard-sales-card">
          <div className="dashboard-card-header">
            <div>
              <h2>روند فروش</h2>
              <p>میزان فروش در هفت روز اخیر</p>
            </div>

            <span className="dashboard-period-label">
              ۷ روز اخیر
            </span>
          </div>

          <div className="dashboard-chart">
            <div className="dashboard-chart-values">
              <span>۳۰٬۰۰۰</span>
              <span>۲۰٬۰۰۰</span>
              <span>۱۰٬۰۰۰</span>
              <span>۰</span>
            </div>

            <div className="dashboard-chart-content">
              <div className="dashboard-chart-grid">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="dashboard-chart-columns">
                {weeklySales.map((item) => (
                  <div className="dashboard-chart-column" key={item.day}>
                    <div
                      className="dashboard-chart-bar"
                      style={{ height: `${item.height}%` }}
                      title={`${item.day}: ${item.amount} افغانی`}
                    ></div>

                    <span>{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card dashboard-financial-card">
          <div className="dashboard-card-header">
            <div>
              <h2>خلاصه وضعیت مالی</h2>
              <p>وضعیت فعلی حساب‌ها</p>
            </div>
          </div>

          <div className="dashboard-financial-list">
            {financialSummary.map((item) => (
              <div className="dashboard-financial-item" key={item.id}>
                <span>{item.title}</span>

                <strong>
                  {item.value}
                  <small>{item.unit}</small>
                </strong>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* آخرین فروش‌ها و کالاهای پرفروش */}
      <div className="dashboard-bottom-grid">

        {/* =========================================
    جدول آخرین فروش‌ها
========================================= */}

        <DataTableShell
          title="آخرین فروش‌ها"
          description="آخرین فاکتورهای ثبت‌شده"

          // نمایش تعداد فاکتورها در سربرگ
          actions={
            <span className="dashboard-count-badge">
              {recentSales.length} فاکتور
            </span>
          }
        >

          <table className="ui-data-table dashboard-table">

            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>مشتری</th>
                <th>زمان</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
              </tr>
            </thead>


            <tbody>

              {recentSales.map((sale) => (

                <tr key={sale.id}>

                  <td>{sale.id}</td>

                  <td>{sale.customer}</td>

                  <td>{sale.time}</td>

                  <td>{sale.amount} افغانی</td>

                  <td>
                    <span
                      className={`dashboard-status ${sale.status}`}
                    >
                      {sale.statusLabel}
                    </span>
                  </td>

                </tr>

              ))}


              {/* اگر هیچ فروشی ثبت نشده باشد */}
              {recentSales.length === 0 && (

                <tr>
                  <td colSpan={5}>

                    <EmptyState
                      variant="table"
                      title="فروشی ثبت نشده است."
                      description="پس از ثبت فاکتورهای فروش، اطلاعات آن‌ها در این بخش نمایش داده می‌شود."
                    />

                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </DataTableShell>

        <section className="dashboard-card dashboard-top-products">
          <div className="dashboard-card-header">
            <div>
              <h2>کالاهای پرفروش</h2>
              <p>بر اساس تعداد فروش</p>
            </div>
          </div>

          <div className="dashboard-products-list">
            {topProducts.map((product) => (
              <div className="dashboard-product-item" key={product.id}>
                <div className="dashboard-product-info">
                  <span>{product.name}</span>
                  <strong>{product.sold} فروش</strong>
                </div>

                <div className="dashboard-progress">
                  <span style={{ width: `${product.percentage}%` }}></span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* هشدارهای انبار */}
      <section className="dashboard-card dashboard-stock-card">
        <div className="dashboard-card-header">
          <div>
            <h2>هشدار کمبود موجودی</h2>
            <p>کالاهایی که موجودی آن‌ها به حداقل رسیده است</p>
          </div>

          <span className="dashboard-warning-badge">
            {stockAlerts.length} کالا
          </span>
        </div>

        <div className="dashboard-stock-list">
          {stockAlerts.map((item) => (
            <div className="dashboard-stock-item" key={item.id}>
              <div className="dashboard-stock-name">
                <strong>{item.name}</strong>
                <span>{item.code}</span>
              </div>

              <div className="dashboard-stock-quantity">
                <span>موجودی فعلی: <strong>{item.current}</strong></span>
                <span>حداقل موجودی: {item.minimum}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

export default Dashboard;
