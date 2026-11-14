
/* ==============================
   ماژول‌های موردنیاز
================================ */

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
} = require('electron');

const {
  createInitialAdmin,
  authenticateUser,
  getSessionUser,
  recordLogout,
} = require('./services/authService.cjs');

const {
  createUser,
  getUsers,
  getPermissionCatalog,
} = require('./services/userService.cjs');

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


// بررسی هویت و نقش مدیر سیستم برای عملیات مدیریتی
function requireAdminSession(event) {

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

  // دریافت اطلاعات کاربر از پایگاه داده
  const actor = getSessionUser(
    database,
    activeSession.userId
  );

  if (!actor) {

    activeSession = null;

    throw new Error(
      'نشست کاربر معتبر نیست. دوباره وارد حساب‌یار شو.'
    );

  }

  // فقط مدیر سیستم اجازه مدیریت کاربران را دارد
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
    (event, credentials) => {

      // بررسی معتبر بودن درخواست
      if (!isTrustedRenderer(event)) {
        throw new Error(
          'درخواست از منبع غیرمجاز ارسال شده است.'
        );
      }

      // بررسی نام کاربری و گذرواژه در پایگاه داده
      const result = authenticateUser(
        database,
        credentials
      );

      // فقط در صورت ورود موفق، نشست ایجاد می‌شود
      if (result.success) {

        activeSession = {
          userId: result.user.id,
        };

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

      return currentUser;

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
