import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RestockQuickSheet from './RestockQuickSheet.jsx'

function makeItem(overrides = {}) {
  return { id: 1, name: 'Milk', ...overrides }
}

describe('RestockQuickSheet', () => {
  it('Test 1: renders item name as heading and dialog is labelled by it', () => {
    render(<RestockQuickSheet item={makeItem()} onAddToStock={() => {}} onClose={() => {}} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Milk' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id)
  })

  it('Test 2: stepper starts at 1, minus disabled at 1, plus increments', async () => {
    const user = userEvent.setup()
    render(<RestockQuickSheet item={makeItem()} onAddToStock={() => {}} onClose={() => {}} />)
    expect(screen.getByText('1')).toBeTruthy()
    const minus = screen.getByRole('button', { name: 'Decrease quantity' })
    expect(minus.hasAttribute('disabled')).toBe(true)

    const plus = screen.getByRole('button', { name: 'Increase quantity' })
    await user.click(plus)
    expect(screen.getByText('2')).toBeTruthy()
    await user.click(plus)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('Test 3: Add to stock fires onAddToStock with current value', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<RestockQuickSheet item={makeItem()} onAddToStock={onAdd} onClose={() => {}} />)

    // default value = 1
    await user.click(screen.getByRole('button', { name: 'Add to stock' }))
    expect(onAdd).toHaveBeenLastCalledWith(1)

    // increment twice then click
    const plus = screen.getByRole('button', { name: 'Increase quantity' })
    await user.click(plus)
    await user.click(plus)
    await user.click(screen.getByRole('button', { name: 'Add to stock' }))
    expect(onAdd).toHaveBeenLastCalledWith(3)
  })

  it('Test 4: Escape and backdrop call onClose; no "Keep on list" text present', async () => {
    const onClose = vi.fn()
    render(<RestockQuickSheet item={makeItem()} onAddToStock={() => {}} onClose={onClose} />)

    // Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalled()

    // Backdrop click
    onClose.mockClear()
    const backdrop = screen.getByTestId('restock-sheet-backdrop')
    backdrop.click()
    expect(onClose).toHaveBeenCalled()

    // No "Keep on list" — that belongs to CheckOffSheet (Plan 03)
    expect(screen.queryByText('Keep on list')).toBeNull()
  })

  it('Test 5: saving state disables stepper + button and shows "Saving…"', () => {
    render(<RestockQuickSheet item={makeItem()} onAddToStock={() => {}} onClose={() => {}} saving />)
    const addBtn = screen.getByRole('button', { name: 'Saving…' })
    expect(addBtn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Increase quantity' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).hasAttribute('disabled')).toBe(true)
  })
})
