
/* ==============================
   ماژول‌های موردنیاز
================================ */

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
} = require('electron');

const {
  createInitialAdmin,
  authenticateUser,
  getSessionUser,
  recordLogout,

  changeUsername,
  changePassword,
  changeDisplayName,
  setUserPin,
  removeUserPin,

  setProfileImage,
  getProfileImage,
} = require('./services/authService.cjs');

const {
  createUser,
  getUsers,
  getPermissionCatalog,
  updateUser,
  setUserActive,
} = require('./services/userService.cjs');

// سرویس مدیریت دسته‌بندی کالاها
const {
  getCategories,
  createCategory,
  createCategories,
  updateCategory,
  setCategoryActive,
  deleteCategory,
} = require('./services/categoryService.cjs');


// سرویس مدیریت واحدهای اندازه‌گیری
const {
  getUnits,
  createUnit,
  createUnits,
  updateUnit,
  setUnitActive,
  deleteUnit,
} = require('./services/unitService.cjs');

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { openDatabase } = require('./database.cjs');


/* ==============================
   تنظیمات عمومی
================================ */

// نام برنامه
app.setName('HesabYar');

// آدرس سرور Vite در زمان توسعه
const DEV_SERVER_URL = 'http://localhost:5173';

// پایگاه داده
let database = null;

// پنجره اصلی
let mainWindow = null;

// نشست کاربر فعلی؛ فقط در حافظه Main Process
let activeSession = null;


/* ==============================
   ایجاد یا بازکردن پایگاه داده
================================ */

function initializeDatabase() {

  // مسیر اختصاصی اطلاعات حساب‌یار در ویندوز
  const dataDirectory = path.join(
    app.getPath('userData'),
    'data'
  );

  // ایجاد پوشه در صورت نبودن آن
  fs.mkdirSync(dataDirectory, {
    recursive: true,
  });

  // مسیر فایل SQLite
  const databasePath = path.join(
    dataDirectory,
    'hesabyar.sqlite'
  );

  // اتصال به پایگاه داده
  const db = openDatabase(databasePath);

  console.log('SQLite database initialized successfully.');

  console.log('Database location:', databasePath);

  return db;

}


/* ==============================
   بررسی آدرس مجاز رابط کاربری
================================ */

function isAllowedRendererUrl(url) {

  // در نسخه بسته‌بندی‌شده، فقط فایل اصلی برنامه مجاز است
  if (app.isPackaged) {

    const indexPath = path.resolve(
      __dirname,
      '../dist/index.html'
    );

    return url === pathToFileURL(indexPath).href;

  }

  // در حالت توسعه، فقط مبدأ سرور Vite مجاز است
  try {

    const target = new URL(url);
    const allowed = new URL(DEV_SERVER_URL);

    return target.origin === allowed.origin;

  } catch {

    return false;

  }

}


/* ==============================
   اعتبارسنجی فرستنده پیام IPC
================================ */

function isTrustedRenderer(event) {

  if (!mainWindow) {
    return false;
  }

  // پیام باید از پنجره اصلی برنامه آمده باشد
  if (event.sender !== mainWindow.webContents) {
    return false;
  }

  const frame = event.senderFrame;

  // پیام iframe یا فریم ناشناس پذیرفته نمی‌شود
  if (!frame || frame !== event.sender.mainFrame) {
    return false;
  }

  return isAllowedRendererUrl(frame.url);

}



// بررسی معتبر بودن نشست هر کاربر
function requireAuthenticatedSession(event) {

  // بررسی منبع درخواست
  if (!isTrustedRenderer(event)) {
    throw new Error(
      'درخواست از منبع غیرمجاز ارسال شده است.'
    );
  }


  // بررسی وجود نشست
  if (!activeSession) {
    throw new Error(
      'برای انجام این عملیات ابتدا باید وارد حساب‌یار شوی.'
    );
  }


  // دریافت مجدد اطلاعات کاربر از پایگاه داده
  const actor = getSessionUser(
    database,
    activeSession.userId
  );


  // در صورت نامعتبر بودن نشست، آن را باطل می‌کنیم
  if (!actor) {

    activeSession = null;

    throw new Error(
      'نشست کاربر معتبر نیست. دوباره وارد حساب‌یار شو.'
    );

  }


  return actor;

}


