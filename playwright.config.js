import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',

  timeout: 90000,
  expect: {
    timeout: 15000,
  },

  // Electron و Vite هم‌زمان روی سیستم اجرا می‌شوند؛ یک worker کافی است.
  workers: 1,
  fullyParallel: false,
  reporter: 'list',

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // اگر Vite از قبل روی پورت تعریف‌شده اجرا نشده باشد، Playwright آن را بالا می‌آورد.
  webServer: {
    command: 'npm run dev -- --host localhost',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
