import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../hooks/useAccessInfo.js', () => ({
  useAccessInfo: vi.fn(),
}))

import { useAccessInfo } from '../../hooks/useAccessInfo.js'
import AccessBanner from './AccessBanner.jsx'

describe('AccessBanner', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetAllMocks()
  })

  it('T5: renders nothing when viaIngress=true', () => {
    useAccessInfo.mockReturnValue({ viaIngress: true, loading: false, userName: null, error: null })
    const { container } = render(<AccessBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('T6: renders nothing when loading=true (avoids flash on mount)', () => {
    useAccessInfo.mockReturnValue({ viaIngress: null, loading: true, userName: null, error: null })
    const { container } = render(<AccessBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('T7: renders nothing when dismiss flag is set in sessionStorage', () => {
    sessionStorage.setItem('inventar_access_banner_dismissed', '1')
    useAccessInfo.mockReturnValue({ viaIngress: false, loading: false, userName: null, error: null })
    const { container } = render(<AccessBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('T8: renders banner with correct text and Dismiss button when viaIngress=false and not dismissed', () => {
    useAccessInfo.mockReturnValue({ viaIngress: false, loading: false, userName: null, error: null })
    render(<AccessBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(
      screen.getByText(
        'Open Inventar from Home Assistant (Sidebar → Inventar) to enable user attribution.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument()
  })

  it('T9: clicking Dismiss writes sessionStorage flag and hides the banner', () => {
    useAccessInfo.mockReturnValue({ viaIngress: false, loading: false, userName: null, error: null })
    render(<AccessBanner />)

    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

    expect(screen.queryByRole('status')).toBeNull()
    expect(sessionStorage.getItem('inventar_access_banner_dismissed')).toBe('1')
  })
})
