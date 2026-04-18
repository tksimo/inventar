import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import ShoppingListRow from './ShoppingListRow.jsx'

function renderRow(props) {
  const entries = [props.entry]
  const ids = [props.entry.id != null ? String(props.entry.id) : `auto-${props.entry.item_id}`]
  return render(
    <DndContext>
      <SortableContext items={ids}>
        <ul>
          <ShoppingListRow {...props} />
        </ul>
      </SortableContext>
    </DndContext>
  )
}

describe('ShoppingListRow', () => {
  const baseEntry = {
    id: 1, item_id: 1, item_name: 'Milk',
    quantity_mode: 'exact', quantity: 0, status: null,
    reorder_threshold: 3, added_manually: false, sort_order: 1,
    auto: false, location_id: null,
  }

  it('renders item name and quantity sub-label', () => {
    renderRow({ entry: baseEntry, onCheck: () => {}, onRemove: () => {} })
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('0 left')).toBeInTheDocument()
  })

  it('checkbox invokes onCheck with entry', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    renderRow({ entry: baseEntry, onCheck, onRemove: () => {} })
    await user.click(screen.getByRole('checkbox', { name: 'Milk' }))
    expect(onCheck).toHaveBeenCalledWith(baseEntry)
  })

  it('drag handle has aria-label containing item name', () => {
    renderRow({ entry: baseEntry, onCheck: () => {}, onRemove: () => {} })
    expect(screen.getByLabelText('Reorder Milk')).toBeInTheDocument()
  })

  it('remove button invokes onRemove with entry', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderRow({ entry: baseEntry, onCheck: () => {}, onRemove })
    await user.click(screen.getByLabelText('Remove Milk from shopping list'))
    expect(onRemove).toHaveBeenCalledWith(baseEntry)
  })

  it('status=out renders "Out" sub-label', () => {
    renderRow({
      entry: { ...baseEntry, quantity_mode: 'status', status: 'out', quantity: null },
      onCheck: () => {}, onRemove: () => {},
    })
    expect(screen.getByText('Out')).toBeInTheDocument()
  })

  it('quantity null with status null renders no sub-label', () => {
    renderRow({
      entry: { ...baseEntry, quantity: null, status: null },
      onCheck: () => {}, onRemove: () => {},
    })
    // "Milk" name exists, no "left" suffix
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })
})
