import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import databaseModule from '../../electron/database.cjs'
import authService from '../../electron/services/authService.cjs'
import categoryService from '../../electron/services/categoryService.cjs'

const { openDatabase, SCHEMA_VERSION } = databaseModule
const { createInitialAdmin, authenticateUser } = authService
const { createCategory, createCategories, getCategories } = categoryService

const adminInput = {
  displayName: 'مدیر آزمایشی',
  username: 'qaadmin',
  password: 'TestPassword123!',
  confirmPassword: 'TestPassword123!',
}

let temporaryDirectory
let database

beforeEach(() => {
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'hesabyar-test-'))
  database = openDatabase(path.join(temporaryDirectory, 'hesabyar-test.sqlite'))
})

afterEach(() => {
  if (database) {
    database.close()
    database = null
  }

  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = null
  }
})

describe('پایگاه داده و سرویس‌های اصلی', () => {
  it('پایگاه داده خالی را تا آخرین نسخه schema مهاجرت می‌دهد', () => {
    const version = Number(database.prepare('PRAGMA user_version').get().user_version)
    const usersTable = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).get()

    expect(version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(7)
    expect(usersTable?.name).toBe('users')
  })

  it('مدیر اولیه را ایجاد می‌کند و ورود با گذرواژه را می‌پذیرد', async () => {
    const setup = createInitialAdmin(database, adminInput)

    expect(setup.success).toBe(true)
    expect(setup.user.username).toBe('qaadmin')
    expect(setup.user.role).toBe('admin')
    expect(setup.recoveryCode).toMatch(/[A-F0-9]{4}-/)

    const login = await authenticateUser(
      database,
      {
        username: 'QAADMIN',
        method: 'password',
        password: adminInput.password,
      },
      null
    )

    expect(login.success).toBe(true)
    expect(login.user.username).toBe('qaadmin')

    await expect(
      authenticateUser(
        database,
        {
          username: 'qaadmin',
          method: 'password',
          password: 'wrong-password',
        },
        null
      )
    ).resolves.toMatchObject({ success: false })

    expect(() => createInitialAdmin(database, adminInput)).toThrow('مدیر اولیه قبلاً ایجاد شده است.')
  })

  it('ایجاد گروهی دسته‌بندی را در صورت شکست یک ردیف به صورت کامل بازمی‌گرداند', () => {
    const setup = createInitialAdmin(database, adminInput)
    const admin = setup.user

    const existingCategory = createCategory(database, admin, {
      name: 'مواد غذایی',
      description: 'دسته موجود در آزمون',
    })

    expect(existingCategory.name).toBe('مواد غذایی')

    expect(() => createCategories(database, admin, [
      {
        name: 'دسته جدید',
        description: 'این ردیف باید rollback شود',
      },
      {
        name: 'مواد غذایی',
        description: 'نام تکراری',
      },
    ])).toThrow('قبلاً ثبت شده است.')

    const categories = getCategories(database, admin)

    expect(categories).toHaveLength(1)
    expect(categories[0].name).toBe('مواد غذایی')
  })

  it('برای کاربر فاقد مجوز، دریافت دسته‌بندی را رد می‌کند', () => {
    const restrictedUser = {
      id: 'restricted-user',
      username: 'restricted',
      displayName: 'کاربر محدود',
      role: 'user',
    }

    expect(() => getCategories(database, restrictedUser)).toThrow(
      'برای انجام این عملیات مجوز لازم را نداری.'
    )
  })
})
