import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toast from './Toast.jsx'

describe('Toast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('Test 1: renders with role=status and aria-live=polite and the message text', () => {
    render(<Toast message="Item not found" onDismiss={() => {}} />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
    expect(el.textContent).toContain('Item not found')
  })

  it('Test 2: auto-dismisses after duration (default 2000ms)', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Copied!" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('Test 3: action button renders and triggers onAction + onDismiss', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(<Toast message="Removed from list" duration={null} actionLabel="Undo" onAction={onAction} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
