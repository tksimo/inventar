import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock CameraOverlay — exposes ariaLabel, onDetected, onClose, children
// Must be at the top level (vitest hoists vi.mock calls)
vi.mock('../components/CameraOverlay/CameraOverlay.jsx', () => ({
  default: function MockCameraOverlay({ ariaLabel, onDetected, onClose, children }) {
    return (
      <div role="dialog" aria-modal="true" aria-label={ariaLabel ?? 'Barcode scanner'}>
        <p>[camera placeholder]</p>
        <button
          type="button"
          onClick={() => onDetected('__test_barcode__')}
          aria-label="__simulate_detected__"
        >
          Simulate detected
        </button>
        {children}
        <button type="button" onClick={onClose} aria-label="Close camera">Close</button>
      </div>
    )
  },
}))

// Mock the hook so we control entries
const mockHook = {
  entries: [],
  loading: false,
  error: null,
  refetch: vi.fn(),
  addManual: vi.fn(() => Promise.resolve({ ok: true })),
  removeEntry: vi.fn(() => Promise.resolve({ ok: true })),
  reorder: vi.fn(() => Promise.resolve({ ok: true })),
  checkOff: vi.fn(() => Promise.resolve({ ok: true })),
}
vi.mock('../hooks/useShoppingList.js', () => ({
  useShoppingList: () => mockHook,
}))

// Mock share library
vi.mock('../lib/share.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    shareText: vi.fn(() => Promise.resolve({ method: 'share' })),
  }
})
import { shareText, formatShoppingList } from '../lib/share.js'
import ShoppingList from './ShoppingList.jsx'

const sampleEntry = {
  id: 1, item_id: 1, item_name: 'Milk',
  quantity_mode: 'exact', quantity: 0, status: null,
  reorder_threshold: 3, added_manually: false, sort_order: 1,
  auto: false, location_id: null,
}

function makeItemsApiMock({ items = [], updateQuantity = vi.fn(() => Promise.resolve()) } = {}) {
  return {
    items,
    loading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    updateQuantity,
    cycleStatus: vi.fn(),
    refetch: vi.fn(),
  }
}

function mockUseShoppingList({ entries = [], checkOff = vi.fn(() => Promise.resolve({ removed: true })) } = {}) {
  mockHook.entries = entries
  mockHook.checkOff = checkOff
}

function renderPage({ entries = [], itemsApi = makeItemsApiMock() } = {}) {
  mockHook.entries = entries
  return render(
    <BrowserRouter>
      <ShoppingList itemsApi={itemsApi} />
    </BrowserRouter>
  )
}

