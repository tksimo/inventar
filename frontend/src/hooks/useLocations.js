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
 * useLocations — data hook for locations CRUD.
 *
 * Returns:
 *   { locations, loading, error, refetch, create, update, remove }
 */
export function useLocations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await request('api/locations/')
      setLocations(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const refetch = fetchLocations

  const create = useCallback(async (body) => {
    const location = await request('api/locations/', { method: 'POST', body })
    setLocations(prev => [...prev, location])
    return location
  }, [])

  const update = useCallback(async (id, patch) => {
    const location = await request(`api/locations/${id}`, { method: 'PATCH', body: patch })
    setLocations(prev => prev.map(l => l.id === id ? location : l))
    return location
  }, [])

  const remove = useCallback(async (id) => {
    await request(`api/locations/${id}`, { method: 'DELETE' })
    setLocations(prev => prev.filter(l => l.id !== id))
  }, [])

  return { locations, loading, error, refetch, create, update, remove }
}
