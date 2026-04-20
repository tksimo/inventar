import { useEffect, useId, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import styles from './CookConfirmSheet.module.css'

function initialAmount(ingredient) {
  // D-12: matching units → pre-fill recipe quantity; mismatched/null → 1.
  if (ingredient.unit_mismatch) return 1
  if (ingredient.quantity == null) return 1
  return Number(ingredient.quantity)
}

/**
 * CookConfirmSheet — bottom sheet for cook-and-deduct confirmation.
 * RECP-05 (D-11, D-12, D-13, D-14).
 *
 * Props:
 *   recipeName   string
 *   checkData    IngredientCheckResponse
 *   saving       bool
 *   saveError    string | null
 *   onConfirm    (deductions: Array<{ingredient_id, item_id, amount}>) => void
 *   onClose      () => void
 */
export default function CookConfirmSheet({
  recipeName,
  checkData,
  saving,
  saveError,
  onConfirm,
  onClose,
}) {
  const headingId = useId()
  const ingredients = checkData?.ingredients ?? []

  // Partition into matched vs skipped (D-13)
  const { matched, skipped } = useMemo(() => {
    const m = []
    const s = []
    for (const ing of ingredients) {
      if (ing.item_id != null && ing.matched_item_name) m.push(ing)
      else s.push(ing)
    }
    return { matched: m, skipped: s }
  }, [ingredients])

  const [amounts, setAmounts] = useState(() => {
    const init = {}
    for (const ing of matched) init[ing.ingredient_id] = initialAmount(ing)
    return init
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setAmount = (id, next) => {
    setAmounts((prev) => ({ ...prev, [id]: Math.max(0, next) }))
  }

  const canCook = !saving && matched.length > 0

  const handleConfirm = () => {
    if (!canCook) return
    const deductions = matched
      .map((ing) => ({
        ingredient_id: ing.ingredient_id,
        item_id: ing.item_id,
        amount: Number(amounts[ing.ingredient_id] ?? 0),
      }))
      .filter((d) => d.amount > 0)
    onConfirm(deductions)
  }

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
        <h2 id={headingId} className={styles.heading}>{`Cook ${recipeName}?`}</h2>

        <div className={styles.body}>
          <ul className={styles.list}>
            {matched.map((ing) => {
              const amt = Number(amounts[ing.ingredient_id] ?? 0)
              return (
                <li key={ing.ingredient_id} className={styles.matchedRow}>
                  <span className={styles.name}>{ing.name}</span>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label={`Decrease quantity for ${ing.name}`}
                      disabled={amt <= 0 || saving}
                      onClick={() => setAmount(ing.ingredient_id, amt - 1)}
                    >
                      <Minus size={20} aria-hidden="true" />
                    </button>
                    <span
                      className={styles.value}
                      aria-live="polite"
                      aria-valuemin={0}
                      aria-valuenow={amt}
                      role="spinbutton"
                    >
                      {amt}
                    </span>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label={`Increase quantity for ${ing.name}`}
                      disabled={saving}
                      onClick={() => setAmount(ing.ingredient_id, amt + 1)}
                    >
                      <Plus size={20} aria-hidden="true" />
                    </button>
                  </div>
                  {ing.unit && <span className={styles.unit}>{ing.unit}</span>}
                </li>
              )
            })}
            {skipped.map((ing) => (
              <li
                key={`skip-${ing.ingredient_id}`}
                className={styles.skippedRow}
                aria-label={`${ing.name} — not in inventory, will be skipped`}
              >
                <span className={styles.skippedName}>{ing.name}</span>
                <span className={styles.skippedNote}>not in inventory — skipped</span>
              </li>
            ))}
            {matched.length === 0 && skipped.length === 0 && (
              <li className={styles.empty}>No ingredients to deduct.</li>
            )}
          </ul>
        </div>

        {saveError && <p role="alert" className={styles.saveError}>{saveError}</p>}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cook}
            disabled={!canCook}
            onClick={handleConfirm}
          >
            {saving ? 'Cooking\u2026' : 'Cook & deduct'}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
