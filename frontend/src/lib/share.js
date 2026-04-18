/**
 * Shopping list share/export helpers (SHOP-05, D-17, D-18).
 *
 * formatShoppingList — D-18 export format.
 *   Header "Einkaufsliste", blank line, then one "• {name} ({qtyLabel})" line per entry.
 *   When no meaningful quantity info is available the parens are omitted:
 *     "• Salt"  (quantity=null AND status=null)
 *
 * shareText — Web Share API primary, clipboard fallback.
 *   Returns { method } so the caller can toast appropriately.
 *   Errors in navigator.share (including user-cancel AbortError) yield
 *   { method: 'share-error' } — caller stays silent (share cancel is not a failure).
 */

function quantityLabel(entry) {
  if (entry.quantity_mode === 'exact' && entry.quantity != null) {
    return `${entry.quantity} left`
  }
  if (entry.quantity_mode === 'status' && entry.status) {
    const s = entry.status
    return s.charAt(0).toUpperCase() + s.slice(1) // Out / Low / Have
  }
  return null
}

export function formatShoppingList(entries) {
  const lines = ['Einkaufsliste', '']
  for (const e of entries) {
    const label = quantityLabel(e)
    lines.push(label != null ? `• ${e.item_name} (${label})` : `• ${e.item_name}`)
  }
  return lines.join('\n')
}

export async function shareText({ title, text }) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return { method: 'share' }
    } catch {
      return { method: 'share-error' }
    }
  }
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('No share or clipboard API available')
  }
  await navigator.clipboard.writeText(text)
  return { method: 'clipboard' }
}
