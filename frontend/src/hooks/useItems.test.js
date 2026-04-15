import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useItems } from './useItems.js'

// Helper: build a minimal mock item
function makeItem(overrides = {}) {
  return {
    id: 1,
    name: 'Test Item',
    quantity: 3,
    quantity_mode: 'exact',
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

// Helper: create a fetch mock that responds to the initial GET items/ call
// and then to subsequent calls via the `handlers` array.
// Each handler is { method, urlPart, response } and returns the first matching entry.
function createFetchMock(...responses) {
  let callIndex = 0
  return vi.fn(async (_url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const response = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    if (response instanceof Error) throw response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

describe('useItems', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('loads items on mount', async () => {
    const item1 = makeItem({ id: 1 })
    const item2 = makeItem({ id: 2, name: 'Second Item' })

    vi.stubGlobal('fetch', createFetchMock([item1, item2]))

    const { result } = renderHook(() => useItems())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('create prepends returned item to items', async () => {
    const existing = makeItem({ id: 1 })
    const newItem = makeItem({ id: 99, name: 'New Item' })

    // First call: GET items/ -> [existing]
    // Second call: POST items/ -> newItem
    vi.stubGlobal('fetch', createFetchMock([existing], newItem))

    const { result } = renderHook(() => useItems())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.create({ name: 'New Item', quantity_mode: 'exact', quantity: 1 })
    })

    expect(result.current.items[0].id).toBe(99)
    expect(result.current.items).toHaveLength(2)
  })

  it('updateQuantity optimistically increments then syncs with server response', async () => {
    const item = makeItem({ id: 1, quantity: 3 })
    const serverResponse = { ...item, quantity: 4 }

    // Intercept calls: index 0 = initial GET, index 1 = PATCH
    let fetchCallCount = 0
    const mockFetch = vi.fn(async (_url, init) => {
      fetchCallCount++
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') {
        return new Response(JSON.stringify([item]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      // PATCH — simulate slight delay then return server response
      return new Response(JSON.stringify(serverResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useItems())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items[0].quantity).toBe(3)

    await act(async () => {
      await result.current.updateQuantity(1, 1)
    })

    // After resolution, state should match server response
    expect(result.current.items[0].quantity).toBe(4)
  })

  it('updateQuantity reverts on API error', async () => {
    const item = makeItem({ id: 1, quantity: 5 })

    const mockFetch = vi.fn(async (_url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') {
        return new Response(JSON.stringify([item]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      // PATCH fails with non-OK status — causes the hook to throw and revert
      return new Response('Server Error', { status: 500 })
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useItems())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items[0].quantity).toBe(5)

    // updateQuantity is fire-and-forget from the test's perspective —
    // we wrap it in act and wait for the state to settle back to original.
    await act(async () => {
      await result.current.updateQuantity(1, 1).catch(() => {})
    })

    // State should be reverted back to original quantity (5), not the optimistic value (6)
    await waitFor(() => expect(result.current.items[0].quantity).toBe(5))
  })

  it('updateQuantity auto-flips from quantity=0 to status "out" when delta < 0', async () => {
    const item = makeItem({ id: 1, quantity: 0, quantity_mode: 'exact', status: null })
    const serverResponse = { ...item, quantity: null, quantity_mode: 'status', status: 'out' }

    const mockFetch = vi.fn(async (_url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') {
        return new Response(JSON.stringify([item]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify(serverResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useItems())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateQuantity(1, -1)
    })

    // Verify the PATCH body sent was the auto-flip payload
    const patchCall = mockFetch.mock.calls.find(([_url, init]) =>
      (init?.method ?? 'GET').toUpperCase() === 'PATCH'
    )
    expect(patchCall).toBeDefined()
    const body = JSON.parse(patchCall[1].body)
    expect(body).toEqual({ quantity_mode: 'status', status: 'out', quantity: null })
  })

  it('cycleStatus advances Have → Low → Out → Have', async () => {
    const item = makeItem({ id: 1, quantity: null, quantity_mode: 'status', status: 'have' })

    let currentItem = { ...item }
    const mockFetch = vi.fn(async (_url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') {
        return new Response(JSON.stringify([currentItem]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      // PATCH — return item with the patched status
      const patch = JSON.parse(init.body)
      currentItem = { ...currentItem, ...patch }
      return new Response(JSON.stringify(currentItem), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useItems())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items[0].status).toBe('have')

    // Cycle 1: have → low
    await act(async () => {
      await result.current.cycleStatus(1)
    })
    expect(result.current.items[0].status).toBe('low')

    // Cycle 2: low → out
    await act(async () => {
      await result.current.cycleStatus(1)
    })
    expect(result.current.items[0].status).toBe('out')

    // Cycle 3: out → have
    await act(async () => {
      await result.current.cycleStatus(1)
    })
    expect(result.current.items[0].status).toBe('have')

    // Verify the three PATCH bodies sent
    const patchCalls = mockFetch.mock.calls.filter(([_url, init]) =>
      (init?.method ?? 'GET').toUpperCase() === 'PATCH'
    )
    expect(patchCalls).toHaveLength(3)
    expect(JSON.parse(patchCalls[0][1].body)).toMatchObject({ status: 'low' })
    expect(JSON.parse(patchCalls[1][1].body)).toMatchObject({ status: 'out' })
    expect(JSON.parse(patchCalls[2][1].body)).toMatchObject({ status: 'have' })
  })
})
