import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layout/AppLayout.jsx'
import Inventory from './pages/Inventory.jsx'
import ShoppingList from './pages/ShoppingList.jsx'
import Recipes from './pages/Recipes.jsx'
import Settings from './pages/Settings.jsx'
import { useItems } from './hooks/useItems.js'

/**
 * Root of the SPA. Uses BrowserRouter because FastAPI's catch-all
 * SPA fallback (added in Plan 01-04) will serve index.html for any
 * unmatched path. A wildcard Route redirects to '/' — per 01-UI-SPEC
 * §Interaction Contract there is no 404 page in Phase 1.
 *
 * useItems is lifted to AppInner so a single items source feeds both
 * Inventory and the ShoppingList manual-add picker (Plan 04-03).
 */
function AppInner() {
  const itemsApi = useItems()
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Inventory itemsApi={itemsApi} />} />
        <Route path="/shopping" element={<ShoppingList itemsApi={itemsApi} />} />
        <Route path="/recipes" element={<Recipes onInventoryMutated={itemsApi.refetch} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
