import { render, screen, fireEvent } from '@testing-library/react'
import QuantityControls from './QuantityControls.jsx'

const exactItem = { id: 1, name: 'Milk', quantity_mode: 'exact', quantity: 3, status: null }
const nullQtyItem = { id: 3, name: 'Water', quantity_mode: 'exact', quantity: null, status: null }
const statusItem = { id: 2, name: 'Soap', quantity_mode: 'status', quantity: null, status: 'low' }
const nullStatusItem = { id: 4, name: 'Bread', quantity_mode: 'status', quantity: null, status: null }

test('exact mode + button calls onIncrement', () => {
  const onIncrement = vi.fn()
  render(<QuantityControls item={exactItem} onIncrement={onIncrement} onDecrement={() => {}} />)
  fireEvent.click(screen.getByLabelText('Increase quantity for Milk'))
  expect(onIncrement).toHaveBeenCalledOnce()
})

test('exact mode − button calls onDecrement', () => {
  const onDecrement = vi.fn()
  render(<QuantityControls item={exactItem} onIncrement={() => {}} onDecrement={onDecrement} />)
  fireEvent.click(screen.getByLabelText('Decrease quantity for Milk'))
  expect(onDecrement).toHaveBeenCalledOnce()
})

test('exact mode count shows quantity value and 0 for null', () => {
  const { rerender } = render(
    <QuantityControls item={exactItem} onIncrement={() => {}} onDecrement={() => {}} />
  )
  expect(screen.getByText('3')).toBeInTheDocument()

  rerender(<QuantityControls item={nullQtyItem} onIncrement={() => {}} onDecrement={() => {}} />)
  expect(screen.getByText('0')).toBeInTheDocument()
})

test('status mode renders a single pill button with label matching status title case', () => {
  render(<QuantityControls item={statusItem} onCycle={() => {}} />)
  const pill = screen.getByRole('button', { name: /Stock status for Soap: Low/i })
  expect(pill).toBeInTheDocument()
  expect(screen.getByText('Low')).toBeInTheDocument()
})

test('status mode clicking the pill calls onCycle (not onIncrement)', () => {
  const onCycle = vi.fn()
  const onIncrement = vi.fn()
  render(<QuantityControls item={statusItem} onCycle={onCycle} onIncrement={onIncrement} />)
  fireEvent.click(screen.getByRole('button', { name: /Stock status for Soap/i }))
  expect(onCycle).toHaveBeenCalledOnce()
  expect(onIncrement).not.toHaveBeenCalled()
})

test('status mode null status renders "Have"', () => {
  render(<QuantityControls item={nullStatusItem} onCycle={() => {}} />)
  expect(screen.getByText('Have')).toBeInTheDocument()
})

test('errored=true adds the errored class to the container', () => {
  const { container } = render(
    <QuantityControls item={exactItem} onIncrement={() => {}} onDecrement={() => {}} errored={true} />
  )
  // The container div should have the 'errored' class (CSS module generates a class containing 'errored')
  const div = container.firstChild
  expect(div.className).toMatch(/errored/)
})

test('aria-label uses item name for exact mode buttons', () => {
  render(<QuantityControls item={exactItem} onIncrement={() => {}} onDecrement={() => {}} />)
  expect(screen.getByLabelText('Increase quantity for Milk')).toBeInTheDocument()
  expect(screen.getByLabelText('Decrease quantity for Milk')).toBeInTheDocument()
})
