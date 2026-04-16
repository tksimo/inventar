import styles from './EmptyState.module.css'

/**
 * EmptyState — centered empty content placeholder.
 *
 * Props:
 *   icon    — React node (lucide icon element), rendered at 48px --color-text-secondary
 *   heading — string, 20px 600 --color-text-primary
 *   body    — string, 14px 400 --color-text-secondary
 *   cta     — optional React node or string; when provided renders as --color-accent button
 *
 * The caller passes the icon node already sized, e.g.:
 *   <EmptyState icon={<Package size={48} />} heading="..." body="..." />
 */
export default function EmptyState({ icon, heading, body, cta, onCtaClick }) {
  return (
    <div className={styles.container} role="status" aria-live="polite">
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      {body && <p className={styles.body}>{body}</p>}
      {cta && (
        <button type="button" className={styles.cta} onClick={onCtaClick}>
          {cta}
        </button>
      )}
    </div>
  )
}
