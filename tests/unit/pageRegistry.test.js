import { describe, expect, it } from 'vitest'

import {
  navigationItems,
  canAccessPage,
  filterNavigationItems,
} from '../../src/routes/pageRegistry.js'

const ordinaryUser = {
  id: 'user-test',
  role: 'user',
  permissions: ['products.view'],
}

const adminUser = {
  id: 'admin-test',
  role: 'admin',
  permissions: [],
}

describe('کنترل دسترسی صفحات', () => {
  it('صفحه‌ای را که کاربر مجوز آن را دارد در دسترس قرار می‌دهد', () => {
    expect(canAccessPage(ordinaryUser, 'product-list')).toBe(true)
  })

  it('صفحه بدون مجوز را برای کاربر عادی رد می‌کند', () => {
    expect(canAccessPage(ordinaryUser, 'categories')).toBe(false)
  })

  it('صفحه ناشناخته یا کاربر تهی را رد می‌کند', () => {
    expect(canAccessPage(ordinaryUser, 'not-a-page')).toBe(false)
    expect(canAccessPage(null, 'dashboard')).toBe(false)
  })

  it('مدیر سیستم را به صفحات مدیریتی دسترسی می‌دهد', () => {
    expect(canAccessPage(adminUser, 'users')).toBe(true)
    expect(canAccessPage(adminUser, 'dashboard')).toBe(true)
  })

  it('منو را به صفحات دارای مجوز محدود می‌کند', () => {
    const filtered = filterNavigationItems(navigationItems, ordinaryUser)
    const productsGroup = filtered.find((item) => item.id === 'products')

    expect(productsGroup).toBeDefined()
    expect(productsGroup.children.map((item) => item.id)).toEqual(['product-list'])
    expect(filtered.some((item) => item.id === 'sales')).toBe(false)
  })
})
