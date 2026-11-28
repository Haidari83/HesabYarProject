
/* =========================
   ساختار منوی اصلی حساب‌یار
========================= */

export const navigationItems = [

  // صفحه داشبورد
  {
    id: 'dashboard',
    label: 'داشبورد',
    icon: 'dashboard',
    description: 'نمای کلی وضعیت مالی و فعالیت‌های حساب‌یار.',
    requiredPermission: 'dashboard.view',
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
        description: 'مدیریت و مشاهده فهرست محصولات.',
        requiredPermission: 'products.view',
      },
      {
        id: 'categories',
        label: 'دسته‌بندی محصولات',
        description: 'مدیریت دسته‌بندی محصولات.',
        requiredPermission: 'categories.view',
      },
      {
        id: 'units',
        label: 'واحدهای اندازه‌گیری',
        description: 'مدیریت واحدهای استاندارد و بسته‌بندی',
        requiredPermission: 'units.view',
      },
      {
        id: 'inventory-stock-list',
        label: 'فهرست موجودی',
        description: 'مشاهده و بررسی موجودی کالاهای انبار.',
        requiredPermission: 'inventory.stock_list.view',
      },
      {
        id: 'inventory-entry',
        label: 'ورود کالا',
        description: 'ثبت و مدیریت ورود کالا به انبار.',
        requiredPermission: 'inventory.entry.create',
      },
      {
        id: 'inventory-documents',
        label: 'فهرست اسناد انبار',
        description: 'مشاهده و پیگیری اسناد ثبت‌شده انبار.',
        requiredPermission: 'inventory.documents.view',
      },
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
        description: 'مشاهده و مدیریت فاکتورهای فروش.',
        requiredPermission: 'sales.documents.view',
      },
      {
        id: 'new-sale',
        label: 'ثبت فروش',
        description: 'ثبت و مدیریت فروش جدید.',
        requiredPermission: 'sales.create',
      }
    ]
  },

  // خرید
  {
    id: 'purchases',
    label: 'خرید',
    icon: 'purchases',
    adminOnly: true,
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
    adminOnly: true,
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
    adminOnly: true,
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
    adminOnly: true,
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
    children: [
      {
        id: 'users',
        label: 'مدیریت کاربران',
        description: 'ایجاد و مدیریت حساب‌های کاربری و دسترسی‌ها.',
        adminOnly: true,

      }
    ]
  }

];


/* =========================
   ساخت فهرست صفحات
========================= */


// تبدیل ساختار درختی منو به فهرست صفحات قابل نمایش
function createPageRegistry(
  items,
  parentLabels = [],
  parentAdminOnly = false
) {

  const registry = {};

  items.forEach((item) => {

    // محدودیت مدیریتی والد به فرزندان نیز منتقل می‌شود
    const adminOnly =
      parentAdminOnly || item.adminOnly === true;


    // بررسی زیرمنوها
    if (item.children?.length) {

      const childRegistry = createPageRegistry(
        item.children,
        [...parentLabels, item.label],
        adminOnly
      );

      Object.assign(registry, childRegistry);

    } else {

      // ثبت اطلاعات و مجوز صفحه
      registry[item.id] = {
        id: item.id,
        title: item.label,
        description: item.description || '',

        requiredPermission:
          item.requiredPermission || null,

        adminOnly,

        // مسیر صفحه از داشبورد تا صفحه فعلی
        breadcrumbs:
          item.id === 'dashboard'
            ? []
            : ['داشبورد', ...parentLabels],
      };

    }

  });

  return registry;

}



/* =========================
   فهرست مرکزی صفحات
========================= */

// استخراج اطلاعات تمام صفحات از ساختار منوی اصلی
export const pageRegistry = createPageRegistry(navigationItems);


// بررسی داشتن یک مجوز مشخص
export function hasPermission(user, permissionKey) {

  if (!user) {
    return false;
  }

  // مدیر سیستم تمام مجوزها را دارد
  if (user.role === 'admin') {
    return true;
  }

  return (
    user.role === 'user' &&
    Array.isArray(user.permissions) &&
    user.permissions.includes(permissionKey)
  );

}


// بررسی اجازه مشاهده یک صفحه
export function canAccessPage(user, pageId) {

  const page = pageRegistry[pageId];

  if (!user || !page) {
    return false;
  }

  // صفحات مخصوص مدیران
  if (page.adminOnly && user.role !== 'admin') {
    return false;
  }

  // بررسی مجوز اختصاصی صفحه
  if (page.requiredPermission) {
    return hasPermission(
      user,
      page.requiredPermission
    );
  }

  // صفحات بدون مجوز مشخص فقط برای مدیر قابل نمایش هستند
  return user.role === 'admin';

}


// فیلترکردن منو بر اساس مجوزهای کاربر
export function filterNavigationItems(items, user) {

  if (!user) {
    return [];
  }

  return items.flatMap((item) => {

    // محدودیت مدیریتی
    if (
      item.adminOnly &&
      user.role !== 'admin'
    ) {
      return [];
    }


    // بررسی زیرمنوها
    if (item.children?.length) {

      const visibleChildren = filterNavigationItems(
        item.children,
        user
      );

      // اگر هیچ فرزند قابل نمایشی وجود ندارد،
      // خود گروه نیز نمایش داده نمی‌شود.
      if (visibleChildren.length === 0) {
        return [];
      }

      return [{
        ...item,
        children: visibleChildren,
      }];

    }


    // بررسی مجوز صفحه
    if (item.requiredPermission) {

      return hasPermission(
        user,
        item.requiredPermission
      )
        ? [item]
        : [];

    }

    // صفحات بدون مجوز مشخص فقط برای مدیر نمایش داده می‌شوند
    return user.role === 'admin' ? [item] : [];

  });

}
