import { useEffect } from 'react'
import styles from './Toast.module.css'

/**
 * Toast — inline status toast with role=status + aria-live=polite.
 *
 * Props:
 *   message   string — the toast text (short, e.g. "Item not found")
 *   duration  number — ms before onDismiss fires (default 2000; pass null to disable)
 *   onDismiss () => void — called on timeout OR when actionLabel is clicked
 *   actionLabel string | undefined — optional action button label (e.g. "Undo")
 *   onAction  () => void | undefined — called when action clicked
 *
 * Position is controlled by parent (fixed, bottom center is the usual choice).
 */
export default function Toast({ message, duration = 2000, onDismiss, actionLabel, onAction }) {
  useEffect(() => {
    if (duration == null) return
    const id = setTimeout(() => {
      onDismiss?.()
    }, duration)
    return () => clearTimeout(id)
  }, [duration, onDismiss])

  return (
    <div role="status" aria-live="polite" className={styles.toast}>
      <span className={styles.message}>{message}</span>
      {actionLabel && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            onAction?.()
            onDismiss?.()
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
