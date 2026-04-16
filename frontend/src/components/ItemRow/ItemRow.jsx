import QuantityControls from '../QuantityControls/QuantityControls.jsx'
import { relativeTime } from '../../lib/time.js'
import styles from './ItemRow.module.css'

export default function ItemRow({ item, locationName, onOpen, onIncrement, onDecrement, onCycle, errored }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen?.()
    }
  }

  return (
    <li className={styles.row} role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}>
      <div className={styles.left}>
        <div className={styles.name}>{item.name}</div>
        <div className={styles.secondary}>{locationName ?? '—'}</div>
        {item.last_updated_by_name && (
          <div className={styles.attribution}>
            Updated by {item.last_updated_by_name} · {relativeTime(item.updated_at)}
          </div>
        )}
      </div>
      <div className={styles.right} onClick={(e) => e.stopPropagation()}>
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
