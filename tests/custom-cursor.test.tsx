import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomCursor } from '@/features/custom-cursor/CustomCursor'
import { resolveCursorVariant } from '@/features/custom-cursor/cursorConfig'

function mockMatchMedia(options: {
  finePointer: boolean
  reducedMotion: boolean
}) {
  const listeners = new Map<string, Set<() => void>>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const matches = query.includes('prefers-reduced-motion')
        ? options.reducedMotion
        : options.finePointer
      return {
        matches,
        media: query,
        addEventListener: (_: string, cb: () => void) => {
          if (!listeners.has(query)) listeners.set(query, new Set())
          listeners.get(query)?.add(cb)
        },
        removeEventListener: (_: string, cb: () => void) => {
          listeners.get(query)?.delete(cb)
        },
        dispatchEvent: () => true,
      }
    }),
  )
}

describe('custom cursor system', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-custom-cursor')
    document.documentElement.removeAttribute('data-cursor-native')
  })

  it('resolves cursor variants for interactive, heading, text, and network targets', () => {
    const button = document.createElement('button')
    const link = document.createElement('a')
    link.href = 'https://example.com'
    link.target = '_blank'
    const heading = document.createElement('h1')
    heading.dataset.cursor = 'heading'
    const paragraph = document.createElement('p')
    const input = document.createElement('input')
    const network = document.createElement('figure')
    network.dataset.cursor = 'network'
    const plain = document.createElement('div')

    expect(resolveCursorVariant(button)).toBe('button')
    expect(resolveCursorVariant(link)).toBe('nav')
    expect(resolveCursorVariant(heading)).toBe('heading')
    expect(resolveCursorVariant(paragraph)).toBe('heading')
    expect(resolveCursorVariant(input)).toBe('text')
    expect(resolveCursorVariant(network)).toBe('network')
    expect(resolveCursorVariant(plain)).toBe('default')

    const linkInParagraph = document.createElement('a')
    linkInParagraph.href = '#about'
    paragraph.appendChild(linkInParagraph)
    expect(resolveCursorVariant(linkInParagraph)).toBe('nav')
  })

  it('disables custom cursor on coarse-pointer or reduced-motion devices', () => {
    mockMatchMedia({ finePointer: false, reducedMotion: false })
    const { container: coarseContainer, unmount: unmountCoarse } = render(
      <CustomCursor />,
    )
    expect(coarseContainer.firstChild).toBeNull()
    expect(document.documentElement.hasAttribute('data-custom-cursor')).toBe(
      false,
    )
    unmountCoarse()

    mockMatchMedia({ finePointer: true, reducedMotion: true })
    const { container: reducedContainer } = render(<CustomCursor />)
    expect(reducedContainer.firstChild).toBeNull()
    expect(document.documentElement.hasAttribute('data-custom-cursor')).toBe(
      false,
    )
  })

  it('tracks pointer, handles press compression, yields to network, and cleans up', () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false })
    const { container, unmount } = render(
      <div>
        <CustomCursor />
        <button type="button">Action</button>
        <a href="#target">Link</a>
        <figure data-cursor="network">Network</figure>
      </div>,
    )

    expect(document.documentElement.getAttribute('data-custom-cursor')).toBe(
      'active',
    )

    const root = container.querySelector('.custom-cursor-root') as HTMLElement
    const button = container.querySelector('button') as HTMLElement
    const network = container.querySelector('figure') as HTMLElement

    fireEvent.pointerMove(button, {
      clientX: 120,
      clientY: 240,
      pointerType: 'mouse',
    })
    expect(root.style.transform).toBe('translate3d(120px, 240px, 0px)')
    expect(root.dataset.variant).toBe('button')
    expect(root.dataset.visible).toBe('false')
    expect(document.documentElement.getAttribute('data-cursor-native')).toBe(
      'true',
    )

    const link = container.querySelector('a') as HTMLElement
    fireEvent.pointerMove(link, {
      clientX: 121,
      clientY: 241,
      pointerType: 'mouse',
    })
    expect(root.dataset.variant).toBe('nav')
    expect(root.dataset.visible).toBe('false')
    expect(document.documentElement.getAttribute('data-cursor-native')).toBe(
      'true',
    )

    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    expect(root.dataset.pressed).toBe('true')
    fireEvent.pointerUp(button)
    expect(root.dataset.pressed).toBe('false')

    fireEvent.pointerMove(network, {
      clientX: 300,
      clientY: 320,
      pointerType: 'mouse',
    })
    expect(root.dataset.variant).toBe('network')
    expect(root.dataset.visible).toBe('false')
    expect(document.documentElement.getAttribute('data-cursor-native')).toBe(
      'true',
    )

    unmount()
    expect(document.documentElement.hasAttribute('data-custom-cursor')).toBe(
      false,
    )
    expect(document.documentElement.hasAttribute('data-cursor-native')).toBe(
      false,
    )
  })
})
