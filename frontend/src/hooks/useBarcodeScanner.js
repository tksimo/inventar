import { useState, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

/**
 * useBarcodeScanner — orchestrates the Phase 3 barcode scan flow.
 *
 * Three scan outcomes (CONTEXT.md D-03/D-05/D-07/D-08, RESEARCH.md Pattern 4):
 *
 *   1. 'matched'   — code matches an existing item.barcode → caller shows QuickUpdateSheet.
 *   2. 'prefill'   — no local match, OFF lookup returned 200 → caller opens ItemDrawer
 *                    with name/image_url/nutrition pre-filled (D-07).
 *   3. 'fallback'  — no local match, OFF lookup failed (404/timeout/network) → caller
 *                    opens ItemDrawer with ONLY barcode pre-filled, no error shown (D-08).
 *
 * The hook deliberately does NOT expose an `error` field. D-08 requires the user
 * experience for "barcode not in OFF" to be identical to "OFF unreachable" — both
 * quietly open the drawer for manual entry.
 */
export function useBarcodeScanner({ items }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanState, setScanState] = useState('idle')
  const [matchedItem, setMatchedItem] = useState(null)
  const [prefillProduct, setPrefillProduct] = useState(null)
  const [fallbackBarcode, setFallbackBarcode] = useState(null)

  const openScanner = useCallback(() => {
    setScanState('idle')
    setMatchedItem(null)
    setPrefillProduct(null)
    setFallbackBarcode(null)
    setIsOpen(true)
  }, [])

  const closeScanner = useCallback(() => {
    setIsOpen(false)
  }, [])

  const reset = useCallback(() => {
    setScanState('idle')
    setMatchedItem(null)
    setPrefillProduct(null)
    setFallbackBarcode(null)
  }, [])

  const handleDetected = useCallback(async (rawValue) => {
    // 1. Close camera immediately (D-02 / UI-SPEC "overlay fades out on detect")
    setIsOpen(false)

    // 2. Local match check (D-13: no OFF lookup for known items)
    const existing = items.find((i) => i.barcode === rawValue)
    if (existing) {
      setMatchedItem(existing)
      setScanState('matched')
      return
    }

    // 3. OFF proxy lookup via backend
    setScanState('looking_up')
    try {
      const res = await apiFetch(`api/barcode/${encodeURIComponent(rawValue)}`)
      if (res.ok) {
        const product = await res.json()
        setPrefillProduct(product)
        setScanState('prefill')
        return
      }
      // Non-2xx → fallback (D-08: no error state)
      setFallbackBarcode(rawValue)
      setScanState('fallback')
    } catch {
      // Network error → identical fallback UX (D-08)
      setFallbackBarcode(rawValue)
      setScanState('fallback')
    }
  }, [items])

  return {
    isOpen,
    openScanner,
    closeScanner,
    handleDetected,
    scanState,
    matchedItem,
    prefillProduct,
    fallbackBarcode,
    reset,
  }
}
