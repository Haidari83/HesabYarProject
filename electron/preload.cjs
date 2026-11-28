
const {
  contextBridge,
  ipcRenderer,
} = require('electron');


// ارائه API محدود و مشخص به رابط کاربری
contextBridge.exposeInMainWorld('hesabyar', {

  system: {

    // بررسی اینکه آیا مدیر اولیه قبلاً ساخته شده است
    getSetupStatus: () =>
      ipcRenderer.invoke('system:get-setup-status'),

  },
  auth: {

    // ایجاد نخستین مدیر سیستم
    createInitialAdmin: (data) =>
      ipcRenderer.invoke('auth:create-initial-admin', data),

    // بررسی اطلاعات ورود
    login: (credentials) =>
      ipcRenderer.invoke('auth:login', credentials),

    // دریافت کاربر دارای نشست فعال
    getCurrentSession: () =>
      ipcRenderer.invoke('auth:get-current-session'),

    // خروج از حساب کاربری
    logout: () =>
      ipcRenderer.invoke('auth:logout'),


    // تغییر نام کاربری
    changeUsername: (input) =>
      ipcRenderer.invoke(
        'auth:change-username',
        input
      ),

    // تغییر نام کاربر
    changeDisplayName: (input) =>
      ipcRenderer.invoke(
        'auth:change-display-name',
        input
      ),

    // ذخیره تصویر پروفایل
    setProfileImage: (input) =>
      ipcRenderer.invoke(
        'auth:set-profile-image',
        input
      ),
    // تغییر گذرواژه اصلی
    changePassword: (input) =>
      ipcRenderer.invoke(
        'auth:change-password',
        input
      ),


    // تنظیم یا تغییر PIN
    setPin: (input) =>
      ipcRenderer.invoke(
        'auth:set-pin',
        input
      ),


    // حذف PIN
    removePin: (input) =>
      ipcRenderer.invoke(
        'auth:remove-pin',
        input
      ),

  },
  users: {

    // دریافت فهرست مجوزهای قابل انتخاب
    getPermissionCatalog: () =>
      ipcRenderer.invoke('users:get-permission-catalog'),

    // دریافت فهرست کاربران
    list: () =>
      ipcRenderer.invoke('users:list'),

    // ایجاد کاربر جدید
    create: (input) =>
      ipcRenderer.invoke('users:create', input),


    // ویرایش اطلاعات و دسترسی‌های کاربر
    update: (userId, input) =>
      ipcRenderer.invoke(
        'users:update',
        userId,
        input
      ),


    // فعال یا غیرفعال کردن حساب کاربری
    setActive: (userId, isActive) =>
      ipcRenderer.invoke(
        'users:set-active',
        userId,
        isActive
      ),

  },

  // API مدیریت دسته‌بندی‌ها
  categories: {

    // دریافت فهرست دسته‌بندی‌ها
    list: () =>
      ipcRenderer.invoke('categories:list'),


    // ایجاد یک دسته‌بندی
    create: (input) =>
      ipcRenderer.invoke(
        'categories:create',
        input
      ),


    // ایجاد گروهی دسته‌بندی‌ها
    createBulk: (inputs) =>
      ipcRenderer.invoke(
        'categories:create-bulk',
        inputs
      ),


    // ویرایش دسته‌بندی
    update: (categoryId, input) =>
      ipcRenderer.invoke(
        'categories:update',
        categoryId,
        input
      ),


    // فعال یا غیرفعال کردن دسته‌بندی
    setActive: (categoryId, isActive) =>
      ipcRenderer.invoke(
        'categories:set-active',
        categoryId,
        isActive
      ),


    // حذف دسته‌بندی
    delete: (categoryId) =>
      ipcRenderer.invoke(
        'categories:delete',
        categoryId
      ),

  },


  // API مدیریت واحدهای اندازه‌گیری
  units: {

    // دریافت فهرست واحدها
    list: () =>
      ipcRenderer.invoke('units:list'),


    // ایجاد یک واحد
    create: (input) =>
      ipcRenderer.invoke(
        'units:create',
        input
      ),


    // ثبت گروهی واحدها
    createBulk: (inputs) =>
      ipcRenderer.invoke(
        'units:create-bulk',
        inputs
      ),


    // ویرایش اطلاعات واحد
    update: (unitId, input) =>
      ipcRenderer.invoke(
        'units:update',
        unitId,
        input
      ),


    // فعال یا غیرفعال کردن واحد
    setActive: (unitId, isActive) =>
      ipcRenderer.invoke(
        'units:set-active',
        unitId,
        isActive
      ),


    // حذف واحد سفارشی
    delete: (unitId) =>
      ipcRenderer.invoke(
        'units:delete',
        unitId
      ),

  },

  // API مدیریت محصولات
  products: {

    // دریافت فهرست محصولات
    list: () =>
      ipcRenderer.invoke('products:list'),


    // دریافت دسته‌بندی‌ها، واحدها و ارزهای فعال
    getFormOptions: () =>
      ipcRenderer.invoke('products:form-options'),


    // ثبت یک محصول
    create: (input) =>
      ipcRenderer.invoke(
        'products:create',
        input
      ),


    // ثبت گروهی محصولات
    createBulk: (inputs) =>
      ipcRenderer.invoke(
        'products:create-bulk',
        inputs
      ),


    // ویرایش محصول
    update: (productId, input) =>
      ipcRenderer.invoke(
        'products:update',
        productId,
        input
      ),

    // ثبت یا تغییر قیمت‌های محصول
    savePrices: (productId, input) =>
      ipcRenderer.invoke(
        'products:prices:save',
        productId,
        input
      ),

    // فعال یا غیرفعال کردن محصول
    setActive: (productId, isActive) =>
      ipcRenderer.invoke(
        'products:set-active',
        productId,
        isActive
      ),

  },

  // API مدیریت فروش و فاکتورها
  sales: {

    // دریافت کالاها، قیمت‌های فروش، موجودی و ارزها
    getFormOptions: () =>
      ipcRenderer.invoke(
        'sales:form-options'
      ),
    // ثبت پیش‌نویس فاکتور فروش
    createDraft: (input) =>
      ipcRenderer.invoke(
        'sales:create-draft',
        input
      ),

  },
  // API مدیریت موجودی انبار
  inventory: {

    // دریافت محصولات، واحدها و ارزهای موردنیاز فرم ورود کالا
    getEntryFormOptions: (documentType) =>
      ipcRenderer.invoke(
        'inventory:entry:form-options',
        documentType
      ),

    // ثبت پیش‌نویس سند ورود کالا
    createEntryDraft: (input) =>
      ipcRenderer.invoke(
        'inventory:entry:create-draft',
        input
      ),
    // ثبت نهایی سند ورود کالا
    postDocument: (documentId) =>
      ipcRenderer.invoke(
        'inventory:document:post',
        documentId
      ),
    // دریافت فهرست اسناد انبار
    listDocuments: (filters) =>
      ipcRenderer.invoke(
        'inventory:documents:list',
        filters
      ),

    // دریافت فهرست موجودی کالاها
    listStock: () =>
      ipcRenderer.invoke(
        'inventory:stock:list'
      ),
  },
});
