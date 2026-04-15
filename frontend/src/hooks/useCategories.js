import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

/**
 * Low-level request helper — all API calls go through apiFetch.
 * Never use raw fetch() or absolute paths.
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
 * useCategories — data hook for categories CRUD.
 *
 * Returns:
 *   { categories, loading, error, refetch, create, update, remove }
 */
export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await request('api/categories/')
      setCategories(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const refetch = fetchCategories

  const create = useCallback(async (body) => {
    const category = await request('api/categories/', { method: 'POST', body })
    setCategories(prev => [...prev, category])
    return category
  }, [])

  const update = useCallback(async (id, patch) => {
    const category = await request(`api/categories/${id}`, { method: 'PATCH', body: patch })
    setCategories(prev => prev.map(c => c.id === id ? category : c))
    return category
  }, [])

  const remove = useCallback(async (id) => {
    await request(`api/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  return { categories, loading, error, refetch, create, update, remove }
}
