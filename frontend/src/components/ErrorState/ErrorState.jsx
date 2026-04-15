import { AlertCircle } from 'lucide-react'
import styles from './ErrorState.module.css'

/**
 * ErrorState — error placeholder for failed data loads.
 *
 * Props:
 *   heading — string, e.g. "Could not load inventory"
 *   body    — string, e.g. "Check your network connection and reload the page."
 */
export default function ErrorState({ heading, body }) {
  return (
    <div className={styles.container} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <AlertCircle size={48} />
      </span>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      {body && <p className={styles.body}>{body}</p>}
    </div>
  )
}
