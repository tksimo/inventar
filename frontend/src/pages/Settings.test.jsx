import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from './Settings.jsx'

// Route-aware mock fetch: checks URL to dispatch the right response
function mockFetch({ categories = [], locations = [], categoryStatus = 200, locationStatus = 200 } = {}) {
  return vi.fn(async (url, init) => {
    if (url.includes('api/categories/')) {
      const method = init?.method || 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify(categories), {
          status: categoryStatus,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'POST') {
        // Simulate duplicate (409) if the name matches existing
        const body = JSON.parse(init.body)
        const duplicate = categories.find((c) => c.name === body.name)
        if (duplicate) {
          return new Response(JSON.stringify({ detail: 'Category name already exists' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const newCat = { id: 99, name: body.name, is_default: false }
        return new Response(JSON.stringify(newCat), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'PATCH') {
        const body = JSON.parse(init.body)
        const id = parseInt(url.split('/').filter(Boolean).pop())
        const updated = { ...categories.find((c) => c.id === id), ...body }
        return new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
    }
    if (url.includes('api/locations/')) {
      const method = init?.method || 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify(locations), {
          status: locationStatus,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'POST') {
        const body = JSON.parse(init.body)
        const newLoc = { id: 98, name: body.name }
        return new Response(JSON.stringify(newLoc), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'PATCH') {
        const body = JSON.parse(init.body)
        const id = parseInt(url.split('/').filter(Boolean).pop())
        const updated = { ...locations.find((l) => l.id === id), ...body }
        return new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// T1: Loading renders skeleton rows for both sections (mock fetches pending)
test('T1: shows LoadingState skeletons while fetches are pending', async () => {
  let resolveCategories
  let resolveLocations
  const categoriesPromise = new Promise((res) => { resolveCategories = res })
  const locationsPromise = new Promise((res) => { resolveLocations = res })

  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.includes('api/categories/')) {
      await categoriesPromise
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('api/locations/')) {
      await locationsPromise
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))

  renderSettings()

  // At least one loading indicator visible
  const loadingEls = screen.getAllByRole('status', { name: 'Loading…' })
  expect(loadingEls.length).toBeGreaterThanOrEqual(1)

  await act(async () => {
    resolveCategories()
    resolveLocations()
  })
})

// T2: Category and location errors show ErrorState with section-specific heading
test('T2: category error shows ErrorState with "Could not load categories"', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.includes('api/categories/')) {
      return new Response(JSON.stringify({ detail: 'error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))

  renderSettings()

  await waitFor(() => {
    expect(screen.getByText('Could not load categories')).toBeInTheDocument()
  })
})

test('T2b: location error shows ErrorState with "Could not load locations"', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.includes('api/locations/')) {
      return new Response(JSON.stringify({ detail: 'error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))

  renderSettings()

  await waitFor(() => {
    expect(screen.getByText('Could not load locations')).toBeInTheDocument()
  })
})

// T3: Default categories (is_default=true) now show Pencil + Trash2 just like custom ones
test('T3: default categories have rename/delete buttons (same as custom)', async () => {
  const categories = [
    { id: 1, name: 'Food & pantry', is_default: true },
    { id: 2, name: 'Snacks', is_default: false },
  ]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Food & pantry')
  // Default category must now show Pencil + Trash2
  expect(screen.getByLabelText('Rename Food & pantry')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Food & pantry')).toBeInTheDocument()
  // Custom category unchanged
  expect(screen.getByLabelText('Rename Snacks')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Snacks')).toBeInTheDocument()
})

// T3b: Clicking Pencil on a default category enters rename mode (locked=false wiring)
test('T3b: clicking Pencil on a default category enters rename mode', async () => {
  const categories = [{ id: 1, name: 'Food & pantry', is_default: true }]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Food & pantry')
  fireEvent.click(screen.getByLabelText('Rename Food & pantry'))
  expect(screen.getByLabelText('Rename input for Food & pantry')).toBeInTheDocument()
})

// T4: Adding a new custom category calls create and the new item appears in the list
test('T4: adding a new category calls create and new item appears', async () => {
  const categories = [{ id: 1, name: 'Food & pantry', is_default: true }]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Food & pantry')

  const input = screen.getByPlaceholderText('New category name')
  fireEvent.change(input, { target: { value: 'Beverages' } })
  fireEvent.click(screen.getAllByRole('button', { name: /^Add$/i })[0])

  await waitFor(() => {
    expect(screen.getByText('Beverages')).toBeInTheDocument()
  })
})

// T5: Adding a duplicate (mock 409) shows "That name is already taken." below the add row
test('T5: adding duplicate category shows "That name is already taken."', async () => {
  const categories = [{ id: 1, name: 'Food & pantry', is_default: true }]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Food & pantry')

  // Try to add a category that already exists
  const input = screen.getByPlaceholderText('New category name')
  fireEvent.change(input, { target: { value: 'Food & pantry' } })
  fireEvent.click(screen.getAllByRole('button', { name: /^Add$/i })[0])

  await waitFor(() => {
    expect(screen.getByText('That name is already taken.')).toBeInTheDocument()
  })
})

// T6: Renaming a custom category calls PATCH and the hook updates the list
test('T6: renaming a custom category calls update', async () => {
  const categories = [{ id: 5, name: 'Snacks', is_default: false }]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Snacks')

  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  const renameInput = screen.getByLabelText('Rename input for Snacks')
  fireEvent.change(renameInput, { target: { value: 'Beverages' } })
  fireEvent.keyDown(renameInput, { key: 'Enter' })

  await waitFor(() => {
    expect(screen.getByText('Beverages')).toBeInTheDocument()
  })
})

// T7: Deleting a custom category (confirm then Yes, delete) removes the row
test('T7: deleting a custom category removes it from the list', async () => {
  const categories = [{ id: 5, name: 'Snacks', is_default: false }]
  vi.stubGlobal('fetch', mockFetch({ categories, locations: [] }))

  renderSettings()

  await screen.findByText('Snacks')

  fireEvent.click(screen.getByLabelText('Delete Snacks'))
  expect(screen.getByText('Items in this category will become uncategorised. Delete anyway?')).toBeInTheDocument()

  fireEvent.click(screen.getByText('Yes, delete'))

  await waitFor(() => {
    expect(screen.queryByText('Snacks')).toBeNull()
  })
})

// T8: Adding a location with empty/whitespace name does NOT call the API
test('T8: adding location with empty name does not call API', async () => {
  const fetchMock = mockFetch({ categories: [], locations: [] })
  vi.stubGlobal('fetch', fetchMock)

  renderSettings()

  // Wait for page to load (initial GETs)
  await waitFor(() => {
    expect(screen.getByPlaceholderText('New location name')).toBeInTheDocument()
  })

  const initialCallCount = fetchMock.mock.calls.length

  const input = screen.getByPlaceholderText('New location name')
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.click(screen.getAllByRole('button', { name: /^Add$/i })[1])

  // No additional API calls beyond the initial GETs
  expect(fetchMock.mock.calls.length).toBe(initialCallCount)
})

// T9: Locations section renders with no is_default concept — all entries have rename/delete
test('T9: all locations have rename and delete buttons (no locked concept)', async () => {
  const locations = [
    { id: 1, name: 'Kitchen cabinet' },
    { id: 2, name: 'Bathroom shelf' },
  ]
  vi.stubGlobal('fetch', mockFetch({ categories: [], locations }))

  renderSettings()

  await screen.findByText('Kitchen cabinet')
  await screen.findByText('Bathroom shelf')

  expect(screen.getByLabelText('Rename Kitchen cabinet')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Kitchen cabinet')).toBeInTheDocument()
  expect(screen.getByLabelText('Rename Bathroom shelf')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Bathroom shelf')).toBeInTheDocument()
})
