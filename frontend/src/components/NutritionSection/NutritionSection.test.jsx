import { render, screen } from '@testing-library/react'
import NutritionSection from './NutritionSection.jsx'

describe('NutritionSection', () => {
  it('renders nothing when all values are null', () => {
    const { container } = render(
      <NutritionSection calories={null} protein={null} carbs={null} fat={null} imageUrl={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the heading when at least one value is present', () => {
    render(<NutritionSection calories={539} protein={null} carbs={null} fat={null} imageUrl={null} />)
    expect(screen.getByText('Nutrition (per 100g)')).toBeInTheDocument()
  })

  it('renders only rows that have non-null values', () => {
    render(<NutritionSection calories={539} protein={null} carbs={57.5} fat={null} imageUrl={null} />)
    expect(screen.getByText('Calories')).toBeInTheDocument()
    expect(screen.getByText('Carbs')).toBeInTheDocument()
    expect(screen.queryByText('Protein')).toBeNull()
    expect(screen.queryByText('Fat')).toBeNull()
  })

  it('renders values with units', () => {
    render(<NutritionSection calories={539} protein={6.3} carbs={57.5} fat={30.9} imageUrl={null} />)
    expect(screen.getByText('539 kcal')).toBeInTheDocument()
    expect(screen.getByText('6.3 g')).toBeInTheDocument()
    expect(screen.getByText('57.5 g')).toBeInTheDocument()
    expect(screen.getByText('30.9 g')).toBeInTheDocument()
  })

  it('renders product image when imageUrl is provided', () => {
    render(
      <NutritionSection
        calories={539}
        protein={null}
        carbs={null}
        fat={null}
        imageUrl="https://example.com/nutella.jpg"
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/nutella.jpg')
    expect(img).toHaveAttribute('alt', '')
  })

  it('omits the image when imageUrl is null', () => {
    render(<NutritionSection calories={539} protein={null} carbs={null} fat={null} imageUrl={null} />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
