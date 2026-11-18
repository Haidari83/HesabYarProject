
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

});
