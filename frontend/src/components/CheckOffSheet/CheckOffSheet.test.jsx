import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckOffSheet from './CheckOffSheet.jsx'

const entry = {
  id: 1, item_id: 1, item_name: 'Milk',
  quantity_mode: 'exact', quantity: 0, status: null,
  reorder_threshold: 3, added_manually: false, sort_order: 1,
  auto: false, location_id: null,
}

describe('CheckOffSheet', () => {
  it('renders item name in heading', () => {
    render(<CheckOffSheet entry={entry} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument()
  })

  it('stepper defaults to 1 and minus disabled at 1', () => {
    render(<CheckOffSheet entry={entry} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled()
  })

  it('Add to stock invokes onConfirm with current quantity', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<CheckOffSheet entry={entry} onConfirm={onConfirm} onDismiss={() => {}} />)
    await user.click(screen.getByLabelText('Increase quantity'))
    await user.click(screen.getByLabelText('Increase quantity'))
    await user.click(screen.getByRole('button', { name: 'Add to stock' }))
    expect(onConfirm).toHaveBeenCalledWith(3)
  })

  it('Keep on list invokes onDismiss', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<CheckOffSheet entry={entry} onConfirm={() => {}} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Keep on list' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('Escape key invokes onDismiss', () => {
    const onDismiss = vi.fn()
    render(<CheckOffSheet entry={entry} onConfirm={() => {}} onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })
})
