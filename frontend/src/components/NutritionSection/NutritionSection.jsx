import styles from './NutritionSection.module.css'

/**
 * NutritionSection — collapsible section rendered inside ItemDrawer for items
 * with Open Food Facts data (ITEM-07).
 *
 * Props:
 *   calories    number | null   per 100g, unit "kcal"
 *   protein     number | null   per 100g, unit "g"
 *   carbs       number | null   per 100g, unit "g"
 *   fat         number | null   per 100g, unit "g"
 *   imageUrl    string | null   product image
 *
 * Returns null (renders nothing) if all four nutrition values are null.
 * Per D-10: hidden entirely rather than shown as zeroes or dashes.
 * Per D-09: uses <dl>/<dt>/<dd> semantics for the nutrition pairs (not a <table>).
 * Rows are only rendered for non-null values.
 */
export default function NutritionSection({ calories, protein, carbs, fat, imageUrl }) {
  const hasNutrition =
    calories != null || protein != null || carbs != null || fat != null
  if (!hasNutrition) return null

  return (
    <div className={styles.section}>
      <p className={styles.heading}>Nutrition (per 100g)</p>
      {imageUrl && (
        <img className={styles.image} src={imageUrl} alt="" role="img" />
      )}
      <dl className={styles.dl}>
        {calories != null && (
          <>
            <dt className={styles.dt}>Calories</dt>
            <dd className={styles.dd}>{calories} kcal</dd>
          </>
        )}
        {protein != null && (
          <>
            <dt className={styles.dt}>Protein</dt>
            <dd className={styles.dd}>{protein} g</dd>
          </>
        )}
        {carbs != null && (
          <>
            <dt className={styles.dt}>Carbs</dt>
            <dd className={styles.dd}>{carbs} g</dd>
          </>
        )}
        {fat != null && (
          <>
            <dt className={styles.dt}>Fat</dt>
            <dd className={styles.dd}>{fat} g</dd>
          </>
        )}
      </dl>
    </div>
  )
}
