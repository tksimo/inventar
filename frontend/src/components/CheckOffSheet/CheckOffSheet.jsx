import { useEffect, useState, useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import styles from './CheckOffSheet.module.css'

/**
 * CheckOffSheet — bottom sheet quantity prompt on check-off (SHOP-03, D-07).
 *
 * Props:
 *   entry:     ShoppingListEntryResponse (item_name used in heading)
 *   onConfirm: (quantity_added: number) => void
 *   onDismiss: () => void  (Keep on list, backdrop, Escape)
 *
 * z-index 65 per UI-SPEC (matches QuickUpdateSheet). Reuses same slide-up
 * animation pattern.
 */
export default function CheckOffSheet({ entry, onConfirm, onDismiss }) {
  const headingId = useId()
  const [value, setValue] = useState(1)

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  return (
    <>
      <div
        data-testid="checkoff-backdrop"
        className={styles.backdrop}
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.sheet}
      >
        <div className={styles.handle} aria-hidden="true" />
        <h2 id={headingId} className={styles.itemName}>{entry.item_name}</h2>
        <p className={styles.prompt}>How many did you buy?</p>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            aria-label="Decrease quantity"
            disabled={value <= 1}
            onClick={() => setValue((v) => Math.max(1, v - 1))}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <span className={styles.value} aria-live="polite">{value}</span>
          <button
            type="button"
            className={styles.step}
            aria-label="Increase quantity"
            onClick={() => setValue((v) => v + 1)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.confirm}
            onClick={() => onConfirm(value)}
          >
            Add to stock
          </button>
          <button
            type="button"
            className={styles.dismiss}
            onClick={onDismiss}
          >
            Keep on list
          </button>
        </div>
      </div>
    </>
  )
}
