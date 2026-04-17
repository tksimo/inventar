import { useEffect, useId } from 'react'
import QuantityControls from '../QuantityControls/QuantityControls.jsx'
import styles from './QuickUpdateSheet.module.css'

/**
 * QuickUpdateSheet — bottom sheet for existing-item barcode scan result
 * (D-03, D-04). Slides up from the bottom, shows name + location +
 * embedded QuantityControls, and has two actions: "Done" (save + dismiss)
 * and "Edit item" (open the full ItemDrawer).
 *
 * Props:
 *   item           Item — required; item.name, item.quantity_mode, item.quantity used
 *   locationName   string | null
 *   onIncrement    () => void        (forwarded to QuantityControls)
 *   onDecrement    () => void        (forwarded to QuantityControls)
 *   onDone         () => void        primary action
 *   onEditItem     () => void        secondary action — opens ItemDrawer
 *   onClose        () => void        backdrop click / Escape
 *
 * z-index 65 per UI-SPEC (above ItemDrawer at 60, below CameraOverlay at 70).
 */
export default function QuickUpdateSheet({
  item,
  locationName,
  onIncrement,
  onDecrement,
  onDone,
  onEditItem,
  onClose,
}) {
  const headingId = useId()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <div
        data-testid="quick-sheet-backdrop"
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.sheet}
      >
        <div className={styles.handle} aria-hidden="true" />
        <h2 id={headingId} className={styles.itemName}>{item.name}</h2>
        {locationName && (
          <p className={styles.location}>{locationName}</p>
        )}
        <div className={styles.qtyRow}>
          <QuantityControls
            item={item}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onCycle={() => {}}
          />
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.done} onClick={onDone}>
            Done
          </button>
          <button type="button" className={styles.editLink} onClick={onEditItem}>
            Edit item
          </button>
        </div>
      </div>
    </>
  )
}
