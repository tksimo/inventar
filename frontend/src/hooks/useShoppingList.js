import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

async function json(path, init) {
  const res = await apiFetch(path, init)
  if (!res.ok) {
    const err = new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}`)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

/**
 * useShoppingList — data hook for the shopping list page and nav badge.
 *
 * Returns:
 *   { entries, loading, error, refetch, addManual, removeEntry, reorder, checkOff }
 *
 * Errors from mutations are logged + surfaced via `error`. Optimistic state
 * is used for remove and reorder; all changes reconcile on the next refetch
 * (refetch is called implicitly after addManual and checkOff because the
 * server-side threshold logic may add or remove rows).
 */
export function useShoppingList() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await json('api/shopping-list/')
      setEntries(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const addManual = useCallback(async (item_id) => {
    try {
      await json('api/shopping-list/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id }),
      })
      await refetch()
      return { ok: true }
    } catch (e) {
      if (e.status === 409) return { duplicate: true }
      if (e.status === 404) return { notFound: true }
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  const removeEntry = useCallback(async (entry_id) => {
    const snapshot = entries
    setEntries((prev) => prev.filter((e) => e.id !== entry_id))
    try {
      await json(`api/shopping-list/${entry_id}`, { method: 'DELETE' })
      return { ok: true }
    } catch (e) {
      setEntries(snapshot)
      setError(e.message)
      return { ok: false }
    }
  }, [entries])

  const reorder = useCallback(async (orderedEntryIds) => {
    // Compute { id → newSortOrder }. newSortOrder = index + 1 (1-based).
    // Only persist PATCHes for entries whose sort_order value actually changed.
    const snapshot = entries
    const byId = new Map(entries.map((e) => [e.id, e]))
    const updated = orderedEntryIds
      .map((id, idx) => {
        const e = byId.get(id)
        if (!e) return null
        return { ...e, sort_order: idx + 1 }
      })
      .filter(Boolean)
    // Append any entries not in orderedEntryIds (e.g. auto entries with null id) in original order
    const includedIds = new Set(orderedEntryIds)
    const remainder = entries.filter((e) => !includedIds.has(e.id))
    setEntries([...updated, ...remainder])

    const toPatch = updated.filter((u) => {
      const prior = byId.get(u.id)
      return prior && prior.sort_order !== u.sort_order && u.id != null
    })
    try {
      await Promise.all(
        toPatch.map((e) =>
          json(`api/shopping-list/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: e.sort_order }),
          })
        )
      )
      return { ok: true }
    } catch (e) {
      setEntries(snapshot)
      setError(e.message)
      return { ok: false }
    }
  }, [entries])

  const checkOff = useCallback(async (entry_id, quantity_added) => {
    try {
      await json(`api/shopping-list/${entry_id}/check-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity_added }),
      })
      await refetch()
      return { ok: true }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  return { entries, loading, error, refetch, addManual, removeEntry, reorder, checkOff }
}
