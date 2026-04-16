import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api.js'

/**
 * Probes the backend to determine whether this session is going through
 * HA Supervisor ingress (which is the only environment where user
 * attribution headers are injected). Used by AccessBanner to surface
 * a one-time hint when the user opens the add-on via a direct port.
 *
 * On network/HTTP error, defaults to viaIngress=TRUE so the banner is
 * suppressed — we never want to harass a user when the API is flaky.
 */
export function useAccessInfo() {
  const [state, setState] = useState({ viaIngress: null, userName: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    apiFetch('api/access-info')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        setState({
          viaIngress: Boolean(data.via_ingress),
          userName: data.user_name ?? null,
          loading: false,
          error: null,
        })
      })
      .catch(err => {
        if (cancelled) return
        // Fail open: assume ingress (suppresses the banner)
        setState({ viaIngress: true, userName: null, loading: false, error: err.message })
      })
    return () => { cancelled = true }
  }, [])

  return state
}