// بررسی هویت و نقش مدیر سیستم
function requireAdminSession(event) {

  // ابتدا باید نشست معتبر باشد
  const actor = requireAuthenticatedSession(event);


  // فقط مدیر اجازه مدیریت کاربران را دارد
  if (actor.role !== 'admin') {
    throw new Error(
      'برای انجام این عملیات دسترسی مدیریتی لازم است.'
    );
  }


  return actor;

}




/* ==============================
   مدیریت ارتباط React و Electron
================================ */

function registerIpcHandlers() {

  // دریافت وضعیت راه‌اندازی اولیه برنامه
  ipcMain.handle(
    'system:get-setup-status',
    (event) => {

      // بررسی هویت پنجره درخواست‌کننده
      if (!isTrustedRenderer(event)) {

        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );

      }

      // بررسی تعداد کاربران ثبت‌شده
      const result = database
        .prepare('SELECT COUNT(*) AS userCount FROM users')
        .get();

      const userCount = Number(result.userCount);

      return {
        needsInitialSetup: userCount === 0,
        userCount,
      };

    }
  );

  // دریافت درخواست ایجاد مدیر اولیه
  ipcMain.handle(
    'auth:create-initial-admin',
    (event, input) => {

      // فقط پنجره اصلی و مجاز برنامه می‌تواند درخواست بفرستد
      if (!isTrustedRenderer(event)) {
        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );
      }

      // ایجاد مدیر در Main Process
      return createInitialAdmin(database, input);

    }
  );


  // ورود کاربر
  ipcMain.handle(
    'auth:login',
    async (event, credentials) => {

      // بررسی معتبر بودن درخواست
      if (!isTrustedRenderer(event)) {
        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );
      }

      // بررسی نام کاربری و گذرواژه در پایگاه داده
      const result = await authenticateUser(
        database,
        credentials,
        safeStorage
      );

      // فقط در صورت ورود موفق، نشست ایجاد می‌شود
      if (result.success) {

        activeSession = {
          userId: result.user.id,
        };

        result.user.profileImage = getProfileImage(
          database,
          result.user.id
        );

      }

      return result;

    }
  );


  // دریافت اطلاعات کاربر دارای نشست فعال
  ipcMain.handle(
    'auth:get-current-session',
    (event) => {

      if (!isTrustedRenderer(event)) {
        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );
      }

      // اگر هیچ کاربری وارد نشده باشد
      if (!activeSession) {
        return null;
      }

      // دریافت دوباره اطلاعات کاربر از SQLite
      const currentUser = getSessionUser(
        database,
        activeSession.userId
      );

      // اگر کاربر غیرفعال یا حذف شده باشد، نشست باطل می‌شود
      if (!currentUser) {

        activeSession = null;

        return null;

      }

      return {
        ...currentUser,
        profileImage: getProfileImage(
          database,
          currentUser.id
        ),
      };

    }
  );


  // خروج کاربر
  ipcMain.handle(
    'auth:logout',
    (event) => {

      if (!isTrustedRenderer(event)) {
        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );
      }

      if (activeSession) {

        // ثبت رویداد خروج
        recordLogout(
          database,
          activeSession.userId
        );

        // پاک‌کردن نشست از حافظه
        activeSession = null;

      }

      return {
        success: true,
      };

    }
  );


  // تغییر نام کاربری حساب فعلی
  ipcMain.handle(
    'auth:change-username',
    (event, input) => {

      // دریافت هویت کاربر دارای نشست معتبر
      const actor = requireAuthenticatedSession(event);

      return changeUsername(
        database,
        actor,
        input
      );

    }
  );

  // تغییر نام کاربر حساب فعلی
  ipcMain.handle(
    'auth:change-display-name',
    (event, input) => {

      const actor = requireAuthenticatedSession(event);

      return changeDisplayName(
        database,
        actor,
        input
      );

    }
  );

  // ذخیره تصویر پروفایل حساب فعلی
  ipcMain.handle(
    'auth:set-profile-image',
    (event, input) => {

      // فقط کاربر دارای نشست معتبر اجازه تغییر عکس خود را دارد
      const actor = requireAuthenticatedSession(event);

      return setProfileImage(
        database,
        actor,
        input
      );

    }
  );
  // تغییر گذرواژه اصلی حساب فعلی
  ipcMain.handle(
    'auth:change-password',
    (event, input) => {

      const actor = requireAuthenticatedSession(event);

      return changePassword(
        database,
        actor,
        input
      );

    }
  );


  // تنظیم یا تغییر PIN پنج‌رقمی
  ipcMain.handle(
    'auth:set-pin',
    async (event, input) => {

      const actor = requireAuthenticatedSession(event);

      return setUserPin(
        database,
        actor,
        input,
        safeStorage
      );

    }
  );


  // حذف PIN حساب فعلی
  ipcMain.handle(
    'auth:remove-pin',
    (event, input) => {

      const actor = requireAuthenticatedSession(event);

      return removeUserPin(
        database,
        actor,
        input
      );

    }
  );

  // دریافت فهرست مجوزهای قابل انتخاب
  ipcMain.handle(
    'users:get-permission-catalog',
    (event) => {

      requireAdminSession(event);

      return getPermissionCatalog();

    }
  );


  // دریافت فهرست کاربران
  ipcMain.handle(
    'users:list',
    (event) => {

      requireAdminSession(event);

      return getUsers(database);

    }
  );


  // ایجاد کاربر جدید
  ipcMain.handle(
    'users:create',
    (event, input) => {

      // دریافت مدیر معتبر از نشست Main Process
      const actor = requireAdminSession(event);

      // ثبت کاربر و مجوزها با هویت مدیر فعلی
      return createUser(
        database,
        actor,
        input
      );

    }
  );


  // ویرایش اطلاعات و دسترسی‌های کاربر
  ipcMain.handle(
    'users:update',
    (event, userId, input) => {

      // بررسی نشست و نقش مدیر
      const actor = requireAdminSession(event);

      return updateUser(
        database,
        actor,
        userId,
        input
      );

    }
  );


  // فعال یا غیرفعال کردن حساب کاربری
  ipcMain.handle(
    'users:set-active',
    (event, userId, isActive) => {

      // بررسی نشست و نقش مدیر
      const actor = requireAdminSession(event);

      return setUserActive(
        database,
        actor,
        userId,
        isActive
      );

    }
  );


  // دریافت فهرست دسته‌بندی‌ها
  ipcMain.handle(
    'categories:list',
    (event) => {

      // دریافت هویت کاربر دارای نشست معتبر
      const actor = requireAuthenticatedSession(event);

      // دریافت فهرست با بررسی مجوز مشاهده
      return getCategories(database, actor);

    }
  );


  // ایجاد یک دسته‌بندی
  ipcMain.handle(
    'categories:create',
    (event, input) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      // ثبت دسته‌بندی در پایگاه داده
      return createCategory(
        database,
        actor,
        input
      );

    }
  );


  // ایجاد گروهی دسته‌بندی‌ها
  ipcMain.handle(
    'categories:create-bulk',
    (event, inputs) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      // ثبت همه دسته‌بندی‌ها در یک تراکنش
      return createCategories(
        database,
        actor,
        inputs
      );

    }
  );


  // ویرایش دسته‌بندی
  ipcMain.handle(
    'categories:update',
    (event, categoryId, input) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return updateCategory(
        database,
        actor,
        categoryId,
        input
      );

    }
  );


  // فعال یا غیرفعال کردن دسته‌بندی
  ipcMain.handle(
    'categories:set-active',
    (event, categoryId, isActive) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return setCategoryActive(
        database,
        actor,
        categoryId,
        isActive
      );

    }
  );


  // حذف دسته‌بندی
  ipcMain.handle(
    'categories:delete',
    (event, categoryId) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return deleteCategory(
        database,
        actor,
        categoryId
      );

    }
  );


  // دریافت فهرست واحدهای اندازه‌گیری
  ipcMain.handle(
    'units:list',
    (event) => {

      // بررسی نشست کاربر
      const actor = requireAuthenticatedSession(event);

      // دریافت واحدها با کنترل مجوز مشاهده
      return getUnits(database, actor);

    }
  );


  // ایجاد یک واحد
  ipcMain.handle(
    'units:create',
    (event, input) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return createUnit(
        database,
        actor,
        input
      );

    }
  );


  // ثبت گروهی واحدها
  ipcMain.handle(
    'units:create-bulk',
    (event, inputs) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return createUnits(
        database,
        actor,
        inputs
      );

    }
  );


  // ویرایش واحد
  ipcMain.handle(
    'units:update',
    (event, unitId, input) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return updateUnit(
        database,
        actor,
        unitId,
        input
      );

    }
  );


  // فعال یا غیرفعال کردن واحد
  ipcMain.handle(
    'units:set-active',
    (event, unitId, isActive) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return setUnitActive(
        database,
        actor,
        unitId,
        isActive
      );

    }
  );


  // حذف واحد سفارشی
  ipcMain.handle(
    'units:delete',
    (event, unitId) => {

      // دریافت هویت کاربر
      const actor = requireAuthenticatedSession(event);

      return deleteUnit(
        database,
        actor,
        unitId
      );

    }
  );

}


