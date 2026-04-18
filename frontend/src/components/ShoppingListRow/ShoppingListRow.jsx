import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import styles from './ShoppingListRow.module.css'

function subLabel(entry) {
  if (entry.quantity_mode === 'exact' && entry.quantity != null) {
    return `${entry.quantity} left`
  }
  if (entry.quantity_mode === 'status' && entry.status) {
    const s = entry.status
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return null
}

export default function ShoppingListRow({ entry, onCheck, onRemove, draggable = true }) {
  const sortableId = entry.id != null ? String(entry.id) : `auto-${entry.item_id}`
  const sortable = useSortable({ id: sortableId, disabled: !draggable })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const label = subLabel(entry)

  return (
    <li ref={setNodeRef} style={style} className={styles.row} data-testid={`shopping-row-${sortableId}`}>
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Reorder ${entry.item_name}`}
        disabled={!draggable}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={entry.item_name}
        className={styles.checkbox}
        onClick={() => onCheck(entry)}
      />

      <div className={styles.content}>
        <span className={styles.name}>{entry.item_name}</span>
        {label && <span className={styles.subLabel}>{label}</span>}
      </div>

      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove ${entry.item_name} from shopping list`}
        onClick={() => onRemove(entry)}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  )
}
