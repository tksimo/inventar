import styles from './QuantityControls.module.css'

function formatCount(q) {
  if (q == null) return '0'
  const n = Number(q)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export default function QuantityControls({ item, onIncrement, onDecrement, onCycle, errored = false }) {
  const containerCls = errored ? `${styles.container} ${styles.errored}` : styles.container

  if (item.quantity_mode === 'exact') {
    return (
      <div className={containerCls}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Decrease quantity for ${item.name}`}
          onClick={onDecrement}
        >
          −
        </button>
        <span className={styles.count} aria-live="polite">{formatCount(item.quantity)}</span>
        <button
          type="button"
          className={styles.step}
          aria-label={`Increase quantity for ${item.name}`}
          onClick={onIncrement}
        >
          +
        </button>
      </div>
    )
  }

  // status mode
  const status = item.status ?? 'have'
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <div className={containerCls}>
      <button
        type="button"
        className={`${styles.pill} ${styles['pill_' + status]}`}
        aria-label={`Stock status for ${item.name}: ${label}`}
        onClick={onCycle}
      >
        <span className={`${styles.dot} ${styles['dot_' + status]}`} aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  )
}
