import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Global mock for @yudiel/react-qr-scanner.
//
// jsdom has no camera and no BarcodeDetector API; any test that renders
// CameraOverlay (directly or indirectly) would otherwise try to call
// getUserMedia and throw. We replace the Scanner component with a
// lightweight stub that:
//   1. Renders nothing visible (a <div data-testid="scanner-mock">).
//   2. Exposes the onScan prop via the global `__triggerScan` helper so
//      tests can simulate a barcode detection deterministically:
//        window.__triggerScan('3017624010701')
//   3. Exposes a no-op onError for parity with the real Scanner API.
vi.mock('@yudiel/react-qr-scanner', () => {
  return {
    Scanner: ({ onScan }) => {
      // Store the callback on window so tests can trigger detections.
      window.__triggerScan = (rawValue) => {
        if (typeof onScan === 'function') {
          onScan([{ rawValue }])
        }
      }
      return null
    },
  }
})
