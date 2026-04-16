import { useState } from 'react'
import { useCategories } from '../hooks/useCategories.js'
import { useLocations } from '../hooks/useLocations.js'
import SettingsListItem from '../components/SettingsListItem/SettingsListItem.jsx'
import LoadingState from '../components/LoadingState/LoadingState.jsx'
import ErrorState from '../components/ErrorState/ErrorState.jsx'
import styles from './Settings.module.css'

function AddRow({ placeholder, onSubmit }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    const next = value.trim()
    if (!next) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(next)
      setValue('')
    } catch (e) {
      setError(
        e?.message?.includes('409')
          ? 'That name is already taken.'
          : 'Could not add. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={styles.addRow}>
      <input
        className={styles.addInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={onKeyDown}
        disabled={busy}
      />
      <button type="button" className={styles.addButton} disabled={busy} onClick={submit}>
        Add
      </button>
      {error && (
        <p role="alert" className={styles.errorLine}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Settings() {
  const categoriesHook = useCategories()
  const locationsHook = useLocations()

  return (
    <div className={styles.page}>
      <h1 className={styles.pageHeading}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Categories</h2>
        {categoriesHook.loading && categoriesHook.categories.length === 0 && (
          <LoadingState count={3} />
        )}
        {categoriesHook.error && (
          <ErrorState
            heading="Could not load categories"
            body="Check your network connection and reload the page."
          />
        )}
        {!categoriesHook.error && (
          <>
            <ul className={styles.list}>
              {categoriesHook.categories.map((c) => (
                <SettingsListItem
                  key={c.id}
                  entry={{ id: c.id, name: c.name }}
                  locked={c.is_default}
                  onRename={(id, name) => categoriesHook.update(id, { name })}
                  onDelete={(id) => categoriesHook.remove(id)}
                  deleteConfirmText="Items in this category will become uncategorised. Delete anyway?"
                />
              ))}
            </ul>
            <AddRow
              placeholder="New category name"
              onSubmit={(name) => categoriesHook.create({ name })}
            />
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Storage Locations</h2>
        {locationsHook.loading && locationsHook.locations.length === 0 && (
          <LoadingState count={3} />
        )}
        {locationsHook.error && (
          <ErrorState
            heading="Could not load locations"
            body="Check your network connection and reload the page."
          />
        )}
        {!locationsHook.error && (
          <>
            <ul className={styles.list}>
              {locationsHook.locations.map((l) => (
                <SettingsListItem
                  key={l.id}
                  entry={{ id: l.id, name: l.name }}
                  locked={false}
                  onRename={(id, name) => locationsHook.update(id, { name })}
                  onDelete={(id) => locationsHook.remove(id)}
                  deleteConfirmText="Items in this location will have no location assigned. Delete anyway?"
                />
              ))}
            </ul>
            <AddRow
              placeholder="New location name"
              onSubmit={(name) => locationsHook.create({ name })}
            />
          </>
        )}
      </section>
    </div>
  )
}
