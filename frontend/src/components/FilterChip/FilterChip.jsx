import styles from './FilterChip.module.css'

/**
 * FilterChip — dismissible filter chip per UI-SPEC §FilterChip (D-05).
 *
 * Props:
 *   label     — string, the chip label
 *   active    — boolean (default false), controls visual state
 *   onClick   — function, called when chip body is clicked
 *   onDismiss — function, called when dismiss × is clicked (active state only)
 *   icon      — optional React node, rendered left of label (inactive only)
 */
export default function FilterChip({ label, active = false, onClick, onDismiss, icon }) {
  const className = active ? styles.chipActive : styles.chipInactive

  return (
    <button type="button" className={className} onClick={onClick}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{label}</span>
      {active && (
        <span
          role="button"
          aria-label={`Remove filter: ${label}`}
          className={styles.dismiss}
          onClick={(e) => { e.stopPropagation(); onDismiss?.() }}
        >
          ×
        </span>
      )}
    </button>
  )
}
