
/* ==============================
   وارد کردن ماژول‌های موردنیاز
================================ */

// امکانات اصلی Electron
const { app, BrowserWindow } = require('electron');

// ابزار مدیریت مسیر فایل‌ها
const path = require('path');


/* ==============================
   ایجاد پنجره اصلی برنامه
================================ */

function createWindow() {

  const mainWindow = new BrowserWindow({

    // اندازه اولیه پنجره
    width: 1200,
    height: 800,

    // حداقل اندازه مجاز پنجره
    minWidth: 900,
    minHeight: 600,

    // تنظیمات امنیتی
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }

  });


  /* ==============================
     بارگذاری رابط کاربری
  ================================ */

  if (app.isPackaged) {

    // در نسخه نهایی، فایل ساخته‌شده توسط Vite را باز می‌کنیم
    mainWindow.loadFile(
      path.join(__dirname, '../dist/index.html')
    );

  } else {

    // در زمان توسعه، رابط کاربری را از سرور Vite دریافت می‌کنیم
    mainWindow.loadURL('http://localhost:5173');

  }

}


/* ==============================
   مدیریت چرخه اجرای برنامه
================================ */

// اجرای برنامه پس از آماده شدن Electron
app.whenReady().then(() => {

  // ایجاد پنجره اصلی
  createWindow();

  // مخصوص macOS: بازسازی پنجره با کلیک روی آیکون برنامه
  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }

  });

});


// بستن برنامه پس از بسته شدن تمام پنجره‌ها
app.on('window-all-closed', () => {

  // در ویندوز و لینوکس برنامه بسته می‌شود
  // در macOS برنامه باز می‌ماند
  if (process.platform !== 'darwin') {
    app.quit();
  }

});
