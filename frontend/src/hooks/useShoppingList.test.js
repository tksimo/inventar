import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock apiFetch at the module level
vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
}))
import { apiFetch } from '../lib/api.js'
import { useShoppingList } from './useShoppingList.js'

function respond(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe('useShoppingList', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('fetches entries on mount', async () => {
    apiFetch.mockImplementationOnce(() =>
      respond([{ id: 1, item_id: 1, item_name: 'Milk', quantity_mode: 'exact',
                 quantity: 0, status: null, reorder_threshold: 3, added_manually: false,
                 sort_order: 1, auto: false, location_id: null }])
    )
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].item_name).toBe('Milk')
  })

  it('addManual POSTs then refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond([]))
      .mockImplementationOnce(() => respond({ id: 5 }, 201))
      .mockImplementationOnce(() => respond([{ id: 5, item_id: 5, item_name: 'New',
        quantity_mode: 'exact', quantity: null, status: null, reorder_threshold: null,
        added_manually: true, sort_order: 1, auto: false, location_id: null }]))
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addManual(5) })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })

  it('addManual returns {duplicate:true} on 409', async () => {
    apiFetch
      .mockImplementationOnce(() => respond([]))
      .mockImplementationOnce(() => respond({ detail: 'Item already on shopping list' }, 409))
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.addManual(5) })
    expect(res.duplicate).toBe(true)
  })

  it('removeEntry updates state optimistically and DELETEs', async () => {
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 1, item_id: 1, item_name: 'A', quantity_mode: 'exact', quantity: null,
          status: null, reorder_threshold: null, added_manually: true, sort_order: 1,
          auto: false, location_id: null },
      ]))
      .mockImplementationOnce(() => respond({ ok: true }))
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.removeEntry(1) })
    expect(result.current.entries).toHaveLength(0)
  })

  it('reorder only PATCHes entries whose sort_order changed', async () => {
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 1, item_id: 1, item_name: 'A', sort_order: 1, quantity_mode: 'exact',
          quantity: null, status: null, reorder_threshold: null, added_manually: true,
          auto: false, location_id: null },
        { id: 2, item_id: 2, item_name: 'B', sort_order: 2, quantity_mode: 'exact',
          quantity: null, status: null, reorder_threshold: null, added_manually: true,
          auto: false, location_id: null },
      ]))
      // Expect exactly one PATCH when we swap their order (both change, so 2 PATCHes)
      .mockImplementation(() => respond({ ok: true }))
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.reorder([2, 1]) })
    // 1 initial GET + 2 PATCHes = 3 calls
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })

  it('checkOff POSTs to /check-off and refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 7, item_id: 7, item_name: 'X', quantity_mode: 'exact', quantity: 1,
          status: null, reorder_threshold: 3, added_manually: false, sort_order: 1,
          auto: false, location_id: null },
      ]))
      .mockImplementationOnce(() => respond({ ok: true, removed: true, item_id: 7, new_quantity: 4 }))
      .mockImplementationOnce(() => respond([]))
    const { result } = renderHook(() => useShoppingList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.checkOff(7, 3) })
    await waitFor(() => expect(result.current.entries).toHaveLength(0))
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })
})
