import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { vi } from 'vitest'
import CameraOverlay from './CameraOverlay.jsx'

describe('CameraOverlay', () => {
  afterEach(() => {
    delete window.__triggerScan
  })

  it('renders a modal dialog labelled "Barcode scanner"', () => {
    render(<CameraOverlay onDetected={() => {}} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Barcode scanner' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('shows default status text "Point camera at a barcode"', () => {
    render(<CameraOverlay onDetected={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Point camera at a barcode')).toBeInTheDocument()
  })

  it('calls onDetected with the scanned rawValue', () => {
    const onDetected = vi.fn()
    render(<CameraOverlay onDetected={onDetected} onClose={() => {}} />)
    act(() => { window.__triggerScan('3017624010701') })
    expect(onDetected).toHaveBeenCalledTimes(1)
    expect(onDetected).toHaveBeenCalledWith('3017624010701')
  })

  it('ignores duplicate scans after the first result', () => {
    const onDetected = vi.fn()
    render(<CameraOverlay onDetected={onDetected} onClose={() => {}} />)
    act(() => {
      window.__triggerScan('3017624010701')
      window.__triggerScan('3017624010701')
    })
    expect(onDetected).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CameraOverlay onDetected={() => {}} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close camera' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CameraOverlay onDetected={() => {}} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
