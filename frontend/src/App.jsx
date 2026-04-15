import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layout/AppLayout.jsx'
import Inventory from './pages/Inventory.jsx'
import ShoppingList from './pages/ShoppingList.jsx'
import Settings from './pages/Settings.jsx'

/**
 * Root of the SPA. Uses BrowserRouter because FastAPI's catch-all
 * SPA fallback (added in Plan 01-04) will serve index.html for any
 * unmatched path. A wildcard Route redirects to '/' — per 01-UI-SPEC
 * §Interaction Contract there is no 404 page in Phase 1.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Inventory />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
