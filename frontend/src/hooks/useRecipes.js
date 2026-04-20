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
 * useRecipes — data hook for Phase 5 Recipes page.
 *
 * Mirrors useShoppingList contract: returns state (recipes, loading, error),
 * refetch, and all Phase-5 mutations. All paths relative (apiFetch contract).
 *
 * importUrl returns the parsed preview — the CALLER is responsible for opening
 * the RecipeForm with the data and calling create() if the user decides to save.
 */
export function useRecipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await json('api/recipes/')
      setRecipes(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const create = useCallback(async (body) => {
    try {
      const saved = await json('api/recipes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await refetch()
      return { ok: true, recipe: saved }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  const update = useCallback(async (id, patch) => {
    try {
      const saved = await json(`api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      await refetch()
      return { ok: true, recipe: saved }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  const remove = useCallback(async (id) => {
    try {
      await json(`api/recipes/${id}`, { method: 'DELETE' })
      await refetch()
      return { ok: true }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  const getDetail = useCallback(async (id) => {
    try {
      const data = await json(`api/recipes/${id}`)
      return { ok: true, recipe: data }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [])

  const importUrl = useCallback(async (url) => {
    try {
      const preview = await json('api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      return { ok: true, preview }
    } catch (e) {
      return { ok: false, status: e.status, message: e.message }
    }
  }, [])

  const checkIngredients = useCallback(async (id) => {
    try {
      const data = await json(`api/recipes/${id}/check`)
      return { ok: true, check: data }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [])

  const addMissing = useCallback(async (id) => {
    try {
      const data = await json(`api/recipes/${id}/add-missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      return { ok: true, result: data }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [])

  const cook = useCallback(async (id, deductions) => {
    try {
      const data = await json(`api/recipes/${id}/cook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductions: deductions || [] }),
      })
      await refetch()
      return { ok: true, result: data }
    } catch (e) {
      setError(e.message)
      return { ok: false }
    }
  }, [refetch])

  return {
    recipes,
    loading,
    error,
    refetch,
    create,
    update,
    remove,
    getDetail,
    importUrl,
    checkIngredients,
    addMissing,
    cook,
  }
}
