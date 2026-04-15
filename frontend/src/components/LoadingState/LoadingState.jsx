import styles from './LoadingState.module.css'

/**
 * LoadingState — skeleton shimmer rows for list loading.
 *
 * Props:
 *   count — number of skeleton rows to render (default 3)
 */
export default function LoadingState({ count = 3 }) {
  return (
    <div className={styles.container} role="status" aria-label="Loading…">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeleton} aria-hidden="true" />
      ))}
    </div>
  )
}
