import { useEffect, useId } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import styles from './RecipeCheckSheet.module.css'

const STATUS_META = {
  have:    { Icon: CheckCircle2,   color: 'var(--color-status-have)', aria: 'Have enough' },
  low:     { Icon: AlertTriangle,  color: 'var(--color-status-low)',  aria: 'Low or insufficient' },
  missing: { Icon: XCircle,        color: 'var(--color-status-out)',  aria: 'Missing' },
}

/**
 * RecipeCheckSheet — bottom sheet listing each recipe ingredient's availability.
 * RECP-03 (D-08, D-09) + entry point for RECP-04 (D-10 "Add missing to list").
 *
 * Props:
 *   recipeName   string
 *   checkData    IngredientCheckResponse | null
 *   loading      bool
 *   adding       bool  — "Add missing" button shows "Adding…" when true
 *   addError     string | null  — shown above footer when present
 *   onAddMissing () => void  — parent performs the API call
 *   onClose      () => void
 */
export default function RecipeCheckSheet({
  recipeName,
  checkData,
  loading,
  adding,
  addError,
  onAddMissing,
  onClose,
}) {
  const headingId = useId()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const missingCount = checkData?.missing_count ?? 0
  const canAdd = !loading && !adding && missingCount > 0

  return (
    <>
      <div
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
        <h2 id={headingId} className={styles.heading}>{recipeName}</h2>

        <div className={styles.body}>
          {loading && !checkData && (
            <p className={styles.loading}>Checking inventory…</p>
          )}
          {checkData && (
            <ul className={styles.list}>
              {checkData.ingredients.map((ing) => {
                const meta = STATUS_META[ing.status] ?? STATUS_META.missing
                const IconComp = meta.Icon
                const qtyLabel = ing.quantity != null
                  ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}`
                  : ''
                return (
                  <li key={ing.ingredient_id} className={styles.row}>
                    <div className={styles.rowTop}>
                      <IconComp
                        size={20}
                        color={meta.color}
                        aria-label={meta.aria}
                      />
                      <span className={styles.name}>{ing.name}</span>
                      <span className={styles.qty}>{qtyLabel}</span>
                    </div>
                    {ing.unit_mismatch && (
                      <p className={styles.mismatch}>Units differ — check manually</p>
                    )}
                  </li>
                )
              })}
              {checkData.ingredients.length === 0 && (
                <li className={styles.empty}>No ingredients to check.</li>
              )}
            </ul>
          )}
        </div>

        {addError && <p role="alert" className={styles.addError}>{addError}</p>}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={onAddMissing}
            disabled={!canAdd}
            aria-disabled={!canAdd ? 'true' : 'false'}
            aria-label={
              missingCount === 0
                ? 'All ingredients available — nothing to add'
                : 'Add missing to list'
            }
          >
            {adding ? 'Adding…' : 'Add missing to list'}
          </button>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
