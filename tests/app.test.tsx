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
import { useReducedMotion } from 'motion/react'
import App from '../src/App'
import { profile } from '../src/data/profile'
import { technologyCategories } from '../src/data/technology-categories'
import { technologies } from '../src/data/technologies'

vi.mock('motion/react', { spy: true })

beforeEach(() => {
  // JSDOM does not load the Tailwind stylesheet through the app entry point.
  document.documentElement.style.setProperty('--duration-fast', '150ms')
  document.documentElement.style.setProperty('--duration-moderate', '400ms')
  document.documentElement.style.setProperty('--stagger', '80ms')
  document.documentElement.style.setProperty(
    '--ease-entrance',
    'cubic-bezier(0.22, 1, 0.36, 1)',
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
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
  document.documentElement.removeAttribute('style')
  vi.restoreAllMocks()
  vi.mocked(useReducedMotion).mockReset()
  vi.unstubAllGlobals()
})

describe('application shell', () => {
  it('links to five stack categories with every original SVG and catalog description', async () => {
    render(<App />)
    const stack = screen.getByRole('region', { name: 'My toolkit.' })
    expect(stack.id).toBe('stack')
    for (const navigation of ['Primary', 'Mobile primary']) {
      expect(
        within(screen.getByRole('navigation', { name: navigation })).getByRole(
          'link',
          { name: 'Stack' },
        ),
      ).toHaveAttribute('href', '#stack')
    }
    const tabs = within(stack).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Frontend',
      'Backend',
      'Database',
      'Languages',
      'Tools & Others',
    ])
    expect(within(stack).getByRole('tab', { selected: true })).toBe(tabs[0])
    expect(
      within(stack).getByText(
        `${technologies.length} TECHNOLOGIES / 05 CATEGORIES`,
      ),
    ).toBeInTheDocument()
    for (const [index, category] of technologyCategories.entries()) {
      const tab = tabs[index]
      if (index !== 0) fireEvent.click(tab)
      expect(within(stack).getByRole('tab', { selected: true })).toBe(tab)
      expect(tab).toHaveClass(
        'underline-reveal',
        'aria-selected:text-foreground',
      )
      expect(tab.querySelector('[data-underline-label]')).toHaveTextContent(
        category.label,
      )
      const panel = within(stack).getByRole('tabpanel', {
        name: category.label,
      })
      const expectedCount = [6, 3, 3, 4, 7][index]
      expect(
        within(panel).getByText(`${expectedCount} TECHNOLOGIES`),
      ).toBeInTheDocument()
      const list = await within(panel).findByRole('list', {
        name: category.label,
      })
      expect(within(list).getAllByRole('button')).toHaveLength(expectedCount)
      await waitFor(
        () => {
          expect(list.querySelectorAll('button svg path')).toHaveLength(
            expectedCount,
          )
          for (const tile of within(list).getAllByRole('listitem')) {
            expect(Number(getComputedStyle(tile).opacity || 1)).toBe(1)
            expect(tile).toBeVisible()
          }
        },
        { timeout: 2000 },
      )
      for (const technology of category.technologies) {
        const button = within(list).getByRole('button', {
          name: technology.label,
        })
        expect(button).toHaveAccessibleDescription(technology.description)
        if (technology.id === 'sql') {
          const sqlIcon = button.querySelector('svg[data-sql-database-search]')
          expect(sqlIcon).toBeInTheDocument()
          expect(sqlIcon?.querySelector('path')).toBeInTheDocument()
          expect(sqlIcon).toHaveClass('size-9', 'fill-none', 'stroke-current')
          continue
        }
        const original = new DOMParser().parseFromString(
          readFileSync(resolve('public', technology.iconPath), 'utf8'),
          'image/svg+xml',
        ).documentElement
        const svg = button.querySelector('svg')!
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
        expect(svg).toHaveAttribute('viewBox', original.getAttribute('viewBox'))
        expect(svg).toHaveAttribute('width', '36')
        expect(svg).toHaveAttribute('height', '36')
        expect(svg.childNodes).toHaveLength(original.childNodes.length)
        Array.from(svg.childNodes).forEach((node, index) => {
          expect(node.isEqualNode(original.childNodes[index])).toBe(true)
        })
        // The current sources have no internal IDs, so Hero and tile clones can coexist.
        expect(svg.matches('[id]') || svg.querySelector('[id]')).toBeFalsy()
      }
    }
  })

  it('settles on the latest category after rapid keyboard and pointer selection', async () => {
    render(<App />)
    const tablist = screen.getByRole('tablist', {
      name: 'Technology categories',
    })
    const [frontend, backend, database, languages, tools] =
      within(tablist).getAllByRole('tab')
    frontend.focus()
    fireEvent.keyDown(frontend, { key: 'ArrowRight' })
    expect(backend).toHaveFocus()
    fireEvent.click(languages)
    fireEvent.click(database)
    fireEvent.click(tools)
    expect(tools).toHaveAttribute('aria-selected', 'true')
    const list = await screen.findByRole('list', { name: 'Tools & Others' })
    expect(within(list).getAllByRole('button')).toHaveLength(7)
    expect(
      within(list).getByRole('button', { name: 'Git' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('tabpanel')).queryByRole('button', {
        name: 'MySQL',
      }),
    ).toBeNull()
  })

  it('shows the newly selected grid immediately with reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    render(<App />)
    for (const category of technologyCategories) {
      fireEvent.click(screen.getByRole('tab', { name: category.label }))
      const panel = screen.getByRole('tabpanel', { name: category.label })
      const list = within(panel).getByRole('list', { name: category.label })
      expect(within(list).getAllByRole('button')).toHaveLength(
        category.technologies.length,
      )
      for (const tile of within(list).getAllByRole('listitem')) {
        expect(Number(getComputedStyle(tile).opacity || 1)).toBe(1)
        expect(tile).toBeVisible()
      }
    }
  })

  it('opens a tile tooltip on focus and tap activation and dismisses on Escape', async () => {
    render(<App />)
    const stack = screen.getByRole('region', { name: 'My toolkit.' })
    const tile = within(stack).getByRole('button', { name: 'React' })
    const description = technologies[0].description
    fireEvent.focus(tile)
    expect(
      await screen.findByRole('tooltip', { name: description }),
    ).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    const tap = () => {
      fireEvent.pointerDown(tile, { pointerType: 'touch' })
      fireEvent.pointerUp(tile, { pointerType: 'touch' })
      fireEvent.click(tile, { detail: 1 })
    }
    tap()
    expect(
      await screen.findByRole('tooltip', { name: description }),
    ).toBeInTheDocument()
    tap()
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })

  it('renders the hero and approved navigation anchors', () => {
    const { container } = render(<App />)
    const backgrounds = container.querySelectorAll(
      'canvas[data-particle-background]',
    )
    expect(backgrounds).toHaveLength(1)
    expect(backgrounds[0]).toHaveAttribute('aria-hidden', 'true')
    expect(backgrounds[0]).toHaveClass('pointer-events-none')
    expect(
      screen.getByRole('main', { name: 'Portfolio application' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Vedant Kumbhar',
    )
    expect(
      screen.getByRole('region', { name: 'Professional status' }),
    ).toHaveTextContent(profile.location)
    expect(screen.getByText('02 / ABOUT ME')).toHaveClass(
      'type-mono',
      'text-muted',
    )
    expect(screen.queryByRole('heading', { name: 'ABOUT ME' })).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'A developer across the stack.' }),
    ).toHaveProperty('tagName', 'H2')
    expect(screen.getByText('Technologies showcased')).toBeInTheDocument()
    expect(document.getElementById('about')).toBeInTheDocument()
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
