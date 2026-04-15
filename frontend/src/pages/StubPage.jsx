import styles from './StubPage.module.css'

/**
 * Phase 1 stub page. Renders a heading + future-tense body paragraph.
 * Matches 01-UI-SPEC §Component Inventory → StubPage.
 */
export default function StubPage({ title, body }) {
  return (
    <div className={styles.stub}>
      <h1 className={styles.heading}>{title}</h1>
      <p className={styles.body}>{body}</p>
    </div>
  )
}
