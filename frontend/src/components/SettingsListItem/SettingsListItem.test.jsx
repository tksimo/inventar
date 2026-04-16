import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsListItem from './SettingsListItem.jsx'

const custom = { id: 5, name: 'Snacks' }
const locked = { id: 1, name: 'Food & pantry' }
const noOp = async () => {}

// T1: Unlocked view renders name, Pencil and Trash2 buttons visible
test('unlocked view renders Pencil and Trash2', () => {
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={noOp} deleteConfirmText="x" />)
  expect(screen.getByText('Snacks')).toBeInTheDocument()
  expect(screen.getByLabelText('Rename Snacks')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Snacks')).toBeInTheDocument()
})

// T2: Locked view renders name only; Pencil and Trash2 NOT in the DOM
test('locked view hides Pencil and Trash2', () => {
  render(<SettingsListItem entry={locked} locked={true} onRename={noOp} onDelete={noOp} deleteConfirmText="x" />)
  expect(screen.getByText('Food & pantry')).toBeInTheDocument()
  expect(screen.queryByLabelText('Rename Food & pantry')).toBeNull()
  expect(screen.queryByLabelText('Delete Food & pantry')).toBeNull()
})

// T3: Clicking Pencil enters rename mode — input rendered + Check + X
test('clicking Pencil enters rename mode', () => {
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={noOp} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  expect(screen.getByLabelText('Rename input for Snacks')).toBeInTheDocument()
  expect(screen.getByLabelText('Confirm rename')).toBeInTheDocument()
  expect(screen.getByLabelText('Cancel rename')).toBeInTheDocument()
})

// T4: Pressing Enter in rename input calls onRename with (id, trimmed name)
test('pressing Enter in rename input calls onRename', async () => {
  const onRename = vi.fn(async () => {})
  render(<SettingsListItem entry={custom} locked={false} onRename={onRename} onDelete={noOp} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  const input = screen.getByLabelText('Rename input for Snacks')
  fireEvent.change(input, { target: { value: 'Drinks' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(onRename).toHaveBeenCalledWith(5, 'Drinks'))
})

// T5: Pressing Escape in rename input cancels — onRename NOT called; input gone
test('pressing Escape cancels rename', () => {
  const onRename = vi.fn(async () => {})
  render(<SettingsListItem entry={custom} locked={false} onRename={onRename} onDelete={noOp} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  const input = screen.getByLabelText('Rename input for Snacks')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(onRename).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Rename input for Snacks')).toBeNull()
})

// T6: Rename with same name does NOT call onRename (no-op guard)
test('rename with same name does not call onRename', async () => {
  const onRename = vi.fn(async () => {})
  render(<SettingsListItem entry={custom} locked={false} onRename={onRename} onDelete={noOp} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  const input = screen.getByLabelText('Rename input for Snacks')
  // Value is pre-filled with entry.name ('Snacks'), submit without changing
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByLabelText('Rename input for Snacks')).toBeNull())
  expect(onRename).not.toHaveBeenCalled()
})

// T7: Rename failure with 409 shows error message; rename mode still open; Escape closes it
test('rename 409 error shows "That name is already taken."', async () => {
  const onRename = vi.fn(async () => { throw new Error('API PATCH failed: 409') })
  render(<SettingsListItem entry={custom} locked={false} onRename={onRename} onDelete={noOp} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Rename Snacks'))
  const input = screen.getByLabelText('Rename input for Snacks')
  fireEvent.change(input, { target: { value: 'Drinks' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.getByText('That name is already taken.')).toBeInTheDocument())
  // Rename mode still open
  expect(screen.getByLabelText('Rename input for Snacks')).toBeInTheDocument()
  // Escape closes it
  fireEvent.keyDown(screen.getByLabelText('Rename input for Snacks'), { key: 'Escape' })
  expect(screen.queryByLabelText('Rename input for Snacks')).toBeNull()
})

// T8: Clicking Trash2 enters confirm-delete state; deleteConfirmText is shown; Yes, delete + Cancel buttons visible
test('clicking Trash2 enters confirm-delete state', () => {
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={noOp} deleteConfirmText="Items in this category will become uncategorised. Delete anyway?" />)
  fireEvent.click(screen.getByLabelText('Delete Snacks'))
  expect(screen.getByText('Items in this category will become uncategorised. Delete anyway?')).toBeInTheDocument()
  expect(screen.getByText('Yes, delete')).toBeInTheDocument()
  expect(screen.getByText('Cancel')).toBeInTheDocument()
})

// T9: Cancel in confirm-delete returns to view mode without calling onDelete
test('Cancel in confirm-delete returns to view mode', () => {
  const onDelete = vi.fn(async () => {})
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={onDelete} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Delete Snacks'))
  fireEvent.click(screen.getByText('Cancel'))
  expect(onDelete).not.toHaveBeenCalled()
  // Back to view mode
  expect(screen.getByLabelText('Rename Snacks')).toBeInTheDocument()
})

// T10: Yes, delete calls onDelete(id)
test('Yes, delete calls onDelete(id)', async () => {
  const onDelete = vi.fn(async () => {})
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={onDelete} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Delete Snacks'))
  fireEvent.click(screen.getByText('Yes, delete'))
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(5))
})

// T11: Delete failure with 403 shows "Default categories can't be deleted."
test('delete 403 error shows "Default categories can\'t be deleted."', async () => {
  const onDelete = vi.fn(async () => { throw new Error('API DELETE failed: 403') })
  render(<SettingsListItem entry={custom} locked={false} onRename={noOp} onDelete={onDelete} deleteConfirmText="x" />)
  fireEvent.click(screen.getByLabelText('Delete Snacks'))
  fireEvent.click(screen.getByText('Yes, delete'))
  await waitFor(() => expect(screen.getByText("Default categories can't be deleted.")).toBeInTheDocument())
})
