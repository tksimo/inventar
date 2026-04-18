import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

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

function renderPage({ entries = [], itemsApi = { items: [] } } = {}) {
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
})
