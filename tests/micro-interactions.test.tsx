import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TechnologyStack } from '@/sections/TechnologyStack'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

vi.mock('@/features/technology-network/network-svg-renderer', () => ({
  loadTechnologyIcon: async () => null,
}))

afterEach(cleanup)

it('keeps the primary CTA label, destination, and native button controls', () => {
  const activate = vi.fn()
  render(
    <>
      <ButtonLink href="#work">View Projects</ButtonLink>
      <Button onClick={activate}>Preview</Button>
      <Button disabled onClick={activate}>
        Unavailable
      </Button>
    </>,
  )
  const link = screen.getByRole('link', { name: 'View Projects' })
  expect(link).toHaveAttribute('href', '#work')
  expect(link.querySelectorAll('.primary-cta-content')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  expect(activate).toHaveBeenCalledTimes(1)
})

it('transfers pointer emphasis within one category and restores it on exit', () => {
  render(<TechnologyStack />)
  const react = screen.getByRole('button', { name: 'React' })
  const html = screen.getByRole('button', { name: 'HTML5' })
  const css = screen.getByRole('button', { name: 'CSS3' })
  fireEvent.pointerOver(react, { pointerType: 'mouse' })
  expect(react).toHaveAttribute('data-emphasis', 'active')
  expect(html).toHaveAttribute('data-emphasis', 'dimmed')
  fireEvent.pointerOut(react, { pointerType: 'mouse', relatedTarget: html })
  fireEvent.pointerOver(html, { pointerType: 'mouse', relatedTarget: react })
  expect(html).toHaveAttribute('data-emphasis', 'active')
  expect(react).toHaveAttribute('data-emphasis', 'dimmed')
  expect(css).toHaveAttribute('data-emphasis', 'dimmed')
  fireEvent.pointerOut(html, {
    pointerType: 'mouse',
    relatedTarget: document.body,
  })
  expect(react).toHaveAttribute('data-emphasis', 'normal')
  expect(html).toHaveAttribute('data-emphasis', 'normal')
})

it('opens one touch tooltip at a time and clears it on category switch', async () => {
  render(<TechnologyStack />)
  const react = screen.getByRole('button', { name: 'React' })
  const html = screen.getByRole('button', { name: 'HTML5' })
  const tap = (target: HTMLElement) => {
    fireEvent.pointerDown(target, { pointerType: 'touch' })
    fireEvent.pointerUp(target, { pointerType: 'touch' })
    fireEvent.click(target, { detail: 1 })
  }

  tap(react)
  expect(
    await screen.findByRole('tooltip', {
      name: 'UI library. Component-based user interfaces.',
    }),
  ).toBeInTheDocument()
  expect(html).toHaveAttribute('data-emphasis', 'dimmed')
  tap(html)
  expect(
    await screen.findByRole('tooltip', {
      name: 'Markup language. Semantic web content.',
    }),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  expect(html).toHaveAttribute('data-emphasis', 'active')
  fireEvent.click(screen.getByRole('tab', { name: 'Backend' }))
  expect(screen.queryByRole('tooltip')).toBeNull()
  expect(screen.getByRole('button', { name: 'Node.js' })).toHaveAttribute(
    'data-emphasis',
    'normal',
  )
})
