import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  DecodeIdentifier,
  RevealHeading,
} from '@/components/common/TypographyEntrance'

const { reducedMotion } = vi.hoisted(() => ({ reducedMotion: vi.fn() }))

vi.mock('motion/react', () => ({ useReducedMotion: reducedMotion }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  reducedMotion.mockReset()
})

it('preserves semantic headings, exact text, and viewport activation', () => {
  reducedMotion.mockReturnValue(false)
  render(
    <RevealHeading id="example" className="type-h2">
      Where I've worked.
    </RevealHeading>,
  )
  const heading = screen.getByRole('heading', {
    level: 2,
    name: "Where I've worked.",
  })
  expect(heading.textContent).toBe("Where I've worked.")
  expect(heading).toHaveAttribute('data-reveal', 'true')
})

it('keeps the original accessible identifier while decoding and cleans up timers', () => {
  reducedMotion.mockReturnValue(false)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.useFakeTimers()
  const { container, unmount } = render(
    <DecodeIdentifier onMount className="type-mono">
      01 / INTRO
    </DecodeIdentifier>,
  )
  const visible = container.querySelector('[aria-hidden="true"]')
  expect(visible).toHaveTextContent('01 / AAAAA')
  expect(screen.getByText('01 / INTRO')).not.toHaveAttribute('aria-hidden')
  vi.advanceTimersByTime(550)
  expect(visible).toHaveTextContent('01 / INTRO')
  expect(vi.getTimerCount()).toBe(0)
  unmount()
  const pending = render(
    <DecodeIdentifier onMount className="type-mono">
      01 / INTRO
    </DecodeIdentifier>,
  )
  pending.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('renders final text immediately for reduced motion', () => {
  reducedMotion.mockReturnValue(true)
  vi.useFakeTimers()
  const { container } = render(
    <>
      <RevealHeading as="h1" id="name" className="type-hero">
        Vedant Kumbhar
      </RevealHeading>
      <DecodeIdentifier onMount className="type-mono">
        01 / INTRO
      </DecodeIdentifier>
    </>,
  )
  expect(
    screen.getByRole('heading', { level: 1, name: 'Vedant Kumbhar' }),
  ).toHaveAttribute('data-reveal', 'false')
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
    '01 / INTRO',
  )
  expect(vi.getTimerCount()).toBe(0)
})
