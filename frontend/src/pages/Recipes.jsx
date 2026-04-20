import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeCard from '../components/RecipeCard/RecipeCard.jsx'
import RecipeForm from '../components/RecipeForm/RecipeForm.jsx'
import RecipeDetail from '../components/RecipeDetail/RecipeDetail.jsx'
import RecipeCheckSheet from '../components/RecipeCheckSheet/RecipeCheckSheet.jsx'
import CookConfirmSheet from '../components/CookConfirmSheet/CookConfirmSheet.jsx'
import EmptyState from '../components/EmptyState/EmptyState.jsx'
import Toast from '../components/Toast/Toast.jsx'
import FAB from '../components/FAB/FAB.jsx'
import styles from './Recipes.module.css'

/**
 * Recipes page — replaces Phase 1 StubPage at /recipes.
 * Covers: RECP-01 (CRUD), RECP-02 (URL import).
 * Plan 05 wires up check/cook sheets (RECP-03/04/05).
 */
export default function Recipes({ onInventoryMutated }) {
  const api = useRecipes()
  const { recipes, loading, error, create, update, remove, getDetail, importUrl } = api

  const [selected, setSelected] = useState(null)       // RecipeResponse | null
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formInitial, setFormInitial] = useState(null)
  const [importBarOpen, setImportBarOpen] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState(null)

  // Plan 05 — Check flow state
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkData, setCheckData] = useState(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  // Plan 05 — Cook flow state
  const [cookOpen, setCookOpen] = useState(false)
  const [cookSaving, setCookSaving] = useState(false)
  const [cookSaveError, setCookSaveError] = useState(null)

  const handleOpenCard = async (recipeListItem) => {
    const res = await getDetail(recipeListItem.id)
    if (res.ok) setSelected(res.recipe)
  }

  const handleNewClick = () => {
    setFormInitial(null)
    setFormMode('add')
    setFormOpen(true)
  }

  const handleEditClick = () => {
    if (!selected) return
    setFormInitial(selected)
    setFormMode('edit')
    setFormOpen(true)
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    const url = importValue.trim()
    if (!url) return
    setImporting(true)
    const res = await importUrl(url)
    setImporting(false)
    setImportValue('')
    setImportBarOpen(false)
    if (res.ok) {
      setFormInitial(res.preview)
      setFormMode('add')
      setFormOpen(true)
    } else {
      setToast("Couldn't import recipe. Enter ingredients manually.")
      setFormInitial(null)
      setFormMode('add')
      setFormOpen(true)
    }
  }

  const handleFormSave = async (body) => {
    if (formMode === 'add') {
      const res = await create(body)
      return res
    }
    const id = formInitial?.id
    if (!id) return { ok: false }
    const res = await update(id, body)
    if (res.ok) {
      // Refresh detail view if we were viewing this recipe
      if (selected && selected.id === id) {
        const detail = await getDetail(id)
        if (detail.ok) setSelected(detail.recipe)
      }
    }
    return res
  }

  const handleFormDelete = async (id) => {
    const res = await remove(id)
    if (res.ok) {
      if (selected && selected.id === id) setSelected(null)
    }
    return res
  }

  const handleOpenCheck = async () => {
    if (!selected) return
    setAddError(null)
    setCheckOpen(true)
    setCheckLoading(true)
    setCheckData(null)
    const res = await api.checkIngredients(selected.id)
    setCheckLoading(false)
    if (res.ok) setCheckData(res.check)
  }

  const handleCloseCheck = () => {
    setCheckOpen(false)
    setCheckData(null)
    setAddError(null)
    setAdding(false)
  }

  const handleAddMissing = async () => {
    if (!selected) return
    setAdding(true)
    setAddError(null)
    const res = await api.addMissing(selected.id)
    setAdding(false)
    if (res.ok) {
      setToast('Missing ingredients added to shopping list.')
    } else {
      setAddError("Couldn't add. Try again.")
    }
  }

  const handleOpenCook = async () => {
    if (!selected) return
    setCookSaveError(null)
    setCookOpen(true)
    // Fetch fresh check data if not already loaded for this recipe
    if (!checkData || checkData.recipe_id !== selected.id) {
      setCheckLoading(true)
      const res = await api.checkIngredients(selected.id)
      setCheckLoading(false)
      if (res.ok) setCheckData(res.check)
      else { setCookOpen(false); setToast("Couldn't load ingredients. Try again.") }
    }
  }

  const handleCookConfirm = async (deductions) => {
    if (!selected) return
    setCookSaving(true)
    setCookSaveError(null)
    const res = await api.cook(selected.id, deductions)
    setCookSaving(false)
    if (res.ok) {
      setToast(`${selected.name} cooked. Inventory updated.`)
      setCookOpen(false)
      if (!checkOpen) setCheckData(null)
      onInventoryMutated?.()
      // Refresh detail view so updated quantities render
      const detail = await api.getDetail(selected.id)
      if (detail.ok) setSelected(detail.recipe)
    } else {
      setCookSaveError("Couldn't save. Try again.")
    }
  }

  const handleCloseCook = () => {
    setCookOpen(false)
    setCookSaveError(null)
    if (!checkOpen) setCheckData(null)
  }

  if (selected) {
    return (
      <>
        <RecipeDetail
          recipe={selected}
          onBack={() => setSelected(null)}
          onEdit={handleEditClick}
          onCheck={handleOpenCheck}
          onCook={handleOpenCook}
        />
        {formOpen && (
          <RecipeForm
            mode={formMode}
            initialRecipe={formInitial}
            onClose={() => setFormOpen(false)}
            onSave={handleFormSave}
            onDelete={formMode === 'edit' ? handleFormDelete : undefined}
          />
        )}
        {toast && (
          <Toast message={toast} onDismiss={() => setToast(null)} />
        )}
        {checkOpen && (
          <RecipeCheckSheet
            recipeName={selected.name}
            checkData={checkData}
            loading={checkLoading}
            adding={adding}
            addError={addError}
            onAddMissing={handleAddMissing}
            onClose={handleCloseCheck}
          />
        )}
        {cookOpen && checkData && (
          <CookConfirmSheet
            recipeName={selected.name}
            checkData={checkData}
            saving={cookSaving}
            saveError={cookSaveError}
            onConfirm={handleCookConfirm}
            onClose={handleCloseCook}
          />
        )}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Recipes</h1>
        <button
          type="button"
          className={styles.importBtn}
          aria-label="Import recipe from URL"
          onClick={() => setImportBarOpen((open) => !open)}
        >
          Import URL
        </button>
      </header>

      {importBarOpen && (
        <form className={styles.importBar} onSubmit={handleImportSubmit}>
          <input
            type="url"
            className={styles.importInput}
            placeholder="Paste recipe URL\u2026"
            value={importValue}
            onChange={(e) => setImportValue(e.target.value)}
            aria-label="Recipe URL"
            autoComplete="url"
            inputMode="url"
            disabled={importing}
          />
          <button
            type="submit"
            className={styles.importSubmit}
            disabled={importing || !importValue.trim()}
          >
            {importing ? 'Importing\u2026' : 'Import'}
          </button>
        </form>
      )}

      <main className={styles.body}>
        {loading && recipes.length === 0 && <p className={styles.loading}>Loading\u2026</p>}
        {error && <p role="alert" className={styles.error}>Couldn&apos;t load recipes. Check your connection and try again.</p>}
        {!loading && recipes.length === 0 && !error && (
          <EmptyState
            icon={<UtensilsCrossed size={48} />}
            heading="No recipes yet"
            body="Add your first recipe or import from a URL."
          />
        )}
        {recipes.length > 0 && (
          <ul className={styles.list}>
            {recipes.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} onOpen={handleOpenCard} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <FAB onClick={handleNewClick} label="Add new recipe" />

      {formOpen && (
        <RecipeForm
          mode={formMode}
          initialRecipe={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleFormSave}
          onDelete={formMode === 'edit' ? handleFormDelete : undefined}
        />
      )}

      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
