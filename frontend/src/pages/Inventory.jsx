import { useState, useEffect, useMemo } from 'react'
import { Package, SlidersHorizontal } from 'lucide-react'
import { useItems } from '../hooks/useItems.js'
import { useCategories } from '../hooks/useCategories.js'
import { useLocations } from '../hooks/useLocations.js'
import ItemRow from '../components/ItemRow/ItemRow.jsx'
import ItemCard from '../components/ItemCard/ItemCard.jsx'
import FilterChip from '../components/FilterChip/FilterChip.jsx'
import FilterPicker from '../components/FilterPicker/FilterPicker.jsx'
import FAB from '../components/FAB/FAB.jsx'
import EmptyState from '../components/EmptyState/EmptyState.jsx'
import LoadingState from '../components/LoadingState/LoadingState.jsx'
import ErrorState from '../components/ErrorState/ErrorState.jsx'
import CategorySectionHeader from '../components/CategorySectionHeader/CategorySectionHeader.jsx'
import ItemDrawer from '../components/ItemDrawer/ItemDrawer.jsx'
import styles from './Inventory.module.css'

export default function Inventory() {
  const { items, loading: itemsLoading, error: itemsError, errorItemId, create, update, remove, updateQuantity, cycleStatus } = useItems()
  const { categories, loading: catsLoading } = useCategories()
  const { locations, loading: locsLoading } = useLocations()

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeCategoryIds, setActiveCategoryIds] = useState([])
  const [activeLocationIds, setActiveLocationIds] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [drawerState, setDrawerState] = useState({ open: false, mode: 'add', item: null })

  // Debounce search input 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const openAdd = () => setDrawerState({ open: true, mode: 'add', item: null })
  const openEdit = (item) => setDrawerState({ open: true, mode: 'edit', item })

  const toggleCategory = (id) => {
    setActiveCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleLocation = (id) => {
    setActiveLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Find names for active filter chips
  const activeCategoryChips = categories.filter((c) => activeCategoryIds.includes(c.id))
  const activeLocationChips = locations.filter((l) => activeLocationIds.includes(l.id))

  // Build location name lookup for item rows
  const locationMap = useMemo(() => {
    const m = {}
    for (const l of locations) m[l.id] = l.name
    return m
  }, [locations])

  // Build category name lookup for item cards
  const categoryMap = useMemo(() => {
    const m = {}
    for (const c of categories) m[c.id] = c.name
    return m
  }, [categories])

  // Filter items client-side
  const filtered = useMemo(() => {
    let result = items.filter((it) => !it.archived)
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.trim().toLowerCase()
      result = result.filter((it) => it.name.toLowerCase().includes(search))
    }
    if (activeCategoryIds.length > 0) {
      result = result.filter((it) => activeCategoryIds.includes(it.category_id))
    }
    if (activeLocationIds.length > 0) {
      result = result.filter((it) => activeLocationIds.includes(it.location_id))
    }
    return result
  }, [items, debouncedSearch, activeCategoryIds, activeLocationIds])

  // Group filtered items by category
  const grouped = useMemo(() => {
    const byCat = new Map()
    for (const it of filtered) {
      const k = it.category_id ?? null
      if (!byCat.has(k)) byCat.set(k, [])
      byCat.get(k).push(it)
    }
    const orderedIds = [...categories.map((c) => c.id), null]
    return orderedIds
      .filter((id) => byCat.has(id))
      .map((id) => ({
        id,
        name: id == null ? 'Uncategorised' : (categories.find((c) => c.id === id)?.name ?? 'Uncategorised'),
        items: byCat.get(id),
      }))
  }, [filtered, categories])

  // Loading state: any hook still loading AND no items yet
  const isLoading = (itemsLoading || catsLoading || locsLoading) && items.length === 0

  // Determine which empty state to show
  const hasActiveFilters = activeCategoryIds.length > 0 || activeLocationIds.length > 0

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState count={3} />
    }
    if (itemsError) {
      return (
        <ErrorState
          heading="Could not load inventory"
          body="Check your network connection and reload the page."
        />
      )
    }
    // Total empty (no items at all, no search, no filter)
    if (filtered.length === 0 && !debouncedSearch.trim() && !hasActiveFilters) {
      return (
        <EmptyState
          icon={<Package size={48} />}
          heading="Nothing here yet"
          body="Add your first item to get started."
          cta="Add your first item"
          onCtaClick={openAdd}
        />
      )
    }
    // Search with no matches
    if (filtered.length === 0 && debouncedSearch.trim()) {
      return (
        <EmptyState
          heading={`No items match "${debouncedSearch}"`}
          body="Try a different name or clear the search."
        />
      )
    }
    // Filter with no matches
    if (filtered.length === 0 && hasActiveFilters) {
      return (
        <EmptyState
          heading="No items in this view"
          body="Try removing a filter to see more items."
        />
      )
    }

    return grouped.map((group) => (
      <section key={group.id ?? 'uncategorised'} className={styles.group} aria-label={group.name}>
        <CategorySectionHeader name={group.name} />
        <ul className={styles.listView}>
          {group.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              locationName={item.location_id != null ? locationMap[item.location_id] : null}
              onOpen={() => openEdit(item)}
              onIncrement={() => updateQuantity(item.id, +1)}
              onDecrement={() => updateQuantity(item.id, -1)}
              onCycle={() => cycleStatus(item.id)}
              errored={errorItemId === item.id}
            />
          ))}
        </ul>
        <ul className={styles.gridView}>
          {group.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              categoryName={item.category_id != null ? categoryMap[item.category_id] : null}
              locationName={item.location_id != null ? locationMap[item.location_id] : null}
              onOpen={() => openEdit(item)}
              onIncrement={() => updateQuantity(item.id, +1)}
              onDecrement={() => updateQuantity(item.id, -1)}
              onCycle={() => cycleStatus(item.id)}
              errored={errorItemId === item.id}
            />
          ))}
        </ul>
      </section>
    ))
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageHeading}>Inventory</h1>
        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search items…"
            aria-label="Search items"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchTerm('')
            }}
          />
        </div>
        <div className={styles.filterRow}>
          {activeCategoryChips.map((c) => (
            <FilterChip
              key={`active-cat-${c.id}`}
              label={c.name}
              active
              onClick={() => toggleCategory(c.id)}
              onDismiss={() => toggleCategory(c.id)}
            />
          ))}
          {activeLocationChips.map((l) => (
            <FilterChip
              key={`active-loc-${l.id}`}
              label={l.name}
              active
              onClick={() => toggleLocation(l.id)}
              onDismiss={() => toggleLocation(l.id)}
            />
          ))}
          <div style={{ position: 'relative' }}>
            <FilterChip
              label="Filter"
              active={false}
              icon={<SlidersHorizontal size={14} aria-hidden="true" />}
              onClick={() => setPickerOpen((o) => !o)}
            />
            {pickerOpen && (
              <FilterPicker
                categories={categories}
                locations={locations}
                activeCategoryIds={activeCategoryIds}
                activeLocationIds={activeLocationIds}
                onToggleCategory={toggleCategory}
                onToggleLocation={toggleLocation}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>
      </header>
      <main className={styles.body}>
        {renderContent()}
      </main>
      <FAB onClick={openAdd} label="Add item" />
      {drawerState.open && (
        <ItemDrawer
          mode={drawerState.mode}
          item={drawerState.item}
          categories={categories}
          locations={locations}
          onClose={() => setDrawerState((s) => ({ ...s, open: false }))}
          onCreate={async (body) => { const created = await create(body); return created }}
          onUpdate={async (id, patch) => update(id, patch)}
          onDelete={async (id) => remove(id)}
        />
      )}
    </div>
  )
}
