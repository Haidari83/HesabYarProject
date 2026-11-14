
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
  },

});
