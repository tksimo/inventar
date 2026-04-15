import { House, ShoppingCart, Settings as SettingsIcon } from 'lucide-react'
import NavItem from './NavItem.jsx'
import styles from './AppLayout.module.css'

/**
 * Fixed left sidebar (220px) + scrollable main content area.
 * Matches 01-UI-SPEC §Component Inventory → AppLayout.
 */
export default function AppLayout({ children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Inventar</div>
        <nav aria-label="Main navigation">
          <ul className={styles.navList}>
            <NavItem to="/" end icon={House} label="Inventory" />
            <NavItem to="/shopping" icon={ShoppingCart} label="Shopping List" />
            <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
          </ul>
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
