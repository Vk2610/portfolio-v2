import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const source = readFileSync(
        resolve('public', url.replace(/^\//, '')),
        'utf8',
      )
      return { ok: true, text: async () => source }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('application shell', () => {
  it('renders the hero and approved navigation anchors', () => {
    render(<App />)
    expect(
      screen.getByRole('main', { name: 'Portfolio application' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Vedant Kumbhar',
    )
    expect(screen.getByRole('link', { name: 'View Projects' })).toHaveAttribute(
      'href',
      '#work',
    )
    const navigation = within(
      screen.getByRole('navigation', { name: 'Primary' }),
    )
    expect(
      navigation.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual(['#about', '#stack', '#experience', '#work', '#contact'])
  })

  it('closes mobile navigation on Escape and link selection', () => {
    render(<App />)
    const toggle = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    fireEvent.click(toggle)
    const menu = screen.getByRole('navigation', { name: 'Mobile primary' })
    fireEvent.click(within(menu).getByRole('link', { name: 'Work' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the accessible alternative when native SVG is unavailable', async () => {
    vi.stubGlobal('SVGSVGElement', undefined)
    render(<App />)
    const network = screen.getByRole('figure', { name: /Technology network/ })
    expect(network).toHaveTextContent(/React, Node\.js/)
    expect(network).toHaveTextContent(/Next\.js, Pandas/)
    expect(network).toHaveTextContent(/VS Code, Postman, Figma/)
    await waitFor(() => {
      expect(network.querySelector('figcaption')).not.toHaveClass('sr-only')
    })
  })
  it('mounts 22 vector logos and 35 edges with keyboard controls and no Canvas', async () => {
    render(<App />)
    const network = screen.getByRole('figure', { name: /Technology network/ })
    await waitFor(() => {
      expect(network.querySelectorAll('svg svg > path')).toHaveLength(22)
      expect(within(network).getAllByRole('button')).toHaveLength(22)
    })
    expect(network.querySelectorAll('line')).toHaveLength(35)
    expect(network.querySelector('canvas')).toBeNull()
    expect(
      within(network).getByRole('button', { name: 'MySQL' }),
    ).toHaveAccessibleDescription()
  })
})
