import { ChevronLeft, Pencil } from 'lucide-react'
import styles from './RecipeDetail.module.css'

/**
 * RecipeDetail — full-page view (not a drawer).
 * Props:
 *   recipe   RecipeResponse
 *   onBack   () => void
 *   onEdit   () => void
 *   onCheck  () => void   (opens RecipeCheckSheet — Plan 05)
 *   onCook   () => void   (opens CookConfirmSheet — Plan 05)
 */
export default function RecipeDetail({ recipe, onBack, onEdit, onCheck, onCook }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Back to recipes"
          onClick={onBack}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className={styles.title}>{recipe.name}</h1>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Edit ${recipe.name}`}
          onClick={onEdit}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.body}>
        {recipe.instructions && (
          <p className={styles.instructions}>{recipe.instructions}</p>
        )}
        <span className={styles.sectionLabel}>Ingredients</span>
        <ul className={styles.ingredients}>
          {recipe.ingredients.map((ing) => (
            <li key={ing.id} className={styles.ingredientRow}>
              {ing.item_id != null && (
                <span className={styles.linkDot} aria-label="Linked to inventory" />
              )}
              <span className={styles.ingName}>{ing.name}</span>
              {(ing.quantity != null || ing.unit) && (
                <span className={styles.ingQty}>
                  {ing.quantity ?? ''}{ing.unit ? ` ${ing.unit}` : ''}
                </span>
              )}
            </li>
          ))}
          {recipe.ingredients.length === 0 && (
            <li className={styles.empty}>No ingredients</li>
          )}
        </ul>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.check}
          onClick={onCheck}
        >
          Check ingredients
        </button>
        <button
          type="button"
          className={styles.cook}
          onClick={onCook}
        >
          Cook recipe
        </button>
      </div>
    </div>
  )
}
