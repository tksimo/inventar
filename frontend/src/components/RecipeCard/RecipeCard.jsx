import { ChevronRight } from 'lucide-react'
import styles from './RecipeCard.module.css'

/**
 * RecipeCard — single row in the Recipes page list.
 * UI-SPEC §Component Inventory → RecipeCard; §Interaction States.
 *
 * Props:
 *   recipe  RecipeListItem with id, name, ingredient_count
 *   onOpen  (recipe) => void — called on tap/click
 */
export default function RecipeCard({ recipe, onOpen }) {
  const count = recipe.ingredient_count ?? 0
  const label =
    count === 0 ? 'No ingredients added'
    : count === 1 ? '1 ingredient'
    : `${count} ingredients`
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onOpen(recipe)}
      aria-label={`Open ${recipe.name}`}
    >
      <div className={styles.text}>
        <span className={styles.name}>{recipe.name}</span>
        <span className={styles.sub}>{label}</span>
      </div>
      <ChevronRight size={16} aria-hidden="true" className={styles.chev} />
    </button>
  )
}
