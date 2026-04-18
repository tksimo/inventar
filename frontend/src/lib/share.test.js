import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatShoppingList, shareText } from './share.js'

describe('formatShoppingList', () => {
  it('returns header-only for empty list', () => {
    expect(formatShoppingList([])).toBe('Einkaufsliste\n')
  })

  it('formats exact-mode item with "{n} left"', () => {
    const out = formatShoppingList([
      { item_name: 'Milk', quantity_mode: 'exact', quantity: 0, status: null },
    ])
    expect(out).toBe('Einkaufsliste\n\n• Milk (0 left)')
  })

  it('formats status=out as "(Out)"', () => {
    const out = formatShoppingList([
      { item_name: 'Oil', quantity_mode: 'status', quantity: null, status: 'out' },
    ])
    expect(out).toBe('Einkaufsliste\n\n• Oil (Out)')
  })

  it('omits parens when no quantity info', () => {
    const out = formatShoppingList([
      { item_name: 'Salt', quantity_mode: 'exact', quantity: null, status: null },
    ])
    expect(out).toBe('Einkaufsliste\n\n• Salt')
  })

  it('renders multiple entries joined by newlines', () => {
    const out = formatShoppingList([
      { item_name: 'Milk', quantity_mode: 'exact', quantity: 0, status: null },
      { item_name: 'Bread', quantity_mode: 'exact', quantity: 0, status: null },
      { item_name: 'Detergent', quantity_mode: 'exact', quantity: 1, status: null },
    ])
    expect(out).toBe(
      'Einkaufsliste\n\n• Milk (0 left)\n• Bread (0 left)\n• Detergent (1 left)'
    )
  })
})

describe('shareText', () => {
  const originalNavigator = global.navigator
  beforeEach(() => {
    // vitest's jsdom already provides navigator; we stub properties per test
  })
  afterEach(() => {
    // Restore
    if (originalNavigator.share) delete navigator.share
    vi.restoreAllMocks()
  })

  it('uses navigator.share when available', async () => {
    const shareSpy = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true })
    const res = await shareText({ title: 'T', text: 'X' })
    expect(res.method).toBe('share')
    expect(shareSpy).toHaveBeenCalledWith({ title: 'T', text: 'X' })
  })

  it('falls back to clipboard when navigator.share is undefined', async () => {
    // Ensure share is not present
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const res = await shareText({ title: 'T', text: 'X' })
    expect(res.method).toBe('clipboard')
    expect(writeText).toHaveBeenCalledWith('X')
  })
})
