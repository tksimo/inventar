import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
}))
import { apiFetch } from '../lib/api.js'
import { useRecipes } from './useRecipes.js'

function respond(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

const EMPTY_LIST = []
const SAMPLE_LIST = [
  { id: 1, name: 'Pasta', source_url: null, ingredient_count: 2,
    created_at: '2026-04-19', updated_at: '2026-04-19' },
]

describe('useRecipes', () => {
  beforeEach(() => { apiFetch.mockReset() })
  afterEach(() => { vi.restoreAllMocks() })

  it('fetches recipes on mount', async () => {
    apiFetch.mockImplementationOnce(() => respond(SAMPLE_LIST))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.recipes).toHaveLength(1)
    expect(result.current.recipes[0].name).toBe('Pasta')
  })

  it('create POSTs then refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(EMPTY_LIST))
      .mockImplementationOnce(() => respond({ id: 5, name: 'New', ingredients: [] }, 201))
      .mockImplementationOnce(() => respond([{ id: 5, name: 'New', ingredient_count: 0,
                                               source_url: null, created_at: 'x', updated_at: 'x' }]))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.create({ name: 'New' }) })
    expect(res.ok).toBe(true)
    expect(res.recipe.id).toBe(5)
    await waitFor(() => expect(result.current.recipes).toHaveLength(1))
    // first call was mount refetch, second POST, third refetch
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })

  it('update PATCHes then refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(SAMPLE_LIST))
      .mockImplementationOnce(() => respond({ id: 1, name: 'Changed', ingredients: [] }))
      .mockImplementationOnce(() => respond(SAMPLE_LIST))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.update(1, { name: 'Changed' }) })
    expect(res.ok).toBe(true)
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })

  it('remove DELETEs then refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(SAMPLE_LIST))
      .mockImplementationOnce(() => respond(null, 200))
      .mockImplementationOnce(() => respond(EMPTY_LIST))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.remove(1) })
    expect(res.ok).toBe(true)
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })

  it('importUrl returns preview (no refetch)', async () => {
    const preview = { id: 0, name: 'Imported', source_url: 'https://x', instructions: null,
                      ingredients: [], created_at: 'x', updated_at: 'x' }
    apiFetch
      .mockImplementationOnce(() => respond(EMPTY_LIST))
      .mockImplementationOnce(() => respond(preview))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.importUrl('https://x') })
    expect(res.ok).toBe(true)
    expect(res.preview.name).toBe('Imported')
    // importUrl does NOT trigger refetch — only mount + importUrl POST
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('checkIngredients GETs and returns result', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(EMPTY_LIST))
      .mockImplementationOnce(() => respond({ recipe_id: 1, ingredients: [], missing_count: 0 }))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.checkIngredients(1) })
    expect(res.ok).toBe(true)
    expect(res.check.missing_count).toBe(0)
  })

  it('addMissing POSTs and returns result', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(EMPTY_LIST))
      .mockImplementationOnce(() => respond({ added: 2, skipped: 0 }))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => { res = await result.current.addMissing(1) })
    expect(res.ok).toBe(true)
    expect(res.result.added).toBe(2)
  })

  it('cook POSTs body {deductions} and refetches', async () => {
    apiFetch
      .mockImplementationOnce(() => respond(EMPTY_LIST))
      .mockImplementationOnce(() => respond({ ok: true, deducted: 1, recipe_id: 1 }))
      .mockImplementationOnce(() => respond(EMPTY_LIST))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let res
    await act(async () => {
      res = await result.current.cook(1, [{ ingredient_id: 10, item_id: 20, amount: 3 }])
    })
    expect(res.ok).toBe(true)
    // Verify body sent correctly
    const [, init] = apiFetch.mock.calls[1]
    const body = JSON.parse(init.body)
    expect(body.deductions).toHaveLength(1)
    expect(body.deductions[0].amount).toBe(3)
  })

  it('network error sets error state', async () => {
    apiFetch.mockImplementationOnce(() => respond({ detail: 'nope' }, 500))
    const { result } = renderHook(() => useRecipes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })
})
