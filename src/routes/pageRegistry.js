
/* =========================
   ساختار منوی اصلی حساب‌یار
========================= */

export const navigationItems = [

  // صفحه داشبورد
  {
    id: 'dashboard',
    label: 'داشبورد',
    icon: 'dashboard',
    description: 'نمای کلی وضعیت مالی و فعالیت‌های حساب‌یار.'
  },

  // محصولات و انبار
  {
    id: 'products',
    label: 'محصولات و انبار',
    icon: 'package',
    children: [
      {
        id: 'product-list',
        label: 'فهرست محصولات',
        description: 'مدیریت و مشاهده فهرست محصولات.'
      },
      {
        id: 'categories',
        label: 'دسته‌بندی محصولات',
        description: 'مدیریت دسته‌بندی محصولات.'
      },
      {
        id: 'inventory',
        label: 'موجودی انبار',
        description: 'بررسی موجودی و وضعیت انبار.'
      }
    ]
  },

  // فروش و فاکتورها
  {
    id: 'sales',
    label: 'فروش و فاکتورها',
    icon: 'sales',
    children: [
      {
        id: 'sales-list',
        label: 'فهرست فاکتورهای فروش',
        description: 'مشاهده و مدیریت فاکتورهای فروش.'
      },
      {
        id: 'new-sale',
        label: 'ثبت فروش',
        description: 'ثبت و مدیریت فروش جدید.'
      }
    ]
  },

  // خرید
  {
    id: 'purchases',
    label: 'خرید',
    icon: 'purchases',
    children: [
      {
        id: 'purchases-list',
        label: 'فهرست خریدها',
        description: 'مشاهده و مدیریت خریدهای ثبت‌شده.'
      },
      {
        id: 'new-purchase',
        label: 'ثبت خرید',
        description: 'ثبت خرید جدید.'
      }
    ]
  },

  // مشتریان و تأمین‌کنندگان
  {
    id: 'contacts',
    label: 'مشتریان و تأمین‌کنندگان',
    icon: 'contacts',
    children: [
      {
        id: 'customers',
        label: 'مشتریان',
        description: 'مدیریت اطلاعات مشتریان.'
      },
      {
        id: 'suppliers',
        label: 'تأمین‌کنندگان',
        description: 'مدیریت اطلاعات تأمین‌کنندگان.'
      }
    ]
  },

  // بدهکاری و طلبکاری
  {
    id: 'accounts',
    label: 'بدهکاری و طلبکاری',
    icon: 'accounts',
    children: [
      {
        id: 'debts',
        label: 'بدهکاری‌ها',
        description: 'مدیریت بدهی‌های اشخاص.'
      },
      {
        id: 'receivables',
        label: 'طلبکاری‌ها',
        description: 'مدیریت مطالبات و طلب‌ها.'
      }
    ]
  },

  // گزارش‌ها
  {
    id: 'reports',
    label: 'گزارش‌ها',
    icon: 'reports',
    children: [
      {
        id: 'sales-reports',
        label: 'گزارش فروش',
        description: 'مشاهده گزارش‌های فروش.'
      },
      {
        id: 'purchase-reports',
        label: 'گزارش خرید',
        description: 'مشاهده گزارش‌های خرید.'
      },
      {
        id: 'inventory-reports',
        label: 'گزارش موجودی',
        description: 'مشاهده گزارش‌های موجودی انبار.'
      }
    ]
  },

  // تنظیمات
  {
    id: 'settings',
    label: 'تنظیمات',
    icon: 'settings',
    description: 'مدیریت تنظیمات برنامه.'
  }

];


/* =========================
   ساخت فهرست صفحات
========================= */

// تبدیل ساختار درختی منو به فهرست صفحات قابل نمایش
function createPageRegistry(items, parentLabels = []) {

  const registry = {};

  items.forEach((item) => {

    // اگر بخش دارای زیرمنو باشد، فرزندان آن را بررسی می‌کنیم
    if (item.children?.length) {

      const childRegistry = createPageRegistry(
        item.children,
        [...parentLabels, item.label]
      );

      Object.assign(registry, childRegistry);

    } else {

      // ثبت اطلاعات هر صفحه
      registry[item.id] = {
        id: item.id,
        title: item.label,
        description: item.description || '',

        // مسیر صفحه از داشبورد تا صفحه فعلی
        breadcrumbs:
          item.id === 'dashboard'
            ? []
            : ['داشبورد', ...parentLabels]
      };

    }

  });

  return registry;
}


/* =========================
   فهرست مرکزی صفحات
========================= */

// اطلاعات صفحات از ساختار اصلی منو استخراج می‌شود
export const pageRegistry = createPageRegistry(navigationItems);
