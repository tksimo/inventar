import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import styles from './RecipeForm.module.css'

function emptyIngredient() {
  return { id: null, name: '', quantity: '', unit: '', item_id: null }
}

function toInitialState(recipe) {
  if (!recipe) {
    return {
      name: '',
      instructions: '',
      sourceUrl: '',
      ingredients: [],
    }
  }
  return {
    name: recipe.name ?? '',
    instructions: recipe.instructions ?? '',
    sourceUrl: recipe.source_url ?? '',
    ingredients: (recipe.ingredients ?? []).map((ing) => ({
      id: ing.id ?? null,
      name: ing.name ?? '',
      quantity: ing.quantity != null ? String(ing.quantity) : '',
      unit: ing.unit ?? '',
      item_id: ing.item_id ?? null,
    })),
  }
}

/**
 * RecipeForm — slide-in drawer for add/edit recipe.
 *
 * Props:
 *   mode           'add' | 'edit'
 *   initialRecipe  RecipeResponse | null
 *   onClose        () => void
 *   onSave         (body) => Promise<{ ok, recipe? }>
 *   onDelete       (id) => Promise<{ ok }> — only used in edit mode
 */
export default function RecipeForm({ mode, initialRecipe, onClose, onSave, onDelete }) {
  const initial = useMemo(() => toInitialState(initialRecipe), [initialRecipe])
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const nameRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => { nameRef.current?.focus() }, [])

  const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }

  const setIngredient = (idx, patch) => {
    setForm((f) => {
      const next = f.ingredients.slice()
      next[idx] = { ...next[idx], ...patch }
      return { ...f, ingredients: next }
    })
  }

  const addIngredient = () => {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, emptyIngredient()] }))
  }
  const removeIngredient = (idx) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))
  }

  const canSave = form.name.trim().length > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaveError(null)
    setSaving(true)
    const body = {
      name: form.name.trim(),
      instructions: form.instructions.trim() || null,
      source_url: form.sourceUrl.trim() || null,
      ingredients: form.ingredients
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity === '' ? null : Number(i.quantity),
          unit: i.unit.trim() || null,
          item_id: i.item_id ?? null,
        })),
    }
    try {
      const res = await onSave(body)
      if (res && res.ok) { onClose(); return }
      setSaveError("Couldn't save. Try again.")
    } catch {
      setSaveError("Couldn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!initialRecipe || !onDelete) return
    setDeleting(true)
    setSaveError(null)
    const res = await onDelete(initialRecipe.id)
    setDeleting(false)
    if (res && res.ok) { onClose() }
    else { setSaveError("Couldn't delete. Try again.") }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={rootRef}
        className={`${styles.drawer}${mounted ? ` ${styles.open}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-form-title"
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <h2 id="recipe-form-title" className={styles.title}>
            {mode === 'add' ? 'New Recipe' : 'Edit Recipe'}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close drawer"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="recipe-name" className={styles.label}>Name</label>
            <input
              id="recipe-name"
              ref={nameRef}
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              aria-required="true"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="recipe-instructions" className={styles.label}>Instructions</label>
            <textarea
              id="recipe-instructions"
              className={styles.textarea}
              rows={4}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </div>
          {form.sourceUrl && (
            <div className={styles.field}>
              <label className={styles.label}>Source URL</label>
              <div className={styles.sourceUrl}>{form.sourceUrl}</div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Ingredients</span>
            <ul className={styles.ingredientList}>
              {form.ingredients.map((ing, idx) => (
                <li key={idx} className={styles.ingredientRow}>
                  <input
                    className={styles.ingName}
                    placeholder="Ingredient name"
                    aria-label={`Ingredient ${idx + 1} name`}
                    value={ing.name}
                    onChange={(e) => setIngredient(idx, { name: e.target.value })}
                  />
                  <input
                    className={styles.ingQty}
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Ingredient ${idx + 1} quantity`}
                    value={ing.quantity}
                    onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
                  />
                  <input
                    className={styles.ingUnit}
                    placeholder="g"
                    aria-label={`Ingredient ${idx + 1} unit`}
                    value={ing.unit}
                    onChange={(e) => setIngredient(idx, { unit: e.target.value })}
                  />
                  <button
                    type="button"
                    className={styles.ingRemove}
                    aria-label={`Remove ${ing.name || 'ingredient'}`}
                    onClick={() => removeIngredient(idx)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.addIngredient}
              aria-label="Add ingredient to recipe"
              onClick={addIngredient}
            >
              <Plus size={16} aria-hidden="true" /> Add ingredient
            </button>
          </div>
        </div>

        {saveError && <p role="alert" className={styles.saveError}>{saveError}</p>}

        <div className={styles.footer}>
          {!deleteConfirming && (
            <>
              <button
                type="button"
                className={styles.save}
                disabled={!canSave}
                onClick={handleSave}
              >
                {saving ? 'Saving\u2026' : 'Save recipe'}
              </button>
              {mode === 'edit' && onDelete && (
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => setDeleteConfirming(true)}
                >
                  Delete recipe
                </button>
              )}
            </>
          )}
          {deleteConfirming && (
            <>
              <span className={styles.confirmText}>Delete this recipe?</span>
              <button
                type="button"
                className={styles.confirmYes}
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                Yes, delete
              </button>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setDeleteConfirming(false)}
              >
                Keep recipe
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