/* ==============================
   ایجاد پنجره اصلی
================================ */

function createWindow() {

  mainWindow = new BrowserWindow({

    width: 1200,
    height: 800,

    minWidth: 900,
    minHeight: 600,

    webPreferences: {

      // فایل ارتباطی امن
      preload: path.join(__dirname, 'preload.cjs'),

      // عدم دسترسی مستقیم Renderer به Node.js
      nodeIntegration: false,

      // جداسازی زمینه‌ها
      contextIsolation: true,

      // فعال‌سازی Sandbox
      sandbox: true,

      // حفظ امنیت وب
      webSecurity: true,

    },

  });


  // جلوگیری از بازشدن پنجره‌های جدید
  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: 'deny',
  }));


  // جلوگیری از هدایت برنامه به آدرس‌های غیرمجاز
  mainWindow.webContents.on(
    'will-navigate',
    (event, targetUrl) => {

      if (!isAllowedRendererUrl(targetUrl)) {
        event.preventDefault();
      }

    }
  );


  // بارگذاری رابط کاربری
  if (app.isPackaged) {

    mainWindow.loadFile(
      path.join(__dirname, '../dist/index.html')
    );

  } else {

    mainWindow.loadURL(DEV_SERVER_URL);

  }


  // آزادسازی مرجع پنجره پس از بسته‌شدن
  mainWindow.on('closed', () => {

    // با بسته‌شدن پنجره، کاربر از حساب خارج می‌شود
    activeSession = null;

    mainWindow = null;

  });

}


