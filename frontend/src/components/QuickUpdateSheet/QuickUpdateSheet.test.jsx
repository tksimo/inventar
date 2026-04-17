import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import QuickUpdateSheet from './QuickUpdateSheet.jsx'

const testItem = { id: 1, name: 'Bananas', quantity_mode: 'exact', quantity: 3, status: null }

function renderSheet(overrides = {}) {
  return render(
    <QuickUpdateSheet
      item={testItem}
      locationName={null}
      onIncrement={() => {}}
      onDecrement={() => {}}
      onDone={() => {}}
      onEditItem={() => {}}
      onClose={() => {}}
      {...overrides}
    />,
  )
}

describe('QuickUpdateSheet', () => {
  it('renders a dialog labelled by the item name', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
    const labelledby = dialog.getAttribute('aria-labelledby')
    const labelEl = document.getElementById(labelledby)
    expect(labelEl).toHaveTextContent('Bananas')
  })

  it('renders the item name as heading text', () => {
    renderSheet()
    expect(screen.getByText('Bananas')).toBeInTheDocument()
  })

  it('renders locationName when provided', () => {
    renderSheet({ locationName: 'kitchen top shelf' })
    expect(screen.getByText('kitchen top shelf')).toBeInTheDocument()
  })

  it('renders embedded QuantityControls with working +/- buttons', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Increase quantity for Bananas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease quantity for Bananas' })).toBeInTheDocument()
  })

  it('calls onDone when Done is clicked', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    renderSheet({ onDone })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onEditItem when Edit item is clicked', async () => {
    const user = userEvent.setup()
    const onEditItem = vi.fn()
    renderSheet({ onEditItem })
    await user.click(screen.getByRole('button', { name: 'Edit item' }))
    expect(onEditItem).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSheet({ onClose })
    await user.click(screen.getByTestId('quick-sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSheet({ onClose })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
