/**
 * Time formatting utilities per UI-SPEC §Copywriting Contract.
 *
 * relativeTime: "just now" | "Nm ago" | "Nh ago" | "Nd ago" | "DD MMM"
 * absoluteTime: "DD MMM YYYY at HH:MM" (24-hour, en-GB)
 *
 * Both functions are pure, have no side effects, and return '' for null/undefined input.
 */

export function relativeTime(input) {
  if (!input) return ''
  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function absoluteTime(input) {
  if (!input) return ''
  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return ''
  const d = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const t = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${d} at ${t}`
}
