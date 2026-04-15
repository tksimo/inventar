import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

/**
 * Low-level request helper — all API calls in this file go through apiFetch.
 * Never use raw fetch() or absolute paths here.
 */
async function request(path, { method = 'GET', body } = {}) {
  const res = await apiFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status}`)
  return method === 'DELETE' ? null : res.json()
}

/**
 * useItems — data hook for items CRUD + optimistic quantity/status updates.
 *
 * Returns:
 *   { items, loading, error, refetch, create, update, remove, updateQuantity, cycleStatus }
 *
 * Optimistic UI contract (D-03):
 *   - updateQuantity applies local state change immediately and reverts on error.
 *   - At quantity <= 0 with delta < 0 in exact mode, auto-flips to status "out".
 *   - cycleStatus advances Have → Low → Out → Have optimistically.
 */
export function useItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorItemId, setErrorItemId] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await request('api/items/')
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const refetch = fetchItems

  const create = useCallback(async (body) => {
    const item = await request('api/items/', { method: 'POST', body })
    setItems(prev => [item, ...prev])
    return item
  }, [])

  const update = useCallback(async (id, patch) => {
    const item = await request(`api/items/${id}`, { method: 'PATCH', body: patch })
    setItems(prev => prev.map(i => i.id === id ? item : i))
    return item
  }, [])

  const remove = useCallback(async (id) => {
    await request(`api/items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  /**
   * updateQuantity — optimistic update with D-03 auto-flip.
   * If item is in exact mode at quantity <= 0 and delta < 0,
   * sends a mode-flip PATCH instead of a quantity decrement.
   * Reverts to original state on API failure.
   */
  const updateQuantity = useCallback(async (id, delta) => {
    const original = items.find(i => i.id === id)
    if (!original) return
    const cloned = { ...original } // Pitfall 4: capture by value before optimistic update

    let patch
    if (original.quantity_mode === 'exact' && (original.quantity ?? 0) <= 0 && delta < 0) {
      patch = { quantity_mode: 'status', status: 'out', quantity: null }
    } else {
      patch = { quantity: (original.quantity ?? 0) + delta }
    }

    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

    try {
      const updated = await request(`api/items/${id}`, { method: 'PATCH', body: patch })
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch (e) {
      setItems(prev => prev.map(i => i.id === id ? cloned : i))
      setErrorItemId(id)
      setTimeout(() => setErrorItemId(null), 300)
    }
  }, [items])

  /**
   * cycleStatus — optimistic status cycle: Have → Low → Out → Have.
   * Sends PATCH with next status, reverts on error.
   */
  const cycleStatus = useCallback(async (id) => {
    const original = items.find(i => i.id === id)
    if (!original) return
    const cloned = { ...original }

    const cycle = { have: 'low', low: 'out', out: 'have' }
    const nextStatus = cycle[original.status ?? 'have'] ?? 'low'
    const patch = { status: nextStatus, quantity_mode: 'status' }

    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

    try {
      const updated = await request(`api/items/${id}`, { method: 'PATCH', body: patch })
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch (e) {
      setItems(prev => prev.map(i => i.id === id ? cloned : i))
      setErrorItemId(id)
      setTimeout(() => setErrorItemId(null), 300)
    }
  }, [items])

  return { items, loading, error, errorItemId, refetch, create, update, remove, updateQuantity, cycleStatus }
}
