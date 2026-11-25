import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('application shell', () => {
  it('renders the empty portfolio application landmark', () => {
    render(<App />)
    expect(
      screen.getByRole('main', { name: 'Portfolio application' }),
    ).toBeInTheDocument()
  })
})
