import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilterChip from './FilterChip.jsx'

describe('FilterChip', () => {
  it('renders inactive chip without a dismiss button', () => {
    render(<FilterChip label="Food" active={false} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove filter/i })).not.toBeInTheDocument()
  })

  it('renders active chip with a dismiss button', () => {
    render(<FilterChip label="Food" active={true} onDismiss={vi.fn()} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    const dismissBtn = screen.getByRole('button', { name: 'Remove filter: Food' })
    expect(dismissBtn).toBeInTheDocument()
  })

  it('clicking dismiss calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<FilterChip label="Food" active={true} onDismiss={onDismiss} />)
    const dismissBtn = screen.getByRole('button', { name: 'Remove filter: Food' })
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('clicking dismiss does not trigger the outer chip onClick (stopPropagation)', () => {
    const onClick = vi.fn()
    const onDismiss = vi.fn()
    render(<FilterChip label="Food" active={true} onClick={onClick} onDismiss={onDismiss} />)
    const dismissBtn = screen.getByRole('button', { name: 'Remove filter: Food' })
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
