import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ItemDrawer from './ItemDrawer.jsx'

const defaultCategories = [
  { id: 1, name: 'Food', is_default: true },
  { id: 2, name: 'Cleaning', is_default: false },
]
const defaultLocations = [
  { id: 10, name: 'Kitchen' },
  { id: 20, name: 'Bathroom' },
]

const defaultItem = {
  id: 42,
  name: 'Milk',
  category_id: 1,
  location_id: 10,
  quantity_mode: 'exact',
  quantity: 3,
  status: null,
  reorder_threshold: 1,
  notes: 'In the fridge',
  archived: false,
  updated_at: '2026-04-16T10:00:00Z',
  last_updated_by_name: 'Alice',
}

function renderDrawer(props = {}) {
  const defaults = {
    mode: 'add',
    item: null,
    categories: defaultCategories,
    locations: defaultLocations,
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue({ id: 99, name: 'New Item' }),
    onUpdate: vi.fn().mockResolvedValue(defaultItem),
    onDelete: vi.fn().mockResolvedValue(undefined),
  }
  const merged = { ...defaults, ...props }
  return render(
    <MemoryRouter>
      <ItemDrawer {...merged} />
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('Test 1: Add mode renders with empty name field', async () => {
  renderDrawer({ mode: 'add' })
  const nameInput = screen.getByLabelText('Name')
  expect(nameInput).toBeInTheDocument()
  expect(nameInput.value).toBe('')
  expect(screen.getByText('Add Item')).toBeInTheDocument()
})

it('Test 2: Add mode — typing a name + selecting a category + clicking Save Item calls onCreate', async () => {
  const onCreate = vi.fn().mockResolvedValue({ id: 99, name: 'Eggs' })
  renderDrawer({ mode: 'add', onCreate })

  const nameInput = screen.getByLabelText('Name')
  fireEvent.change(nameInput, { target: { value: 'Eggs' } })

  const categorySelect = screen.getByLabelText('Category')
  fireEvent.change(categorySelect, { target: { value: '1' } })

  fireEvent.click(screen.getByText('Save Item'))

  await waitFor(() => {
    expect(onCreate).toHaveBeenCalledOnce()
    const callArg = onCreate.mock.calls[0][0]
    expect(callArg.name).toBe('Eggs')
    expect(callArg.category_id).toBe(1)
    expect(callArg.quantity_mode).toBe('exact')
  })
})

it('Test 3: Add mode — clicking Save with empty name shows "Name is required" and does NOT call onCreate', async () => {
  const onCreate = vi.fn()
  renderDrawer({ mode: 'add', onCreate })

  fireEvent.click(screen.getByText('Save Item'))

  expect(screen.getByText('Name is required')).toBeInTheDocument()
  expect(onCreate).not.toHaveBeenCalled()
})

it('Test 4: Edit mode — form pre-fills with item values', async () => {
  renderDrawer({ mode: 'edit', item: defaultItem })

  const nameInput = screen.getByLabelText('Name')
  expect(nameInput.value).toBe('Milk')

  const categorySelect = screen.getByLabelText('Category')
  expect(categorySelect.value).toBe('1')

  expect(screen.getByText('Edit Item')).toBeInTheDocument()
})

it('Test 5: Edit mode — changing only notes calls onUpdate with patch containing ONLY notes', async () => {
  const onUpdate = vi.fn().mockResolvedValue(defaultItem)
  renderDrawer({ mode: 'edit', item: defaultItem, onUpdate })

  const notesTextarea = screen.getByLabelText('Notes')
  fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } })

  fireEvent.click(screen.getByText('Save Item'))

  await waitFor(() => {
    expect(onUpdate).toHaveBeenCalledOnce()
    const [id, patch] = onUpdate.mock.calls[0]
    expect(id).toBe(42)
    expect(patch).toEqual({ notes: 'Updated notes' })
  })
})

it('Test 6: Edit mode — clicking Delete transitions to confirmation; clicking Yes, delete calls onDelete', async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  renderDrawer({ mode: 'edit', item: defaultItem, onDelete, onClose })

  fireEvent.click(screen.getByText('Delete'))

  expect(screen.getByText(/Delete Milk\?/)).toBeInTheDocument()
  expect(screen.getByText('Yes, delete')).toBeInTheDocument()

  fireEvent.click(screen.getByText('Yes, delete'))

  await waitFor(() => {
    expect(onDelete).toHaveBeenCalledWith(42)
    expect(onClose).toHaveBeenCalled()
  })
})

