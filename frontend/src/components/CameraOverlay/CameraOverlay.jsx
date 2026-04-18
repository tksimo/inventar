import { useEffect, useRef } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { X } from 'lucide-react'
import styles from './CameraOverlay.module.css'

/**
 * CameraOverlay — full-screen camera viewfinder dialog. Fires onDetected exactly
 * once per mount (dispatchedRef guard).
 *
 * Props:
 *   onDetected: (rawValue: string) => void
 *   onClose:    () => void
 *   ariaLabel?: string — overrides default "Barcode scanner" (e.g. "Restock scanner")
 *   children?:  ReactNode — rendered below the status text (e.g. "Done restocking" button)
 *
 * Escape and the X button both invoke onClose.
 * z-index 70 (UI-SPEC) — above ItemDrawer (60) and QuickUpdateSheet (65).
 */
export default function CameraOverlay({ onDetected, onClose, ariaLabel, children }) {
  const dispatchedRef = useRef(false)

  const handleScan = (results) => {
    if (!results || results.length === 0) return
    if (dispatchedRef.current) return
    dispatchedRef.current = true
    onDetected(results[0].rawValue)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? 'Barcode scanner'}
      className={styles.overlay}
    >
      <div className={styles.scannerWrap}>
        <Scanner
          constraints={{ facingMode: 'environment' }}
          onScan={handleScan}
          onError={() => {}}
        />
        <div className={styles.reticle} aria-hidden="true" />
      </div>
      <p className={styles.status}>Point camera at a barcode</p>
      {children}
      <button
        type="button"
        className={styles.close}
        aria-label="Close camera"
        onClick={onClose}
      >
        <X size={24} aria-hidden="true" />
      </button>
    </div>
  )
}
