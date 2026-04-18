import { useState, useEffect, useMemo } from 'react'
import { Share2, ShoppingCart } from 'lucide-react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { useShoppingList } from '../hooks/useShoppingList.js'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner.js'
import ShoppingListRow from '../components/ShoppingListRow/ShoppingListRow.jsx'
import CheckOffSheet from '../components/CheckOffSheet/CheckOffSheet.jsx'
import CameraOverlay from '../components/CameraOverlay/CameraOverlay.jsx'
import RestockQuickSheet from '../components/RestockQuickSheet/RestockQuickSheet.jsx'
import Toast from '../components/Toast/Toast.jsx'
import EmptyState from '../components/EmptyState/EmptyState.jsx'
import FAB from '../components/FAB/FAB.jsx'
import { shareText, formatShoppingList } from '../lib/share.js'
import styles from './ShoppingList.module.css'

/**
 * ShoppingList page — full implementation replacing the Phase 1 stub.
 *
 * Covers: SHOP-01 (list), SHOP-02 (manual add), SHOP-03 (check-off),
 *         SHOP-05 (share). Nav badge (SHOP-04) is driven by AppLayout.
 *         RSTO-01/02/03: restock scan loop via "Start restocking" button.
 */
export default function ShoppingList({ itemsApi }) {
  const shoppingList = useShoppingList()
  const { entries, loading, error, addManual, removeEntry, reorder, checkOff } = shoppingList

  const [checkingOff, setCheckingOff] = useState(null) // entry being checked off
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [undoEntry, setUndoEntry] = useState(null)
  const [copiedToastVisible, setCopiedToastVisible] = useState(false)

  // Restock mode state
  const [restockMode, setRestockMode] = useState(false)
  const [restockSaving, setRestockSaving] = useState(false)
  const [restockSaveError, setRestockSaveError] = useState(null)

  const restockScanner = useBarcodeScanner({
    items: itemsApi?.items ?? [],
    mode: 'restock',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  // Persisted rows are sortable; auto rows (id==null) render after as a fixed tail.
  const persistedEntries = useMemo(() => entries.filter((e) => e.id != null), [entries])
  const autoEntries = useMemo(() => entries.filter((e) => e.id == null), [entries])
  const sortableIds = persistedEntries.map((e) => String(e.id))

  // Undo toast auto-dismiss
  useEffect(() => {
    if (!undoEntry) return
    const t = setTimeout(() => setUndoEntry(null), 3000)
    return () => clearTimeout(t)
  }, [undoEntry])

  // Copied toast auto-dismiss
  useEffect(() => {
    if (!copiedToastVisible) return
    const t = setTimeout(() => setCopiedToastVisible(false), 2000)
    return () => clearTimeout(t)
  }, [copiedToastVisible])

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortableIds.indexOf(String(active.id))
    const newIndex = sortableIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const newOrderIds = arrayMove(sortableIds, oldIndex, newIndex).map((id) => Number(id))
    await reorder(newOrderIds)
  }

  const handleShare = async () => {
    const text = formatShoppingList(entries)
    try {
      const res = await shareText({ title: 'Einkaufsliste', text })
      if (res.method === 'clipboard') setCopiedToastVisible(true)
    } catch {
      // Clipboard unavailable — no-op
    }
  }

  const handleRemove = async (entry) => {
    const res = await removeEntry(entry.id)
    if (res.ok) setUndoEntry(entry)
  }

  const handleUndo = async () => {
    if (!undoEntry) return
    await addManual(undoEntry.item_id)
    setUndoEntry(null)
  }

  const handlePickerAdd = async (itemId) => {
    await addManual(itemId)
    setPickerOpen(false)
    setPickerSearch('')
  }

  // Restock handlers
  const onStartRestock = () => {
    setRestockMode(true)
    setRestockSaveError(null)
    restockScanner.openScanner()
  }

  const exitRestock = () => {
    setRestockMode(false)
    setRestockSaveError(null)
    restockScanner.reset()
    restockScanner.closeScanner()
  }

  const onAddToStock = async (delta) => {
    const matched = restockScanner.matchedItem
    if (!matched) return
    setRestockSaving(true)
    setRestockSaveError(null)
    try {
      await itemsApi.updateQuantity(matched.id, delta)
      const entry = entries.find((e) => e.item_id === matched.id)
      if (entry && entry.id != null) {
        await checkOff(entry.id, delta)
      }
      setRestockSaving(false)
      restockScanner.reset()
      restockScanner.openScanner() // re-arm for next scan
    } catch {
      setRestockSaving(false)
      setRestockSaveError("Couldn't save. Try again.")
    }
  }

  // Items eligible for manual add = non-archived items not already on the list
  const existingItemIds = new Set(entries.map((e) => e.item_id))
  const pickerItems = (itemsApi?.items ?? [])
    .filter((it) => !it.archived && !existingItemIds.has(it.id))
    .filter((it) => !pickerSearch.trim() ||
      it.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Shopping List</h1>
        <button
          type="button"
          className={styles.shareBtn}
          aria-label="Share shopping list"
          onClick={handleShare}
        >
          <Share2 size={20} aria-hidden="true" />
        </button>
      </header>

      <main className={styles.body}>
        {loading && entries.length === 0 && <p className={styles.loading}>Loading…</p>}
        {error && <p role="alert" className={styles.error}>Couldn&apos;t load shopping list. Check your connection and try again.</p>}

        {!loading && entries.length === 0 && !error && (
          <EmptyState
            icon={<ShoppingCart size={48} />}
            heading="Nothing to buy"
            body="All stocked up! Items will appear here when stock runs low."
          />
        )}

        {entries.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ul className={styles.list}>
                {persistedEntries.map((e) => (
                  <ShoppingListRow
                    key={e.id}
                    entry={e}
                    onCheck={setCheckingOff}
                    onRemove={handleRemove}
                    draggable
                  />
                ))}
              </ul>
            </SortableContext>
            {autoEntries.length > 0 && (
              <ul className={styles.list}>
                {autoEntries.map((e) => (
                  <ShoppingListRow
                    key={`auto-${e.item_id}`}
                    entry={e}
                    onCheck={setCheckingOff}
                    onRemove={() => {}}
                    draggable={false}
                  />
                ))}
              </ul>
            )}
          </DndContext>
        )}

        {!restockMode && (
          <button
            type="button"
            className={styles.restockBtn}
            aria-label="Start restocking mode"
            onClick={onStartRestock}
          >
            Start restocking
          </button>
        )}
      </main>

      <FAB onClick={() => setPickerOpen(true)} label="Add item to shopping list" />

      {checkingOff && (
        <CheckOffSheet
          entry={checkingOff}
          onConfirm={async (q) => {
            await checkOff(checkingOff.id, q)
            setCheckingOff(null)
          }}
          onDismiss={() => setCheckingOff(null)}
        />
      )}

      {pickerOpen && (
        <>
          <div className={styles.pickerBackdrop} onClick={() => setPickerOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="picker-title" className={styles.picker}>
            <h2 id="picker-title" className={styles.pickerTitle}>Add item to shopping list</h2>
            <input
              type="search"
              placeholder="Search items…"
              aria-label="Search items"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className={styles.pickerSearch}
            />
            <ul className={styles.pickerList}>
              {pickerItems.length === 0 && (
                <li className={styles.pickerEmpty}>No items to add.</li>
              )}
              {pickerItems.map((it) => (
                <li key={it.id}>
                  <button type="button" className={styles.pickerItem} onClick={() => handlePickerAdd(it.id)}>
                    {it.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.pickerCancel} onClick={() => setPickerOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {undoEntry && (
        <div role="status" aria-live="polite" className={styles.undoToast}>
          <span>Removed from list.</span>
          <button
            type="button"
            className={styles.undoBtn}
            aria-label={`Undo remove ${undoEntry.item_name}`}
            onClick={handleUndo}
          >
            Undo
          </button>
        </div>
      )}

      {copiedToastVisible && (
        <div role="status" aria-live="polite" className={styles.copiedToast}>Copied!</div>
      )}

      {/* Restock mode overlays */}
      {restockMode && !restockScanner.matchedItem && (
        <CameraOverlay
          ariaLabel="Restock scanner"
          onDetected={restockScanner.handleDetected}
          onClose={exitRestock}
        >
          <button
            type="button"
            className={styles.doneRestocking}
            onClick={exitRestock}
          >
            Done restocking
          </button>
        </CameraOverlay>
      )}

      {restockMode && restockScanner.matchedItem && (
        <RestockQuickSheet
          item={restockScanner.matchedItem}
          saving={restockSaving}
          error={restockSaveError}
          onAddToStock={onAddToStock}
          onClose={() => {
            restockScanner.reset()
            restockScanner.openScanner()
          }}
        />
      )}

      {restockMode && restockScanner.restockNoMatch && (
        <Toast
          message="Item not found"
          onDismiss={() => {
            restockScanner.reset()
            restockScanner.openScanner()
          }}
        />
      )}
    </div>
  )
}
