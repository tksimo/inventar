import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../lib/api.js'
import { useAccessInfo } from './useAccessInfo.js'

describe('useAccessInfo', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('T1: returns loading=true and null values synchronously on first render', () => {
    // apiFetch never resolves during this test
    apiFetch.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAccessInfo())
    expect(result.current).toEqual({
      viaIngress: null,
      userName: null,
      loading: true,
      error: null,
    })
  })

  it('T2: after fetch resolves with via_ingress=true returns viaIngress=true, userName=Alice', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ via_ingress: true, user_name: 'Alice' }),
    })
    const { result } = renderHook(() => useAccessInfo())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toEqual({
      viaIngress: true,
      userName: 'Alice',
      loading: false,
      error: null,
    })
  })

  it('T3: after fetch resolves with via_ingress=false returns viaIngress=false, userName=null', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ via_ingress: false, user_name: null }),
    })
    const { result } = renderHook(() => useAccessInfo())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toEqual({
      viaIngress: false,
      userName: null,
      loading: false,
      error: null,
    })
  })

  it('T4: when apiFetch rejects, defaults viaIngress=true to suppress the banner', async () => {
    apiFetch.mockRejectedValue(new Error('Network failure'))
    const { result } = renderHook(() => useAccessInfo())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.viaIngress).toBe(true)
    expect(result.current.userName).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Network failure')
  })
})
