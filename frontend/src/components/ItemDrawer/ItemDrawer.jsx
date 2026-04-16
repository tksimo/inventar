import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { absoluteTime } from '../../lib/time.js'
import styles from './ItemDrawer.module.css'

/**
 * Build an initial form snapshot from an item (or null for add mode).
 * Used for dirty detection and form initialization.
 */
function toInitial(item) {
  if (!item) {
    return {
      name: '',
      categoryId: null,
      locationId: null,
      quantityMode: 'exact',
      quantity: null,
      status: 'have',
      reorderThreshold: null,
      notes: '',
    }
  }
  return {
    name: item.name ?? '',
    categoryId: item.category_id ?? null,
    locationId: item.location_id ?? null,
    quantityMode: item.quantity_mode ?? 'exact',
    quantity: item.quantity ?? null,
    status: item.status ?? 'have',
    reorderThreshold: item.reorder_threshold ?? null,
    notes: item.notes ?? '',
  }
}

/**
 * Build create payload — only include fields with meaningful values.
 * Always include name and quantity_mode.
 */
function buildCreatePayload(f) {
  const payload = {
    name: f.name.trim(),
    quantity_mode: f.quantityMode,
  }
  if (f.categoryId != null) payload.category_id = f.categoryId
  if (f.locationId != null) payload.location_id = f.locationId
  if (f.quantityMode === 'exact') {
    if (f.quantity != null) payload.quantity = f.quantity
    if (f.reorderThreshold != null) payload.reorder_threshold = f.reorderThreshold
  } else {
    payload.status = f.status
  }
  if (f.notes.trim()) payload.notes = f.notes.trim()
  return payload
}

/**
 * Build update patch — only fields that differ from initial snapshot.
 * Handle quantity_mode changes with special-casing per backend contract.
 */
function buildUpdatePatch(initial, current) {
  const patch = {}

  if (current.name !== initial.name) patch.name = current.name.trim()
  if (current.categoryId !== initial.categoryId) patch.category_id = current.categoryId
  if (current.locationId !== initial.locationId) patch.location_id = current.locationId
  if (current.notes !== initial.notes) patch.notes = current.notes

  if (current.quantityMode !== initial.quantityMode) {
    patch.quantity_mode = current.quantityMode
    if (current.quantityMode === 'exact') {
      patch.quantity = current.quantity
      patch.status = null
    } else {
      patch.status = current.status
      patch.quantity = null
      patch.reorder_threshold = null
    }
  } else {
    // Same mode — only include changed quantity fields
    if (current.quantityMode === 'exact') {
      if (current.quantity !== initial.quantity) patch.quantity = current.quantity
      if (current.reorderThreshold !== initial.reorderThreshold) patch.reorder_threshold = current.reorderThreshold
    } else {
      if (current.status !== initial.status) patch.status = current.status
    }
  }

  return patch
}

/**
 * ItemDrawer — slide-in drawer for add and edit item flows.
 *
 * Props:
 *   mode: 'add' | 'edit'
 *   item: Item | null (required in edit mode)
 *   categories: Category[]
 *   locations: Location[]
 *   onClose: () => void
 *   onCreate: (body) => Promise<Item>
 *   onUpdate: (id, patch) => Promise<Item>
 *   onDelete: (id) => Promise<void>
 */
