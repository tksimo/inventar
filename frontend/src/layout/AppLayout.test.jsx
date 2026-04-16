import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import App from '../App.jsx'

// Mock useAccessInfo so AppLayout tests are deterministic (banner suppressed by default)
vi.mock('../hooks/useAccessInfo.js', () => ({
  useAccessInfo: vi.fn(() => ({ viaIngress: true, loading: false, userName: null, error: null })),
}))

import { useAccessInfo } from '../hooks/useAccessInfo.js'

describe('AppLayout', () => {
  it('renders the brand name "Inventar"', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div>child</div>
        </AppLayout>
      </MemoryRouter>,
    )
    expect(screen.getByText('Inventar')).toBeInTheDocument()
  })

  it('renders nav with accessible label "Main navigation"', () => {
    render(
      <MemoryRouter>
        <AppLayout><div /></AppLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('renders exactly three nav links with correct labels', () => {
    render(
      <MemoryRouter>
        <AppLayout><div /></AppLayout>
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.querySelectorAll('a')).toHaveLength(3)
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shopping list/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders children inside <main>', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <p data-testid="child">hello</p>
        </AppLayout>
      </MemoryRouter>,
    )
    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByTestId('child'))
  })

  it('T10: renders AccessBanner above <main> in the DOM tree', () => {
    // Override mock for this test: viaIngress=false so banner renders
    vi.mocked(useAccessInfo).mockReturnValue({ viaIngress: false, loading: false, userName: null, error: null })
    render(
      <MemoryRouter>
        <AppLayout><div>content</div></AppLayout>
      </MemoryRouter>,
    )
    const banner = screen.getByRole('status')
    const main = screen.getByRole('main')
    // Banner should appear before main in DOM order
    expect(
      banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('App routes', () => {
  it('at / the Inventory nav link has aria-current="page"', () => {
    // App uses its own BrowserRouter internally; cannot wrap in MemoryRouter (nested routers error).
    // jsdom default URL is '/' so BrowserRouter matches the Inventory route.
    render(<App />)
    const inventoryLink = screen.getByRole('link', { name: /inventory/i })
    expect(inventoryLink).toHaveAttribute('aria-current', 'page')
  })

  it('renders the Inventory page at / (heading and search input present)', () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Inventory', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText('Search items')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
