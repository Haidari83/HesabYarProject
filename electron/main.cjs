
/* ==============================
   ماژول‌های موردنیاز
================================ */

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
} = require('electron');

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
