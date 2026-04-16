import { useState } from 'react'
import { X } from 'lucide-react'
import { useAccessInfo } from '../../hooks/useAccessInfo.js'
import styles from './AccessBanner.module.css'

const DISMISS_KEY = 'inventar_access_banner_dismissed'

export default function AccessBanner() {
  const { viaIngress, loading } = useAccessInfo()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  if (loading || viaIngress || dismissed) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div role="status" className={styles.banner}>
      <span className={styles.text}>
        Open Inventar from Home Assistant (Sidebar → Inventar) to enable user attribution.
      </span>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss banner">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
