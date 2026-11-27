import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'


test('راه‌اندازی اولیه و ورود به برنامه با دیتابیس آزمایشی مستقل', async () => {
  test.setTimeout(90000)

  const testUserDataPath = await mkdtemp(path.join(tmpdir(), 'hesabyar-e2e-'))
  let electronApp

  try {
    electronApp = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        HESABYAR_TEST_MODE: '1',
        HESABYAR_TEST_USER_DATA: testUserDataPath,
      },
      timeout: 60000,
    })

    const page = await electronApp.firstWindow()

    // مرحله اول: برنامه باید دیتابیس خالی آزمایشی را تشخیص دهد.
    await expect(
      page.getByRole('heading', { name: 'ایجاد مدیر سیستم' })
    ).toBeVisible({ timeout: 30000 })

    // مرحله دوم: ایجاد مدیر اولیه از طریق UI و IPC واقعی.
    await page.locator('#setup-display-name').fill('مدیر آزمایشی')
    await page.locator('#setup-username').fill('qaadmin')
    await page.locator('#setup-password').fill('TestPassword123!')
    await page.locator('#setup-confirm-password').fill('TestPassword123!')
    await page.getByRole('button', { name: 'ایجاد مدیر سیستم' }).click()

    await expect(
      page.getByRole('heading', { name: 'مدیر سیستم ایجاد شد' })
    ).toBeVisible()

    // مرحله سوم: تأیید مشاهده و نگهداری کد بازیابی.
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'پایان راه‌اندازی' }).click()

    // مرحله چهارم: ورود با حسابی که در دیتابیس SQLite آزمایشی ساخته شد.
    await expect(page.getByRole('heading', { name: 'خوش آمدید' })).toBeVisible()
    await page.locator('#username').fill('qaadmin')
    await page.locator('#password').fill('TestPassword123!')
    await page.getByRole('button', { name: 'ورود به حساب‌یار' }).click()

    // وجود عنوان صفحه اصلی، اتصال React، Preload، IPC و سرویس احراز هویت را تأیید می‌کند.
    await expect(
      page.getByRole('heading', { name: 'داشبورد' }).first()
    ).toBeVisible({ timeout: 20000 })
  } finally {
    if (electronApp) {
      await electronApp.close()
    }

    // پاک‌سازی فقط پوشه داده‌ای که همین آزمون ساخته است.
    await rm(testUserDataPath, { recursive: true, force: true })
  }
})
