import { NavLink } from 'react-router-dom'
import styles from './NavItem.module.css'

/**
 * Single sidebar nav link. Applies .active class when react-router-dom
 * determines this link matches the current route (sets aria-current="page").
 *
 * Props:
 *   to    - route path
 *   end   - whether to match exactly (used for '/')
 *   icon  - Lucide icon component (passed, not string)
 *   label - visible text label
 */
export default function NavItem({ to, end, icon: Icon, label, badge }) {
  const showBadge = typeof badge === 'number' && badge > 0
  const badgeText = showBadge ? (badge > 99 ? '99+' : String(badge)) : null
  return (
    <li className={styles.li}>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          isActive ? `${styles.link} ${styles.active}` : styles.link
        }
      >
        <Icon size={20} aria-hidden="true" className={styles.icon} />
        <span className={styles.label}>{label}</span>
        {showBadge && (
          <span className={styles.badge} aria-label={`${badge} items to buy`}>
            {badgeText}
          </span>
        )}
      </NavLink>
    </li>
  )
}
