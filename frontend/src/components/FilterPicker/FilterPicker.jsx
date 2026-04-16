import { X } from 'lucide-react'
import FilterChip from '../FilterChip/FilterChip.jsx'
import styles from './FilterPicker.module.css'

export default function FilterPicker({
  categories,
  locations,
  activeCategoryIds,
  activeLocationIds,
  onToggleCategory,
  onToggleLocation,
  onClose,
}) {
  return (
    <div className={styles.panel} role="dialog" aria-label="Filter picker" aria-modal="false">
      <button
        type="button"
        className={styles.close}
        aria-label="Close filter picker"
        onClick={onClose}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Categories</div>
        <div className={styles.chips}>
          {categories.map((c) => (
            <FilterChip
              key={`c${c.id}`}
              label={c.name}
              active={activeCategoryIds.includes(c.id)}
              onClick={() => onToggleCategory(c.id)}
            />
          ))}
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Locations</div>
        <div className={styles.chips}>
          {locations.map((l) => (
            <FilterChip
              key={`l${l.id}`}
              label={l.name}
              active={activeLocationIds.includes(l.id)}
              onClick={() => onToggleLocation(l.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