export default function ItemDrawer({
  mode,
  item,
  categories,
  locations,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const nameRef = useRef(null)
  const initialRef = useRef(toInitial(mode === 'edit' ? item : null))

  const [form, setForm] = useState(() => toInitial(mode === 'edit' ? item : null))
  const [validation, setValidation] = useState({ name: null })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Slide-in animation — flip mounted after first paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Focus name input on mount
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Dirty detection — memoised comparison against initial snapshot
  const isDirty = useMemo(() => {
    const init = initialRef.current
    return (
      form.name !== init.name ||
      form.categoryId !== init.categoryId ||
      form.locationId !== init.locationId ||
      form.quantityMode !== init.quantityMode ||
      form.quantity !== init.quantity ||
      form.status !== init.status ||
      form.reorderThreshold !== init.reorderThreshold ||
      form.notes !== init.notes
    )
  }, [form])

  // Request close with dirty check
  const requestClose = () => {
    if (isDirty && !window.confirm('Discard changes?')) return
    onClose()
  }

  // Focus trap + Escape key handler
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      requestClose()
      return
    }
    if (e.key === 'Tab') {
      const focusable = rootRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  // Category select change — handles __manage navigation
  const handleCategoryChange = (value) => {
    if (value === '__manage') {
      if (isDirty && !window.confirm('Discard changes?')) return
      onClose()
      navigate('/settings')
      return
    }
    setForm((f) => ({ ...f, categoryId: value === '' ? null : Number(value) }))
  }

  // Location select change — handles __manage navigation
  const handleLocationChange = (value) => {
    if (value === '__manage') {
      if (isDirty && !window.confirm('Discard changes?')) return
      onClose()
      navigate('/settings')
      return
    }
    setForm((f) => ({ ...f, locationId: value === '' ? null : Number(value) }))
  }

  // Save handler
  const handleSave = async () => {
    // Validate name
    if (!form.name.trim()) {
      setValidation({ name: 'Name is required' })
      return
    }
    setValidation({ name: null })
    setSaveError(null)
    setSaving(true)
    try {
      if (mode === 'add') {
        const payload = buildCreatePayload(form)
        await onCreate(payload)
      } else {
        const patch = buildUpdatePatch(initialRef.current, form)
        if (Object.keys(patch).length > 0) {
          await onUpdate(item.id, patch)
        }
      }
      onClose()
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Delete confirm handler
  const handleConfirmDelete = async () => {
    setSaveError(null)
    setDeleting(true)
    try {
      await onDelete(item.id)
      onClose()
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={rootRef}
        className={`${styles.drawer}${mounted ? ` ${styles.open}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <h2 id="drawer-title" className={styles.title}>
            {mode === 'add' ? 'Add Item' : 'Edit Item'}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close drawer"
            onClick={requestClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          {/* Name */}
          <div className={styles.field}>
            <label htmlFor="item-name" className={styles.label}>
              Name
            </label>
            <input
              id="item-name"
              ref={nameRef}
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              aria-required="true"
            />
            {validation.name && (
              <p role="alert" className={styles.validation}>
                {validation.name}
              </p>
            )}
          </div>

          {/* Category */}
          <div className={styles.field}>
            <label htmlFor="item-category" className={styles.label}>
              Category
            </label>
            <select
              id="item-category"
              className={styles.select}
              value={form.categoryId ?? ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__manage">Manage categories →</option>
            </select>
          </div>

          {/* Location */}
          <div className={styles.field}>
            <label htmlFor="item-location" className={styles.label}>
              Location
            </label>
            <select
              id="item-location"
              className={styles.select}
              value={form.locationId ?? ''}
              onChange={(e) => handleLocationChange(e.target.value)}
            >
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="__manage">Manage locations →</option>
            </select>
          </div>

          {/* Quantity mode segmented control */}
          <div className={styles.field}>
            <span className={styles.label}>Quantity mode</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Quantity mode">
              <button
                type="button"
                role="radio"
                aria-checked={form.quantityMode === 'exact'}
                className={`${styles.seg}${form.quantityMode === 'exact' ? ` ${styles.segActive}` : ''}`}
                onClick={() => setForm((f) => ({ ...f, quantityMode: 'exact' }))}
              >
                Exact count
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.quantityMode === 'status'}
                className={`${styles.seg}${form.quantityMode === 'status' ? ` ${styles.segActive}` : ''}`}
                onClick={() => setForm((f) => ({ ...f, quantityMode: 'status' }))}
              >
                Status
              </button>
            </div>
          </div>

          {/* Exact mode fields */}
          {form.quantityMode === 'exact' && (
            <>
              <div className={styles.field}>
                <label htmlFor="item-quantity" className={styles.label}>
                  Quantity
                </label>
                <input
                  id="item-quantity"
                  type="number"
                  step="0.1"
                  min="0"
                  className={styles.input}
                  value={form.quantity ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quantity: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="item-threshold" className={styles.label}>
                  Reorder threshold
                </label>
                <input
                  id="item-threshold"
                  type="number"
                  step="0.1"
                  min="0"
                  className={styles.input}
                  value={form.reorderThreshold ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reorderThreshold: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </>
          )}

          {/* Status mode fields */}
          {form.quantityMode === 'status' && (
            <div className={styles.field}>
              <span className={styles.label}>Status</span>
              <div className={styles.segmented} role="radiogroup" aria-label="Stock status">
                {['have', 'low', 'out'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={form.status === s}
                    className={`${styles.seg}${form.status === s ? ` ${styles.segActive}` : ''}`}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className={styles.field}>
            <label htmlFor="item-notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="item-notes"
              className={styles.textarea}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Attribution (edit mode only) */}
          {mode === 'edit' && item?.last_updated_by_name && (
            <div className={styles.attribution}>
              Last modified by {item.last_updated_by_name} on {absoluteTime(item.updated_at)}
            </div>
          )}
        </div>

        {/* Save error */}
        {saveError && (
          <p role="alert" className={styles.saveError}>
            {saveError}
          </p>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          {!deleteConfirming && (
            <>
              <button
                type="button"
                className={styles.save}
                disabled={saving}
                onClick={handleSave}
              >
                Save Item
              </button>
              {mode === 'edit' && (
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => setDeleteConfirming(true)}
                >
                  Delete
                </button>
              )}
            </>
          )}
          {deleteConfirming && mode === 'edit' && item && (
            <>
              <span className={styles.confirmText}>Delete {item.name}?</span>
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
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
