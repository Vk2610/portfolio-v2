import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { projects, selectProjects } from '../src/data/projects'
import { SelectedProjects } from '../src/sections/SelectedProjects'

const { reducedMotion } = vi.hoisted(() => ({
  reducedMotion: vi.fn(() => false),
}))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: reducedMotion,
}))

afterEach(() => {
  cleanup()
  reducedMotion.mockReturnValue(false)
})

it('validates ranks and IDs and derives visible featured and archive collections', () => {
  expect(
    selectProjects([...projects].reverse()).featured.map(
      (project) => project.id,
    ),
  ).toEqual(['rkky', 'miro', 'cattle'])
  expect(() => selectProjects([...projects, projects[0]])).toThrow(
    'Duplicate project ID',
  )
  expect(() =>
    selectProjects([...projects, { ...projects[0], id: 'other' }]),
  ).toThrow('featured rank')
  const result = selectProjects([
    { ...projects[0], visible: false },
    { ...projects[1], featuredRank: undefined },
  ])
  expect(result.featured).toHaveLength(0)
  expect(result.archive).toHaveLength(1)
})

it('replaces interrupted covers without stacking layers and restores the committed preview', () => {
  const { getByRole } = render(<SelectedProjects />)
  const index = getByRole('group', { name: 'Featured project index' })
  const panel = document.getElementById('project-preview')!
  const layers = () =>
    Array.from(
      panel.querySelectorAll<HTMLElement>('[data-project-cover-layer]'),
    )
  const ids = () => layers().map((layer) => layer.dataset.projectCoverLayer)
  const miro = within(index).getByRole('button', { name: /Miro Clone/ })
  const cattle = within(index).getByRole('button', { name: /Cattle Breed/ })
  const endReveal = (incoming: HTMLElement) => {
    // React uses the prefixed event when jsdom lacks AnimationEvent.
    const eventType =
      typeof window.AnimationEvent === 'function'
        ? 'animationend'
        : 'webkitAnimationEnd'
    fireEvent(
      incoming,
      Object.assign(new Event(eventType, { bubbles: true }), {
        animationName: 'project-cover-reveal',
      }),
    )
  }
  const complete = () => {
    const incoming = layers().at(-1)!
    fireEvent.load(incoming.querySelector('img')!)
    expect(incoming).toHaveAttribute('data-ready', 'true')
    endReveal(incoming)
  }

  fireEvent.click(miro)
  expect(ids()).toEqual(['rkky', 'miro'])
  const interrupted = layers()[1]
  fireEvent.load(interrupted.querySelector('img')!)
  fireEvent.focus(cattle)
  endReveal(interrupted)
  expect(ids()).toEqual(['rkky', 'cattle'])
  expect(layers()[0]).toHaveAttribute('aria-hidden', 'true')
  expect(within(panel).queryByRole('link', { name: /Miro/i })).toBeNull()
  complete()
  expect(ids()).toEqual(['cattle'])

  fireEvent.mouseLeave(index)
  expect(ids()).toEqual(['cattle', 'miro'])
  expect(
    within(panel).getByRole('heading', { name: 'Miro Clone' }),
  ).toBeInTheDocument()
  expect(miro).toHaveAttribute('aria-pressed', 'true')
  complete()
  expect(ids()).toEqual(['miro'])
})

it('changes covers immediately with reduced motion', () => {
  reducedMotion.mockReturnValue(true)
  const { getByRole } = render(<SelectedProjects />)
  const index = getByRole('group', { name: 'Featured project index' })
  fireEvent.click(within(index).getByRole('button', { name: /Miro Clone/ }))
  const panel = document.getElementById('project-preview')!
  expect(panel.querySelectorAll('[data-project-cover-layer]')).toHaveLength(1)
  expect(
    panel.querySelector('[data-project-cover-layer="miro"]'),
  ).not.toHaveAttribute('data-ready')
})

it('opens the first accordion and allows single-open and collapsed states', () => {
  render(<SelectedProjects />)
  // Desktop index and mobile accordion share the same catalog.
  const first = document.getElementById('project-trigger-rkky')!
  const second = document.getElementById('project-trigger-miro')!
  expect(first).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(second)
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(second).toHaveAttribute('aria-expanded', 'true')
  const panel = document.getElementById('project-panel-miro')!
  expect(within(panel).getByText(/integrated live chat/)).toBeInTheDocument()
  expect(
    within(panel).getByRole('link', { name: /live demo/i }),
  ).toHaveAttribute('href', projects[1].liveUrl)
  fireEvent.click(second)
  expect(second).toHaveAttribute('aria-expanded', 'false')
})

it('keeps desktop links in the preview and shows only available links', async () => {
  const { getByRole } = render(<SelectedProjects />)
  const index = getByRole('group', { name: 'Featured project index' })
  const panel = within(document.getElementById('project-preview')!)
  const first = within(index).getByRole('button', { name: /Rayat Kutumb/ })
  const cattle = within(index).getByRole('button', { name: /Cattle Breed/ })
  expect(panel.getByRole('link', { name: /live demo/i })).toHaveAttribute(
    'href',
    projects[0].liveUrl,
  )
  expect(within(index).queryByRole('link')).toBeNull()

  fireEvent.focus(cattle)
  const source = await panel.findByRole('link', {
    name: /source code for cattle breed detector/i,
  })
  expect(source).toHaveAttribute('href', projects[2].repositoryUrl)
  expect(panel.queryByRole('link', { name: /live demo/i })).toBeNull()
  fireEvent.blur(cattle, { relatedTarget: source })
  expect(source).toHaveAttribute('href', projects[2].repositoryUrl)
  expect(first).toHaveAttribute('aria-pressed', 'true')

  fireEvent.blur(source)
  expect(
    await panel.findByRole('link', { name: /live demo/i }),
  ).toHaveAttribute('href', projects[0].liveUrl)
})
