import styles from './CategorySectionHeader.module.css'

/**
 * CategorySectionHeader — section divider for grouped item lists.
 *
 * Props:
 *   name — string, the category name to display
 */
export default function CategorySectionHeader({ name }) {
  return (
    <div className={styles.header} aria-hidden="false">
      <span className={styles.label}>{name}</span>
    </div>
  )
}
