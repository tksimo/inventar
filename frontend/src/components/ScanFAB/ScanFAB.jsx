import { ScanBarcode } from 'lucide-react'
import styles from './ScanFAB.module.css'

/**
 * ScanFAB — secondary floating action button that opens the camera barcode
 * scanner. Stacks above the primary Plus FAB. Follows the same visual contract
 * as FAB.jsx but uses --color-secondary (vs. --color-accent) to distinguish
 * the two actions at a glance.
 */
export default function ScanFAB({ onClick, label = 'Scan barcode' }) {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={label}
    >
      <ScanBarcode size={24} aria-hidden="true" />
    </button>
  )
}
