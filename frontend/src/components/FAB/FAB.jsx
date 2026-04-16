import { Plus } from 'lucide-react'
import styles from './FAB.module.css'

export default function FAB({ onClick, label = 'Add item' }) {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={label}
    >
      <Plus size={24} aria-hidden="true" />
    </button>
  )
}
