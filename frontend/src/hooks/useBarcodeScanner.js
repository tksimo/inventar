import { useState, useCallback } from 'react'
import { apiFetch } from '../lib/api.js'

/**
 * useBarcodeScanner — orchestrates barcode scan flows for Phase 3 (scan mode) and
 * Phase 4 (restock mode).
 *
 * Mode 'scan' (Phase 3, default):
 *   Three outcomes — 'matched' | 'prefill' | 'fallback' (see D-03/D-05/D-07/D-08).
 *
 * Mode 'restock' (Phase 4, D-12/D-14):
 *   Local-match-only. Two outcomes:
 *     1. 'matched' — code matches an existing item → caller shows RestockQuickSheet.
 *     2. restockNoMatch=true, scanState='idle' — code has no local match → caller
 *        shows "Item not found" toast and re-opens camera. NO OFF lookup, NO fallback.
 */
export function useBarcodeScanner({ items, mode = 'scan' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanState, setScanState] = useState('idle')
  const [matchedItem, setMatchedItem] = useState(null)
  const [prefillProduct, setPrefillProduct] = useState(null)
  const [fallbackBarcode, setFallbackBarcode] = useState(null)
  const [restockNoMatch, setRestockNoMatch] = useState(false)

  const openScanner = useCallback(() => {
    setScanState('idle')
    setMatchedItem(null)
    setPrefillProduct(null)
    setFallbackBarcode(null)
    setRestockNoMatch(false)
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
    setRestockNoMatch(false)
  }, [])

  const handleDetected = useCallback(async (rawValue) => {
    // 1. Close camera immediately
    setIsOpen(false)

    // 2. Local match check (no OFF lookup for known items)
    const existing = items.find((i) => i.barcode === rawValue)
    if (existing) {
      setMatchedItem(existing)
      setScanState('matched')
      return
    }

    // 3. Restock mode: D-14 — no OFF lookup, no fallback state
    if (mode === 'restock') {
      setRestockNoMatch(true)
      setScanState('idle')
      return
    }

    // 4. mode === 'scan' — original Phase 3 branch: OFF proxy lookup
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
  }, [items, mode])

  return {
    isOpen,
    openScanner,
    closeScanner,
    handleDetected,
    scanState,
    matchedItem,
    prefillProduct,
    fallbackBarcode,
    restockNoMatch,
    reset,
  }
}
