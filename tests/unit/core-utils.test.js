import { describe, expect, it } from 'vitest'

import { joinClasses } from '../../src/utils/joinClasses.js'
import { createRows } from '../../src/utils/listHelpers.js'
import { formatNumber } from '../../src/utils/numberFormat.js'
import {
  normalizePersianText,
  toEnglishDigits,
  toPersianDigits,
} from '../../src/utils/persianText.js'

describe('توابع عمومی حساب‌یار', () => {
  it('کلاس‌های خالی را حذف و کلاس‌های معتبر را ترکیب می‌کند', () => {
    expect(joinClasses('ui-field', false, '', 'is-active', null)).toBe('ui-field is-active')
  })

  it('تعداد معتبر ردیف مستقل می‌سازد', () => {
    const rows = createRows(2.8, () => ({ value: 0 }))

    expect(rows).toHaveLength(2)
    expect(rows[0]).not.toBe(rows[1])
  })

  it('برای تعداد نامعتبر آرایه خالی می‌دهد', () => {
    expect(createRows(-2, () => ({}))).toEqual([])
    expect(createRows(Number.NaN, () => ({}))).toEqual([])
  })

  it('در صورت نداشتن تابع سازنده خطای نوع می‌دهد', () => {
    expect(() => createRows(2, null)).toThrow(TypeError)
  })

  it('حروف عربی و فارسی و فاصله نیم‌فاصله را یکسان می‌کند', () => {
    expect(normalizePersianText('كِتاب‌خانه')).toBe('کتاب خانه')
  })

  it('ارقام فارسی و عربی را به انگلیسی تبدیل می‌کند', () => {
    expect(toEnglishDigits('۱۲٣۴')).toBe('1234')
  })

  it('ارقام ورودی را به ارقام فارسی تبدیل می‌کند', () => {
    expect(toPersianDigits('120 + 34')).toBe('۱۲۰ + ۳۴')
  })

  it('عدد را با locale و تنظیمات خواسته‌شده قالب‌بندی می‌کند', () => {
    expect(formatNumber(1234.5, { locale: 'en-US' })).toBe('1,234.5')
  })

  it('برای مقدار خالی و نامعتبر مقدار جایگزین نشان می‌دهد', () => {
    expect(formatNumber('', { emptyValue: 'خالی' })).toBe('خالی')
    expect(formatNumber('abc', { invalidValue: 'نامعتبر' })).toBe('نامعتبر')
  })
})