it('Test 7: Edit mode — clicking Delete then Cancel returns footer to Save+Delete without calling onDelete', async () => {
  const onDelete = vi.fn()
  renderDrawer({ mode: 'edit', item: defaultItem, onDelete })

  fireEvent.click(screen.getByText('Delete'))
  expect(screen.getByText(/Delete Milk\?/)).toBeInTheDocument()

  fireEvent.click(screen.getByText('Cancel'))

  expect(screen.getByText('Save Item')).toBeInTheDocument()
  expect(screen.getByText('Delete')).toBeInTheDocument()
  expect(onDelete).not.toHaveBeenCalled()
})

it('Test 8: Close — pressing Escape while dirty calls confirm and then onClose', async () => {
  const onClose = vi.fn()
  vi.spyOn(window, 'confirm').mockReturnValue(true)

  renderDrawer({ mode: 'add', onClose })

  const nameInput = screen.getByLabelText('Name')
  fireEvent.change(nameInput, { target: { value: 'dirty value' } })

  // Simulate Escape on the drawer
  const dialog = screen.getByRole('dialog')
  fireEvent.keyDown(dialog, { key: 'Escape' })

  expect(window.confirm).toHaveBeenCalledWith('Discard changes?')
  expect(onClose).toHaveBeenCalled()
})

it('Test 9: Save failure — mock onCreate rejects; shows error and drawer stays open', async () => {
  const onCreate = vi.fn().mockRejectedValue(new Error('Network error'))
  const onClose = vi.fn()
  renderDrawer({ mode: 'add', onCreate, onClose })

  const nameInput = screen.getByLabelText('Name')
  fireEvent.change(nameInput, { target: { value: 'Test Item' } })

  fireEvent.click(screen.getByText('Save Item'))

  await waitFor(() => {
    expect(screen.getByText('Could not save. Check your connection and try again.')).toBeInTheDocument()
  })
  expect(onClose).not.toHaveBeenCalled()
})

it('Test 10: Mode switch — switching quantityMode from exact to status hides reorder_threshold input', async () => {
  renderDrawer({ mode: 'add' })

  // Initially in exact mode — reorder threshold should be visible
  expect(screen.getByLabelText('Reorder threshold')).toBeInTheDocument()

  // Switch to status mode
  fireEvent.click(screen.getByText('Status'))

  // Reorder threshold should be gone
  expect(screen.queryByLabelText('Reorder threshold')).not.toBeInTheDocument()
})

// Integer quantity input tests (T1-T6)
describe('Integer quantity inputs', () => {
  const intItem = { ...defaultItem, quantity: 2, reorder_threshold: 1 }

  it('T1: Edit mode with quantity=2 shows "2" (no decimal) in the quantity input', () => {
    renderDrawer({ mode: 'edit', item: intItem })
    const input = screen.getByLabelText('Quantity')
    expect(input.value).toBe('2')
  })

  it('T2: Quantity input has step="1"', () => {
    renderDrawer({ mode: 'edit', item: intItem })
    const input = screen.getByLabelText('Quantity')
    expect(input.getAttribute('step')).toBe('1')
  })

  it('T3: Reorder threshold input has step="1"', () => {
    renderDrawer({ mode: 'edit', item: intItem })
    const input = screen.getByLabelText('Reorder threshold')
    expect(input.getAttribute('step')).toBe('1')
  })

  it('T4: Typing "3" into quantity input updates form state to integer 3', async () => {
    const onUpdate = vi.fn().mockResolvedValue(intItem)
    renderDrawer({ mode: 'edit', item: intItem, onUpdate })

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByText('Save Item'))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce()
      const [, patch] = onUpdate.mock.calls[0]
      expect(patch.quantity).toBe(3)
    })
  })

  it('T5: Saving quantity change calls onUpdate with integer typeof quantity', async () => {
    const onUpdate = vi.fn().mockResolvedValue(intItem)
    renderDrawer({ mode: 'edit', item: intItem, onUpdate })

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.click(screen.getByText('Save Item'))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce()
      const [, patch] = onUpdate.mock.calls[0]
      expect(typeof patch.quantity).toBe('number')
      expect(Number.isInteger(patch.quantity)).toBe(true)
      expect(patch.quantity).toBe(5)
    })
  })

  it('T6: Clearing the quantity input sets form quantity to null', async () => {
    const onUpdate = vi.fn().mockResolvedValue(intItem)
    renderDrawer({ mode: 'edit', item: intItem, onUpdate })

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByText('Save Item'))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce()
      const [, patch] = onUpdate.mock.calls[0]
      expect(patch.quantity).toBeNull()
    })
  })
})
