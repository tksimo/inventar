import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeCard from '../components/RecipeCard/RecipeCard.jsx'
import RecipeForm from '../components/RecipeForm/RecipeForm.jsx'
import RecipeDetail from '../components/RecipeDetail/RecipeDetail.jsx'
import EmptyState from '../components/EmptyState/EmptyState.jsx'
import Toast from '../components/Toast/Toast.jsx'
import FAB from '../components/FAB/FAB.jsx'
import styles from './Recipes.module.css'

/**
 * Recipes page — replaces Phase 1 StubPage at /recipes.
 * Covers: RECP-01 (CRUD), RECP-02 (URL import).
 * Plan 05 wires up check/cook sheets (RECP-03/04/05).
 */
export default function Recipes() {
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

  if (selected) {
    return (
      <>
        <RecipeDetail
          recipe={selected}
          onBack={() => setSelected(null)}
          onEdit={handleEditClick}
          onCheck={() => { /* Plan 05 wires up RecipeCheckSheet */ }}
          onCook={() => { /* Plan 05 wires up CookConfirmSheet */ }}
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
