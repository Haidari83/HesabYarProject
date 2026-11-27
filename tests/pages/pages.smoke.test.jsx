// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BusinessDataProvider } from '../../src/context/BusinessDataProvider.jsx'
import ProductList from '../../src/pages/Products/ProductList.jsx'
import CategoryList from '../../src/pages/Categories/CategoryList.jsx'
import UnitList from '../../src/pages/Units/UnitList.jsx'
import InventoryStockList from '../../src/pages/Inventory/InventoryStockList.jsx'
import InventoryEntry from '../../src/pages/Inventory/InventoryEntry.jsx'
import InventoryDocuments from '../../src/pages/Inventory/InventoryDocuments.jsx'
import UserManagement from '../../src/pages/Users/UserManagement.jsx'

afterEach(() => {
  cleanup()
  delete window.hesabyar
})

const adminUser = {
  id: 'admin-test',
  username: 'qaadmin',
  displayName: 'مدیر آزمایشی',
  role: 'admin',
  permissions: [],
}

let bridge

function createBridge() {
  return {
    products: {
      list: vi.fn().mockResolvedValue([]),
      getFormOptions: vi.fn().mockResolvedValue({
        categories: [],
        units: [],
        currencies: [],
      }),
      setActive: vi.fn().mockResolvedValue({ success: true }),
    },
    categories: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      createBulk: vi.fn(),
      update: vi.fn(),
      setActive: vi.fn(),
      delete: vi.fn(),
    },
    units: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      createBulk: vi.fn(),
      update: vi.fn(),
      setActive: vi.fn(),
      delete: vi.fn(),
    },
    inventory: {
      getEntryFormOptions: vi.fn().mockResolvedValue({
        products: [],
        currencies: [],
        baseCurrencyCode: 'AFN',
      }),
      createEntryDraft: vi.fn().mockResolvedValue({ success: true }),
      listDocuments: vi.fn().mockResolvedValue({
        documents: [],
        totalCount: 0,
      }),
    },
    users: {
      list: vi.fn().mockResolvedValue([]),
      getPermissionCatalog: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      setActive: vi.fn(),
    },
  }
}

function renderWithBusinessData(element) {
  return render(
    <BusinessDataProvider>
      {element}
    </BusinessDataProvider>
  )
}

beforeEach(() => {
  bridge = createBridge()
  Object.defineProperty(window, 'hesabyar', {
    configurable: true,
    writable: true,
    value: bridge,
  })
})

describe('آزمون اولیه بارگذاری صفحات حساب‌یار', () => {
  it('صفحه محصولات را با دریافت فهرست و گزینه‌های فرم بارگذاری می‌کند', async () => {
    render(<ProductList currentUser={adminUser} />)

    await waitFor(() => {
      expect(bridge.products.list).toHaveBeenCalledTimes(1)
      expect(bridge.products.getFormOptions).toHaveBeenCalledTimes(1)
    })
  })

  it('صفحه دسته‌بندی‌ها را از API دریافت می‌کند', async () => {
    renderWithBusinessData(<CategoryList currentUser={adminUser} />)

    await waitFor(() => {
      expect(bridge.categories.list).toHaveBeenCalledTimes(1)
    })
  })

  it('ثبت تکی دسته‌بندی را از فرم تا فراخوانی API آزمایش می‌کند', async () => {
    const user = userEvent.setup()
    const createdCategory = {
      id: 'category-test-1',
      name: 'نوشیدنی‌ها',
      description: 'دسته آزمایشی',
      isActive: true,
      productCount: 0,
      createdAt: '2026-11-27T00:00:00.000Z',
    }

    bridge.categories.create.mockResolvedValue(createdCategory)

    renderWithBusinessData(<CategoryList currentUser={adminUser} />)

    await user.click(await screen.findByRole('button', { name: /افزودن تکی/ }))

    screen.getByRole('textbox', {
      name: /نام دسته‌بندی/,
    })
    await user.type(screen.getByLabelText('توضیحات'), 'دسته آزمایشی')
    await user.click(screen.getByRole('button', { name: 'ثبت دسته‌بندی' }))

    await waitFor(() => {
      expect(bridge.categories.create).toHaveBeenCalledWith({
        name: 'نوشیدنی‌ها',
        description: 'دسته آزمایشی',
      })
    })

    expect(await screen.findByText('دسته‌بندی «نوشیدنی‌ها» با موفقیت ثبت شد.')).toBeInTheDocument()
  })

  it('صفحه واحدهای اندازه‌گیری را از API دریافت می‌کند', async () => {
    render(<UnitList currentUser={adminUser} />)

    await waitFor(() => {
      expect(bridge.units.list).toHaveBeenCalledTimes(1)
    })
  })

  it('صفحه موجودی از داده مشترک Provider استفاده می‌کند', async () => {
    renderWithBusinessData(<InventoryStockList />)

    expect(
      (await screen.findAllByText('برنج پاکستانی')).length
    ).toBeGreaterThan(0);
  })

  it('فرم ورود کالا گزینه‌های اولیه را از Electron دریافت می‌کند', async () => {
    render(<InventoryEntry />)

    await waitFor(() => {
      expect(bridge.inventory.getEntryFormOptions).toHaveBeenCalledWith('purchase')
    })
  })

  it('فهرست اسناد انبار را با فیلترهای اولیه درخواست می‌کند', async () => {
    render(<InventoryDocuments />)

    await waitFor(() => {
      expect(bridge.inventory.listDocuments).toHaveBeenCalledTimes(1)
    })
  })

  it('فهرست کاربران را از Electron دریافت می‌کند', async () => {
    render(<UserManagement />)

    await waitFor(() => {
      expect(bridge.users.list).toHaveBeenCalledTimes(1)
    })
  })
})
