import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBarcodeScanner } from './useBarcodeScanner.js'

function makeItem(overrides = {}) {
  return {
    id: 1,
    name: 'X',
    barcode: null,
    quantity_mode: 'exact',
    quantity: 0,
    status: null,
    category_id: null,
    location_id: null,
    ...overrides,
  }
}

describe('useBarcodeScanner', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Test 1: openScanner flips isOpen to true and scanState to idle', () => {
    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))
    expect(result.current.isOpen).toBe(false)
    act(() => { result.current.openScanner() })
    expect(result.current.isOpen).toBe(true)
    expect(result.current.scanState).toBe('idle')
  })

  it('Test 2: closeScanner flips isOpen to false', () => {
    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))
    act(() => { result.current.openScanner() })
    expect(result.current.isOpen).toBe(true)
    act(() => { result.current.closeScanner() })
    expect(result.current.isOpen).toBe(false)
  })

  it('Test 3: handleDetected matches existing item by barcode and sets scanState matched', async () => {
    const item = makeItem({ id: 1, name: 'Milk', barcode: '3017624010701', quantity_mode: 'exact', quantity: 2, status: null })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarcodeScanner({ items: [item] }))

    await act(async () => {
      await result.current.handleDetected('3017624010701')
    })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.scanState).toBe('matched')
    expect(result.current.matchedItem.id).toBe(1)
    // fetch must NOT be called for known item (D-13)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Test 4: handleDetected calls OFF proxy for unknown barcode and sets prefill on 200', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('api/barcode/')) {
        return new Response(
          JSON.stringify({ barcode: '3017624010701', name: 'Nutella', image_url: 'https://x/n.jpg', calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))

    await act(async () => {
      await result.current.handleDetected('3017624010701')
    })

    await waitFor(() => expect(result.current.scanState).toBe('prefill'))

    expect(result.current.prefillProduct.name).toBe('Nutella')
    expect(result.current.isOpen).toBe(false)
    expect(result.current.scanState).toBe('prefill')
    // fetch must have been called with a URL containing api/barcode/3017624010701
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calledUrls.some((u) => u.includes('api/barcode/3017624010701'))).toBe(true)
  })

  it('Test 5: handleDetected falls back to barcode-only on 404', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))

    await act(async () => {
      await result.current.handleDetected('0000000000000')
    })

    await waitFor(() => expect(result.current.scanState).toBe('fallback'))

    expect(result.current.scanState).toBe('fallback')
    expect(result.current.fallbackBarcode).toBe('0000000000000')
    expect(result.current.prefillProduct).toBeNull()
    // Critical: the returned object has NO `error` field — hook surface forbids it (D-08)
    expect('error' in result.current).toBe(false)
  })

  it('Test 6: handleDetected falls back on network error (fetch throws)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network')
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))

    await act(async () => {
      await result.current.handleDetected('1234567890')
    })

    await waitFor(() => expect(result.current.scanState).toBe('fallback'))

    expect(result.current.fallbackBarcode).toBe('1234567890')
  })

  it('Test 7: handleDetected URL-encodes the barcode', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarcodeScanner({ items: [] }))

    await act(async () => {
      await result.current.handleDetected('../secret')
    })

    await waitFor(() => expect(result.current.scanState).toBe('fallback'))

    // The fetched URL must contain the encoded form, NOT the raw traversal
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calledUrls.some((u) => u.includes('api/barcode/..%2Fsecret'))).toBe(true)
    expect(calledUrls.some((u) => u.includes('api/barcode/../secret'))).toBe(false)
  })

  it('Test 8: reset clears scanState back to idle', async () => {
    const item = makeItem({ id: 1, name: 'Milk', barcode: '3017624010701', quantity_mode: 'exact', quantity: 2, status: null })
    vi.stubGlobal('fetch', vi.fn())

    const { result } = renderHook(() => useBarcodeScanner({ items: [item] }))

    await act(async () => {
      await result.current.handleDetected('3017624010701')
    })

    expect(result.current.scanState).toBe('matched')
    expect(result.current.matchedItem).not.toBeNull()

    act(() => { result.current.reset() })

    expect(result.current.scanState).toBe('idle')
    expect(result.current.matchedItem).toBeNull()
  })
})
