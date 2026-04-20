import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
