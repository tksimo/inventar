import QuantityControls from '../QuantityControls/QuantityControls.jsx'
import { relativeTime } from '../../lib/time.js'
import styles from './ItemCard.module.css'

export default function ItemCard({ item, categoryName, locationName, onOpen, onIncrement, onDecrement, onCycle, errored }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen?.()
    }
  }

  const meta = [categoryName, locationName].filter(Boolean).join(' · ') || '—'

  return (
    <li className={styles.card} role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}>
      <div className={styles.name}>{item.name}</div>
      <div className={styles.meta}>{meta}</div>
      {item.last_updated_by_name && (
        <div className={styles.attribution}>
          Updated by {item.last_updated_by_name} · {relativeTime(item.updated_at)}
        </div>
      )}
      <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
        <QuantityControls
          item={item}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onCycle={onCycle}
          errored={errored}
        />
      </div>
    </li>
  )
}
