import { House, ShoppingCart, UtensilsCrossed, Settings as SettingsIcon } from 'lucide-react'
import NavItem from './NavItem.jsx'
import AccessBanner from '../components/AccessBanner/AccessBanner.jsx'
import { useShoppingList } from '../hooks/useShoppingList.js'
import styles from './AppLayout.module.css'

/**
 * Fixed left sidebar (220px) + scrollable main content area.
 * Matches 01-UI-SPEC §Component Inventory → AppLayout, extended in Phase 5
 * with the Recipes nav item.
 *
 * AccessBanner renders above <main> — it is purely additive and does not
 * block the app shell from rendering.
 *
 * useShoppingList is called here to drive the low-stock count badge on the
 * Shopping List nav item (SHOP-04, D-16). This is an independent fetch from
 * the ShoppingList page's own hook — acceptable cost at household scale.
 */
export default function AppLayout({ children }) {
  const { entries } = useShoppingList()
  const lowStockCount = entries.length

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Inventar</div>
        <nav aria-label="Main navigation">
          <ul className={styles.navList}>
            <NavItem to="/" end icon={House} label="Inventory" />
            <NavItem
              to="/shopping"
              icon={ShoppingCart}
              label="Shopping List"
              badge={lowStockCount}
            />
            <NavItem to="/recipes" icon={UtensilsCrossed} label="Recipes" />
            <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
          </ul>
        </nav>
      </aside>
      <AccessBanner />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
