import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ScanFAB from './ScanFAB.jsx'

describe('ScanFAB', () => {
  it('renders a button with aria-label "Scan barcode"', () => {
    render(<ScanFAB onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Scan barcode' })).toBeInTheDocument()
  })

  it('calls onClick exactly once when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<ScanFAB onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Scan barcode' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a ScanBarcode svg icon', () => {
    const { container } = render(<ScanFAB onClick={() => {}} />)
    // lucide-react renders an inline <svg>; assert at least one exists inside the button
    expect(container.querySelector('button svg')).toBeInTheDocument()
  })
})