/* ==============================
   جلوگیری از اجرای چند نمونه برنامه
================================ */

const gotSingleInstanceLock = app.requestSingleInstanceLock();


if (!gotSingleInstanceLock) {

  app.quit();

} else {


  // اگر برنامه دوباره اجرا شد، پنجره قبلی فعال شود
  app.on('second-instance', () => {

    if (mainWindow) {

      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();

    }

  });


  /* ==============================
     آماده‌سازی برنامه
  ================================ */

  app.whenReady().then(() => {

    try {

      // ۱. اتصال به پایگاه داده
      database = initializeDatabase();

      // ۲. ثبت مسیرهای مجاز ارتباطی
      registerIpcHandlers();

      // ۳. ایجاد پنجره اصلی
      createWindow();

    } catch (error) {

      console.error(
        'Application initialization failed:',
        error
      );

      dialog.showErrorBox(
        'خطا در راه‌اندازی حساب‌یار',
        'پایگاه داده یا زیرساخت برنامه با خطا مواجه شده است.'
      );

      app.quit();

    }

  });


  /* ==============================
     مدیریت چرخه برنامه
  ================================ */

  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }

  });


  app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {
      app.quit();
    }

  });


}


/* ==============================
   بستن پایگاه داده
================================ */

app.on('before-quit', () => {

  if (database) {

    try {
      database.close();
    } catch (error) {
      console.error('Database close failed:', error);
    }

    database = null;

  }

});
