import { useEffect, useRef } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { X } from 'lucide-react'
import styles from './CameraOverlay.module.css'

/**
 * CameraOverlay — full-screen camera viewfinder dialog hosting the
 * @yudiel/react-qr-scanner Scanner. Fires onDetected exactly once per mount;
 * subsequent scans are ignored to avoid double-dispatch between the library
 * firing repeatedly and the parent unmounting the overlay.
 *
 * Props:
 *   onDetected: (rawValue: string) => void
 *   onClose: () => void
 *
 * Escape and the top-right X button both invoke onClose.
 * The overlay is z-index 70 (UI-SPEC) — above ItemDrawer (60) and
 * QuickUpdateSheet (65).
 */
export default function CameraOverlay({ onDetected, onClose }) {
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
      aria-label="Barcode scanner"
      className={styles.overlay}
    >
      <div className={styles.scannerWrap}>
        <Scanner
          constraints={{ facingMode: 'environment' }}
          onScan={handleScan}
          onError={(err) => console.warn('Scanner error:', err)}
        />
        <div className={styles.reticle} aria-hidden="true" />
      </div>
      <p className={styles.status}>Point camera at a barcode</p>
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
