import { useEffect, useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import styles from './RestockQuickSheet.module.css'

/**
 * RestockQuickSheet — bottom sheet shown when a restock scan matches an existing
 * item. Collects a delta quantity ("How many did you add?"), fires a single
 * onAddToStock(delta) on confirm. Mirrors QuickUpdateSheet visuals (z-index 65,
 * slide-up, sheet surface) but differs in interaction model: QuickUpdateSheet
 * mutates in place via ± that fires on every tap; this component buffers delta
 * locally and fires ONE mutation on Done (D-13).
 *
 * Props:
 *   item            Item — required (name shown in heading)
 *   onAddToStock    (delta: number) => void | Promise<void> — primary action
 *   onClose         () => void — Escape / backdrop / after successful save
 *   saving          boolean — disables stepper + button, shows "Saving…"
 *   error           string | null — renders inline error above the footer
 */
export default function RestockQuickSheet({ item, onAddToStock, onClose, saving = false, error = null }) {
  const headingId = useId()
  const [value, setValue] = useState(1)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, saving])

  const dec = () => setValue((v) => Math.max(1, v - 1))
  const inc = () => setValue((v) => v + 1)

  return (
    <>
      <div
        data-testid="restock-sheet-backdrop"
        className={styles.backdrop}
        onClick={() => { if (!saving) onClose() }}
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
        <p className={styles.promptLabel}>Quantity added</p>
        <div className={styles.stepperRow}>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label="Decrease quantity"
            onClick={dec}
            disabled={saving || value <= 1}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <span className={styles.value} aria-live="polite">{value}</span>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label="Increase quantity"
            onClick={inc}
            disabled={saving}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onAddToStock(value)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Add to stock'}
          </button>
        </div>
      </div>
    </>
  )
}
