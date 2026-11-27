// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import FormField from '../../src/components/ui/FormField.jsx'
import KeyboardSelect from '../../src/components/ui/KeyboardSelect.jsx'

afterEach(() => cleanup())

const options = [
  { value: 'purchase', label: 'خرید' },
  { value: 'return', label: 'برگشتی' },
]

function SelectHarness() {
  const [value, setValue] = useState('purchase')

  return (
    <FormField
      label="نوع سند"
      required
      hint="نوع سند را انتخاب کن."
    >
      <KeyboardSelect
        options={options}
        value={value}
        onChange={setValue}
      />
    </FormField>
  )
}

describe('KeyboardSelect و اتصال آن به FormField', () => {
  it('برچسب و راهنمای فیلد را به دکمه انتخاب‌گر متصل می‌کند', () => {
    render(<SelectHarness />)

    const trigger = screen.getByRole('button', { name: 'نوع سند' })

    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAttribute('aria-describedby')
    expect(trigger.getAttribute('aria-describedby')).toContain('hint')
  })

  it('با صفحه‌کلید و Space گزینه فعال را انتخاب می‌کند', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    const trigger = screen.getByRole('button', { name: 'نوع سند' })

    await user.click(trigger)
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')

    expect(trigger).toHaveTextContent('برگشتی')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('با کلیک روی گزینه مقدار انتخاب‌شده را تغییر می‌دهد', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    await user.click(screen.getByRole('button', { name: 'نوع سند' }))
    await user.click(screen.getByRole('option', { name: 'برگشتی' }))

    expect(screen.getByRole('button', { name: 'نوع سند' })).toHaveTextContent('برگشتی')
  })
})