describe('ShoppingList page', () => {
  beforeEach(() => {
    mockHook.entries = []
    mockHook.loading = false
    mockHook.error = null
    mockHook.checkOff = vi.fn(() => Promise.resolve({ ok: true }))
    shareText.mockClear()
  })

  it('renders page title "Shopping List"', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Shopping List' })).toBeInTheDocument()
  })

  it('renders EmptyState when entries is []', () => {
    renderPage({ entries: [] })
    expect(screen.getByText('Nothing to buy')).toBeInTheDocument()
    expect(screen.getByText(/All stocked up/)).toBeInTheDocument()
  })

  it('renders rows when entries contains items', () => {
    renderPage({ entries: [sampleEntry] })
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('0 left')).toBeInTheDocument()
  })

  it('share button click calls shareText with formatted list', async () => {
    const user = userEvent.setup()
    renderPage({ entries: [sampleEntry] })
    await user.click(screen.getByLabelText('Share shopping list'))
    await waitFor(() => expect(shareText).toHaveBeenCalled())
    const call = shareText.mock.calls[0][0]
    expect(call.title).toBe('Einkaufsliste')
    expect(call.text).toBe(formatShoppingList([sampleEntry]))
  })

  it('FAB exists with aria-label "Add item to shopping list"', () => {
    renderPage()
    expect(screen.getByLabelText('Add item to shopping list')).toBeInTheDocument()
  })

  // ---- Phase 4 Plan 04 restock-mode tests ----

  it('Test 6: Tapping Start restocking opens CameraOverlay with aria-label=Restock scanner and a Done restocking button', async () => {
    const user = userEvent.setup()
    const itemsApi = makeItemsApiMock({
      items: [{ id: 42, name: 'Milk', barcode: '__test_barcode__', quantity_mode: 'exact', quantity: 0 }],
    })
    mockUseShoppingList({ entries: [] })

    render(
      <BrowserRouter>
        <ShoppingList itemsApi={itemsApi} />
      </BrowserRouter>
    )

    const startBtn = screen.getByRole('button', { name: /start restocking/i })
    expect(startBtn.hasAttribute('disabled')).toBe(false)

    await user.click(startBtn)

    const dialog = await screen.findByRole('dialog', { name: 'Restock scanner' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('button', { name: /done restocking/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /start restocking/i })).toBeNull()
  })

  it('Test 7: Scanning a matched barcode opens RestockQuickSheet, Add to stock calls updateQuantity + checkOff then re-opens camera', async () => {
    const user = userEvent.setup()
    const updateQuantity = vi.fn().mockResolvedValue(undefined)
    const checkOff = vi.fn().mockResolvedValue({ removed: true })
    const itemsApi = makeItemsApiMock({
      items: [{ id: 42, name: 'Milk', barcode: '__test_barcode__', quantity_mode: 'exact', quantity: 0 }],
      updateQuantity,
    })
    mockUseShoppingList({
      entries: [{ id: 7, item_id: 42, item: { id: 42, name: 'Milk', quantity: 0 }, sort_order: 1 }],
      checkOff,
    })

    render(
      <BrowserRouter>
        <ShoppingList itemsApi={itemsApi} />
      </BrowserRouter>
    )

    await user.click(screen.getByRole('button', { name: /start restocking/i }))
    await user.click(screen.getByRole('button', { name: '__simulate_detected__' }))

    // RestockQuickSheet visible
    const sheet = await screen.findByRole('dialog', { name: 'Milk' })
    expect(sheet).toBeTruthy()

    // Default delta = 1
    await user.click(screen.getByRole('button', { name: 'Add to stock' }))

    await waitFor(() => expect(updateQuantity).toHaveBeenCalledWith(42, 1))
    expect(checkOff).toHaveBeenCalledWith(7, 1)

    // Sheet dismissed, camera re-opened
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
      expect(screen.getByRole('dialog', { name: 'Restock scanner' })).toBeTruthy()
    })
  })

  it('Test 8: Scanning an unknown barcode shows "Item not found" toast; camera re-opens', async () => {
    const user = userEvent.setup()
    const itemsApi = makeItemsApiMock({ items: [] }) // no matches at all
    mockUseShoppingList({ entries: [] })

    render(
      <BrowserRouter>
        <ShoppingList itemsApi={itemsApi} />
      </BrowserRouter>
    )

    await user.click(screen.getByRole('button', { name: /start restocking/i }))
    await user.click(screen.getByRole('button', { name: '__simulate_detected__' }))

    const statuses = await screen.findAllByRole('status')
    const toast = statuses.find((el) => el.textContent.includes('Item not found'))
    expect(toast).toBeTruthy()

    // Camera should still be present (or re-appear) — assert the restock dialog is in document
    expect(screen.getByRole('dialog', { name: 'Restock scanner' })).toBeTruthy()
  })

  it('Test 9: Done restocking closes the overlay and returns to the shopping list', async () => {
    const user = userEvent.setup()
    const itemsApi = makeItemsApiMock({ items: [] })
    mockUseShoppingList({ entries: [] })

    render(
      <BrowserRouter>
        <ShoppingList itemsApi={itemsApi} />
      </BrowserRouter>
    )

    await user.click(screen.getByRole('button', { name: /start restocking/i }))
    await user.click(screen.getByRole('button', { name: /done restocking/i }))

    expect(screen.queryByRole('dialog', { name: 'Restock scanner' })).toBeNull()
    expect(screen.getByRole('button', { name: /start restocking/i })).toBeTruthy()
  })

  it('Test 10: Escape (via overlay Close) also exits restock mode', async () => {
    const user = userEvent.setup()
    const itemsApi = makeItemsApiMock({ items: [] })
    mockUseShoppingList({ entries: [] })

    render(
      <BrowserRouter>
        <ShoppingList itemsApi={itemsApi} />
      </BrowserRouter>
    )

    await user.click(screen.getByRole('button', { name: /start restocking/i }))
    await user.click(screen.getByRole('button', { name: 'Close camera' }))

    expect(screen.queryByRole('dialog', { name: 'Restock scanner' })).toBeNull()
    expect(screen.getByRole('button', { name: /start restocking/i })).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Plan 06 (gap closure): auto-entry dismiss with session-scoped suppression.
  // Closes UAT Test 7 Gap 2.
  // -------------------------------------------------------------------------

  const autoMilk = {
    id: null,
    item_id: 42,
    item_name: 'Milk',
    quantity_mode: 'exact', quantity: 0, status: null,
    reorder_threshold: 3, added_manually: false, sort_order: null,
    auto: true, location_id: null,
  }

  it('Test H: auto entry can be dismissed via remove button', async () => {
    const user = userEvent.setup()
    renderPage({ entries: [autoMilk] })
    expect(screen.getByText('Milk')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Remove Milk from shopping list'))

    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  })

  it('Test I: dismissing an auto entry shows undo toast', async () => {
    const user = userEvent.setup()
    renderPage({ entries: [autoMilk] })

    await user.click(screen.getByLabelText('Remove Milk from shopping list'))

    expect(screen.getByText('Removed from list.')).toBeInTheDocument()
    expect(screen.getByLabelText('Undo remove Milk')).toBeInTheDocument()
  })

  it('Test J: undo restores a dismissed auto entry (no addManual call)', async () => {
    const user = userEvent.setup()
    const addManual = vi.fn(() => Promise.resolve({ ok: true }))
    mockHook.addManual = addManual
    renderPage({ entries: [autoMilk] })

    await user.click(screen.getByLabelText('Remove Milk from shopping list'))
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Undo remove Milk'))

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(addManual).not.toHaveBeenCalled()
  })

  it('Test K: dismissing an auto entry does NOT trigger a backend call', async () => {
    const user = userEvent.setup()
    const removeEntry = vi.fn(() => Promise.resolve({ ok: true }))
    const addManual = vi.fn(() => Promise.resolve({ ok: true }))
    mockHook.removeEntry = removeEntry
    mockHook.addManual = addManual
    renderPage({ entries: [autoMilk] })

    await user.click(screen.getByLabelText('Remove Milk from shopping list'))

    expect(removeEntry).not.toHaveBeenCalled()
    expect(addManual).not.toHaveBeenCalled()
  })

  it('Test G: CheckOffSheet onConfirm on an auto entry passes item_id to checkOff (Gap 1)', async () => {
    const user = userEvent.setup()
    const checkOff = vi.fn(() => Promise.resolve({ ok: true }))
    const autoEntry = {
      id: null,
      item_id: 7,
      item_name: 'Milk',
      quantity_mode: 'exact', quantity: 0, status: null,
      reorder_threshold: 3, added_manually: false, sort_order: null,
      auto: true, location_id: null,
    }
    mockHook.checkOff = checkOff
    renderPage({ entries: [autoEntry] })

    await user.click(screen.getByRole('checkbox', { name: /milk/i }))
    await user.click(screen.getByRole('button', { name: /add to stock/i }))

    await waitFor(() => expect(checkOff).toHaveBeenCalled())
    expect(checkOff).toHaveBeenCalledWith(null, 1, 7)
  })
})
