/**
 * apiFetch — the ONE correct way to call the backend from the SPA.
 *
 * HA ingress serves the SPA at
 *   https://hass.local/api/hassio_ingress/<token>/
 * A relative URL like './healthz' resolves against the current document,
 * which already includes the ingress token prefix, and therefore reaches
 * the FastAPI backend via ingress correctly.
 *
 * An ABSOLUTE URL like '/healthz' resolves against the HA host root and
 * bypasses the ingress token → 404. This is why we reject paths that
 * begin with '/'.
 *
 * See CONTEXT.md D-06 and 01-RESEARCH.md Pitfall 1 for the full rationale.
 */
export function apiFetch(path, init) {
  if (typeof path !== 'string') {
    throw new TypeError('apiFetch: path must be a string')
  }
  if (path.startsWith('/')) {
    throw new TypeError(
      "apiFetch: path must not start with '/' — use a relative path like 'healthz'. " +
      "Absolute paths bypass the HA ingress token and will 404.",
    )
  }
  return fetch(`./${path}`, init)
}
