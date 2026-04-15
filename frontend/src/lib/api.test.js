import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api.js'

describe('apiFetch', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("prepends './' to a bare path so it resolves under the HA ingress prefix", async () => {
    await apiFetch('healthz')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('./healthz', undefined)
  })

  it('forwards the init object unchanged', async () => {
    const init = { method: 'POST', headers: { 'content-type': 'application/json' } }
    await apiFetch('items', init)
    expect(fetchMock).toHaveBeenCalledWith('./items', init)
  })

  it("throws a TypeError if path starts with '/' (absolute paths break under ingress)", () => {
    expect(() => apiFetch('/healthz')).toThrowError(TypeError)
    expect(() => apiFetch('/healthz')).toThrowError(/must not start with/)
  })

  it('throws a TypeError if path is not a string', () => {
    // @ts-expect-error intentional wrong type
    expect(() => apiFetch(42)).toThrowError(TypeError)
  })
})
