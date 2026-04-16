import { useState, useRef, useEffect } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import styles from './SettingsListItem.module.css'

function renameErrorCopy(message) {
  if (message?.includes('409')) return 'That name is already taken.'
  if (message?.includes('403')) return "This category can't be renamed."
  return 'Could not rename. Try again.'
}

function deleteErrorCopy(message) {
  if (message?.includes('403')) return "Default categories can't be deleted."
  return 'Could not delete. Try again.'
}

export default function SettingsListItem({
  entry,
  locked = false,
  onRename,
  onDelete,
  deleteConfirmText,
  errorMessage = null,
}) {
  const [mode, setMode] = useState('view')
  const [draftName, setDraftName] = useState(entry.name)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (mode === 'rename') inputRef.current?.focus()
  }, [mode])

  const enterRename = () => {
    setDraftName(entry.name)
    setLocalError(null)
    setMode('rename')
  }

  const cancelRename = () => {
    setLocalError(null)
    setMode('view')
  }

  const submitRename = async () => {
    const next = draftName.trim()
    if (!next || next === entry.name) {
      cancelRename()
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onRename(entry.id, next)
      setMode('view')
    } catch (e) {
      setLocalError(renameErrorCopy(e?.message))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  const enterDeleteConfirm = () => {
    setLocalError(null)
    setMode('confirmDelete')
  }

  const cancelDelete = () => {
    setLocalError(null)
    setMode('view')
  }

  const confirmDelete = async () => {
    setBusy(true)
    setLocalError(null)
    try {
      await onDelete(entry.id)
      // Parent removes entry; component unmounts
    } catch (e) {
      setLocalError(deleteErrorCopy(e?.message))
      setBusy(false)
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.content}>
        {mode === 'view' && (
          <>
            <span className={styles.name}>{entry.name}</span>
            {!locked && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`Rename ${entry.name}`}
                  onClick={enterRename}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.destructive}`}
                  aria-label={`Delete ${entry.name}`}
                  onClick={enterDeleteConfirm}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
        {mode === 'rename' && (
          <>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              aria-label={`Rename input for ${entry.name}`}
            />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Confirm rename"
                disabled={busy}
                onClick={submitRename}
              >
                <Check size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Cancel rename"
                disabled={busy}
                onClick={cancelRename}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
        {mode === 'confirmDelete' && (
          <>
            <span className={styles.confirmText}>{deleteConfirmText}</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.confirmYes}
                disabled={busy}
                onClick={confirmDelete}
              >
                Yes, delete
              </button>
              <button
                type="button"
                className={styles.confirmCancel}
                disabled={busy}
                onClick={cancelDelete}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
      {(localError || errorMessage) && (
        <p role="alert" className={styles.errorLine}>
          {localError || errorMessage}
        </p>
      )}
    </li>
  )
}
