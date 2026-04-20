import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/api.js', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '../lib/api.js'
import Recipes from './Recipes.jsx'

function respond(body, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('Recipes page', () => {
  beforeEach(() => { apiFetch.mockReset() })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows empty state when no recipes exist', async () => {
    apiFetch.mockImplementation(() => respond([]))
    render(<Recipes />)
    expect(await screen.findByText('No recipes yet')).toBeInTheDocument()
  })

  it('renders recipe cards from the API response', async () => {
    apiFetch.mockImplementation(() => respond([
      { id: 1, name: 'Pancakes', ingredient_count: 3,
        source_url: null, created_at: 'x', updated_at: 'x' },
      { id: 2, name: 'Soup', ingredient_count: 1,
        source_url: null, created_at: 'x', updated_at: 'x' },
    ]))
    render(<Recipes />)
    expect(await screen.findByText('Pancakes')).toBeInTheDocument()
    expect(screen.getByText('Soup')).toBeInTheDocument()
    expect(screen.getByText('3 ingredients')).toBeInTheDocument()
    expect(screen.getByText('1 ingredient')).toBeInTheDocument()
  })

  it('opens new recipe form on FAB click', async () => {
    apiFetch.mockImplementation(() => respond([]))
    render(<Recipes />)
    await screen.findByText('No recipes yet')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Add new recipe' }))
    expect(await screen.findByText('New Recipe')).toBeInTheDocument()
  })

  it('shows import input when Import URL is clicked', async () => {
    apiFetch.mockImplementation(() => respond([]))
    render(<Recipes />)
    await screen.findByText('No recipes yet')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Import recipe from URL' }))
    expect(await screen.findByLabelText('Recipe URL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })

  it('opens RecipeDetail when a card is tapped', async () => {
    // First call: list GET. Second call: detail GET for id=1.
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 1, name: 'Pancakes', ingredient_count: 3,
          source_url: null, created_at: 'x', updated_at: 'x' },
      ]))
      .mockImplementationOnce(() => respond({
        id: 1, name: 'Pancakes', instructions: 'Mix.', source_url: null,
        created_at: 'x', updated_at: 'x',
        ingredients: [
          { id: 10, name: 'Flour', quantity: 250, unit: 'g', item_id: null, sort_order: 0 },
        ],
      }))
    render(<Recipes />)
    const card = await screen.findByRole('button', { name: 'Open Pancakes' })
    const user = userEvent.setup()
    await user.click(card)
    expect(await screen.findByRole('button', { name: 'Back to recipes' })).toBeInTheDocument()
    expect(screen.getByText('Mix.')).toBeInTheDocument()
    expect(screen.getByText('Flour')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check ingredients' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cook recipe' })).toBeInTheDocument()
  })

  it('opens RecipeCheckSheet when Check ingredients is tapped', async () => {
    const user = userEvent.setup()
    apiFetch
      // mount list
      .mockImplementationOnce(() => respond([
        { id: 1, name: 'Pancakes', ingredient_count: 2,
          source_url: null, created_at: 'x', updated_at: 'x' },
      ]))
      // detail
      .mockImplementationOnce(() => respond({
        id: 1, name: 'Pancakes', instructions: null, source_url: null,
        created_at: 'x', updated_at: 'x',
        ingredients: [
          { id: 10, name: 'Flour', quantity: 250, unit: 'g', item_id: 5, sort_order: 0 },
          { id: 11, name: 'Milk',  quantity: 300, unit: 'ml', item_id: null, sort_order: 1 },
        ],
      }))
      // check
      .mockImplementationOnce(() => respond({
        recipe_id: 1,
        missing_count: 1,
        ingredients: [
          { ingredient_id: 10, name: 'Flour', quantity: 250, unit: 'g',
            item_id: 5, matched_item_name: 'Flour', status: 'have', unit_mismatch: false },
          { ingredient_id: 11, name: 'Milk', quantity: 300, unit: 'ml',
            item_id: null, matched_item_name: null, status: 'missing', unit_mismatch: false },
        ],
      }))
    render(<Recipes />)
    await user.click(await screen.findByRole('button', { name: 'Open Pancakes' }))
    await screen.findByRole('button', { name: 'Check ingredients' })
    await user.click(screen.getByRole('button', { name: 'Check ingredients' }))
    // Sheet dialog is open with correct role
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // Status icons have accessible labels (only appear inside the sheet)
    expect(screen.getByLabelText('Have enough')).toBeInTheDocument()
    expect(screen.getByLabelText('Missing')).toBeInTheDocument()
    // "Add missing to list" button is enabled (missing_count > 0)
    const addBtn = screen.getByRole('button', { name: 'Add missing to list' })
    expect(addBtn).not.toBeDisabled()
  })

  it('disables Add-missing button when no ingredients are missing', async () => {
    const user = userEvent.setup()
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 1, name: 'OK', ingredient_count: 1,
          source_url: null, created_at: 'x', updated_at: 'x' },
      ]))
      .mockImplementationOnce(() => respond({
        id: 1, name: 'OK', instructions: null, source_url: null,
        created_at: 'x', updated_at: 'x',
        ingredients: [{ id: 10, name: 'Water', quantity: 1, unit: 'L', item_id: 2, sort_order: 0 }],
      }))
      .mockImplementationOnce(() => respond({
        recipe_id: 1,
        missing_count: 0,
        ingredients: [
          { ingredient_id: 10, name: 'Water', quantity: 1, unit: 'L',
            item_id: 2, matched_item_name: 'Water', status: 'have', unit_mismatch: false },
        ],
      }))
    render(<Recipes />)
    await user.click(await screen.findByRole('button', { name: 'Open OK' }))
    await user.click(await screen.findByRole('button', { name: 'Check ingredients' }))
    const btn = await screen.findByRole('button', { name: 'All ingredients available — nothing to add' })
    expect(btn).toBeDisabled()
  })

  it('opens CookConfirmSheet and submits correct deductions', async () => {
    const user = userEvent.setup()
    apiFetch
      .mockImplementationOnce(() => respond([
        { id: 1, name: 'Pancakes', ingredient_count: 2,
          source_url: null, created_at: 'x', updated_at: 'x' },
      ]))
      .mockImplementationOnce(() => respond({
        id: 1, name: 'Pancakes', instructions: null, source_url: null,
        created_at: 'x', updated_at: 'x',
        ingredients: [
          { id: 10, name: 'Flour', quantity: 250, unit: 'g', item_id: 5, sort_order: 0 },
          { id: 11, name: 'Salt',  quantity: 1,   unit: null, item_id: null, sort_order: 1 },
        ],
      }))
      .mockImplementationOnce(() => respond({
        recipe_id: 1,
        missing_count: 0,
        ingredients: [
          // Unit-mismatch → pre-fill 1
          { ingredient_id: 10, name: 'Flour', quantity: 250, unit: 'g',
            item_id: 5, matched_item_name: 'Flour', status: 'low', unit_mismatch: true },
          // Unlinked → greyed out
          { ingredient_id: 11, name: 'Salt', quantity: 1, unit: null,
            item_id: null, matched_item_name: null, status: 'missing', unit_mismatch: false },
        ],
      }))
      .mockImplementationOnce(() => respond({ ok: true, deducted: 1, recipe_id: 1 }))
      // refetch after cook (useRecipes.cook calls refetch)
      .mockImplementationOnce(() => respond([
        { id: 1, name: 'Pancakes', ingredient_count: 2,
          source_url: null, created_at: 'x', updated_at: 'x' },
      ]))
      // getDetail refresh after cook
      .mockImplementationOnce(() => respond({
        id: 1, name: 'Pancakes', instructions: null, source_url: null,
        created_at: 'x', updated_at: 'x',
        ingredients: [
          { id: 10, name: 'Flour', quantity: 249, unit: 'g', item_id: 5, sort_order: 0 },
          { id: 11, name: 'Salt',  quantity: 1,   unit: null, item_id: null, sort_order: 1 },
        ],
      }))
    render(<Recipes />)
    await user.click(await screen.findByRole('button', { name: 'Open Pancakes' }))
    await user.click(await screen.findByRole('button', { name: 'Cook recipe' }))
    // Flour row present as matched (spinbutton), Salt row shown as skipped
    await screen.findByRole('spinbutton')
    expect(screen.getByText(/not in inventory — skipped/)).toBeInTheDocument()
    // Confirm submits deductions
    await user.click(screen.getByRole('button', { name: 'Cook & deduct' }))
    await waitFor(() => {
      const cookCall = apiFetch.mock.calls.find(([path, init]) =>
        typeof path === 'string' && path.endsWith('/cook') && init?.method === 'POST')
      expect(cookCall).toBeTruthy()
      const body = JSON.parse(cookCall[1].body)
      expect(body.deductions).toHaveLength(1)
      expect(body.deductions[0].ingredient_id).toBe(10)
      expect(body.deductions[0].item_id).toBe(5)
      // pre-fill was 1 due to unit_mismatch
      expect(body.deductions[0].amount).toBe(1)
    })
  })
})
