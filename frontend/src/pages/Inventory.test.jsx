import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Inventory from './Inventory.jsx'

// Helper to build a minimal item
function makeItem(overrides = {}) {
  return {
    id: 1,
    name: 'Milk',
    quantity_mode: 'exact',
    quantity: 2,
    status: null,
    category_id: null,
    location_id: null,
    barcode: null,
    reorder_threshold: null,
    notes: null,
    archived: false,
    updated_at: new Date().toISOString(),
    last_updated_by_name: null,
    ...overrides,
  }
}

// Helper: mock fetch to return given responses for items, categories, locations (in order)
function mockFetch({ items = [], categories = [], locations = [] } = {}) {
  let callIndex = 0
  const responses = [items, categories, locations]
  return vi.fn(async (url) => {
    // Route by URL segment
    if (url.includes('api/items/')) {
      return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('api/categories/')) {
      return new Response(JSON.stringify(categories), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('api/locations/')) {
      return new Response(JSON.stringify(locations), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    // fallback
    const resp = responses[callIndex] ?? []
    callIndex++
    return new Response(JSON.stringify(resp), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

function mockFetchError() {
  return vi.fn(async () => {
    throw new Error('Network error')
  })
}

afterEach(() => {
  cleanup()
  delete window.__inventarAddClicked
  delete window.__inventarRowClicked
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('Test 1: shows LoadingState skeletons while fetch is pending', async () => {
  let resolveItems
  const itemsPromise = new Promise((res) => { resolveItems = res })

  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.includes('api/items/')) {
      await itemsPromise
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))

  render(<Inventory />)

  // While items fetch is pending, LoadingState should be visible
  const loadingEl = screen.getByRole('status', { name: 'Loading…' })
  expect(loadingEl).toBeInTheDocument()

  // Resolve so cleanup doesn't hang
  await act(async () => {
    resolveItems()
  })
})

it('Test 2: shows ErrorState when items fetch rejects', async () => {
  vi.stubGlobal('fetch', mockFetchError())

  render(<Inventory />)

  await waitFor(() => {
    expect(screen.getByText('Could not load inventory')).toBeInTheDocument()
  })
})

it('Test 3: empty state with CTA — clicking "Add your first item" sets window.__inventarAddClicked', async () => {
  vi.stubGlobal('fetch', mockFetch({ items: [], categories: [], locations: [] }))

  render(<Inventory />)

  await waitFor(() => {
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByText('Add your first item'))
  expect(window.__inventarAddClicked).toBe(true)
})

it('Test 4: renders item name and attribution line when item has last_updated_by_name', async () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const item = makeItem({
    id: 1,
    name: 'Butter',
    last_updated_by_name: 'Alice',
    updated_at: fiveMinutesAgo,
    category_id: null,
    location_id: null,
  })

  vi.stubGlobal('fetch', mockFetch({ items: [item], categories: [], locations: [] }))

  render(<Inventory />)

  await waitFor(() => {
    expect(screen.getAllByText('Butter').length).toBeGreaterThan(0)
  })

  // Attribution line should appear (may appear in both row and card but at least once)
  const attributions = screen.getAllByText(/Updated by Alice/)
  expect(attributions.length).toBeGreaterThan(0)
})

it('Test 5: search filters items — "mil" shows Milk but not Bread', async () => {
  const milk = makeItem({ id: 1, name: 'Milk' })
  const bread = makeItem({ id: 2, name: 'Bread' })

  vi.stubGlobal('fetch', mockFetch({ items: [milk, bread], categories: [], locations: [] }))

  render(<Inventory />)

  // Wait for items to load
  await waitFor(() => {
    expect(screen.getAllByText('Milk').length).toBeGreaterThan(0)
  })
  expect(screen.getAllByText('Bread').length).toBeGreaterThan(0)

  // Now use fake timers to control the debounce
  vi.useFakeTimers()

  const searchInput = screen.getByLabelText('Search items')
  fireEvent.change(searchInput, { target: { value: 'mil' } })

  // Advance past the 200ms debounce
  await act(async () => {
    vi.advanceTimersByTime(250)
  })

  vi.useRealTimers()

  // Milk should still be visible, Bread should be filtered out
  expect(screen.getAllByText('Milk').length).toBeGreaterThan(0)
  expect(screen.queryByText('Bread')).not.toBeInTheDocument()
})

it('Test 6: filter chip dismiss — clicking × on active chip removes it from filter row', async () => {
  const category = { id: 1, name: 'Food', is_default: false }
  const item = makeItem({ id: 1, name: 'Apple', category_id: 1 })

  vi.stubGlobal('fetch', mockFetch({ items: [item], categories: [category], locations: [] }))

  render(<Inventory />)

  await waitFor(() => {
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0)
  })

  // Open the filter picker by clicking the "Filter" chip
  fireEvent.click(screen.getByText('Filter'))

  // Find the "Food" chip inside the picker and click it to activate the filter
  // The picker shows category chips; click the "Food" chip body
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Filter picker' })).toBeInTheDocument()
  })

  // Click the Food chip in the picker (it's an inactive chip - click the button)
  const foodChipsInPicker = screen.getAllByText('Food')
  fireEvent.click(foodChipsInPicker[0])

  // Close the picker
  fireEvent.click(screen.getByLabelText('Close filter picker'))

  // Now an active "Food" chip should appear in the active filter row
  await waitFor(() => {
    // There should be an active chip with dismiss button
    const dismissBtn = screen.getByLabelText('Remove filter: Food')
    expect(dismissBtn).toBeInTheDocument()

    // Click dismiss
    fireEvent.click(dismissBtn)
  })

  // After dismissing, the active chip should be gone
  await waitFor(() => {
    expect(screen.queryByLabelText('Remove filter: Food')).not.toBeInTheDocument()
  })
})
