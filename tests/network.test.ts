import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  networkConnections,
  networkVisual,
  technologyNodes,
} from '../src/features/technology-network/network-config'
import {
  createNetworkEngine,
  layoutNetwork,
  packetOpacity,
  packetProgress,
  projectNode,
  projectPacket,
} from '../src/features/technology-network/network-engine'
import {
  clampCenter,
  clientToNetwork,
  createNetworkInteractions,
  hitNode,
  magneticTarget,
} from '../src/features/technology-network/network-interactions'

describe('network pointer geometry', () => {
  it('preserves the grabbed point on a touch drag and releases capture on cleanup', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<svg></svg><button data-network-node></button><div hidden><strong></strong><span></span></div>'
    const button = root.querySelector('button')!
    const svg = root.querySelector('svg')!
    Object.defineProperty(svg, 'getScreenCTM', {
      value: () => ({
        a: 2,
        b: 0,
        c: 0,
        d: 2,
        inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -25, f: -40 }),
      }),
    })
    button.setPointerCapture = vi.fn()
    button.hasPointerCapture = vi.fn(() => true)
    button.releasePointerCapture = vi.fn()
    const node = layoutNetwork(568, 544)[0]
    const { x, y } = node.base
    const control = createNetworkInteractions(
      root,
      svg,
      root.querySelector('div')!,
      vi.fn(),
    )
    const dispatch = (type: string, clientX: number, clientY: number) => {
      button.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
          pointerId: 7,
          pointerType: 'touch',
          button: 0,
          clientX: 2 * clientX + 50,
          clientY: 2 * clientY + 80,
        }),
      )
    }
    control.setActive(true, true)
    control.update([node], 568, 544, 16)
    dispatch('pointerdown', x + 5, y + 3)
    dispatch('pointermove', x + 25, y + 13)
    control.update([node], 568, 544, 16)
    expect(node.projected).toEqual({ x: x + 20, y: y + 10 })
    dispatch('pointerup', x + 25, y + 13)
    expect(node.dragOffset).toEqual({ x: 20, y: 10 })
    dispatch('pointerdown', x + 20, y + 10)
    control.destroy()
    expect(button.releasePointerCapture).toHaveBeenCalledTimes(2)
  })

  it('maps client coordinates through a translated, scaled SVG screen matrix', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    Object.defineProperty(svg, 'getScreenCTM', {
      value: () => ({
        a: 2,
        b: 0,
        c: 0,
        d: 2,
        inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -25, f: -40 }),
      }),
    })
    expect(clientToNetwork(svg, 130, 140, 288, 256)).toEqual({ x: 40, y: 30 })
  })

  it('projects into an aspect-ratio preserving viewBox without a screen matrix', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 30,
      top: 40,
      width: 400,
      height: 200,
    } as DOMRect)
    expect(clientToNetwork(svg, 170, 100, 100, 100)).toEqual({ x: 20, y: 30 })
  })

  it('hits rendered nodes and retains hover near a moving boundary', () => {
    const [node] = layoutNetwork(568, 544)
    const { x, y } = node.projected
    expect(hitNode([node], { x, y })).toBe(0)
    const near = { x: x + node.radius + 4, y }
    expect(hitNode([node], near)).toBe(-1)
    expect(hitNode([node], near, 0)).toBe(0)
  })

  it('bounds diagonal attraction and clamps drag centres inside the margin', () => {
    const delta = magneticTarget(Math.hypot(60, 60), 60)
    expect(Math.hypot(delta, delta)).toBeCloseTo(7)
    expect(clampCenter(-10, 200, 30)).toBe(30)
    expect(clampCenter(201, 200, 30)).toBe(170)
    expect(clampCenter(10, 40, 30)).toBe(20)
  })
})

describe('technology network rendering', () => {
  it('renders stable native SVG elements, preserves logo fallback and pauses animation', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const logo = document.createElementNS(
      svg.namespaceURI,
      'svg',
    ) as SVGSVGElement
    logo.setAttribute('viewBox', '0 0 24 24')
    logo.append(document.createElementNS(svg.namespaceURI, 'path'))
    const requestFrame = vi.fn().mockReturnValue(42)
    const cancelFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)

    try {
      const engine = createNetworkEngine(svg)!
      engine.resize(288, 256)
      expect(svg.getAttribute('viewBox')).toBe('0 0 288 256')
      expect(svg.querySelectorAll('canvas')).toHaveLength(0)
      engine.setIcons(
        technologyNodes.map((_, index) => (index === 0 ? null : logo)),
      )

      engine.setPlayback(true, true)
      expect(svg.querySelectorAll('line')).toHaveLength(35)
      expect(
        svg.querySelectorAll('[data-network-glyph] > circle'),
      ).toHaveLength(22)
      expect(svg.querySelectorAll('svg > path')).toHaveLength(21)
      expect(svg.querySelector('text')?.textContent).toBe('Re')
      const packets = svg.querySelector<SVGGElement>('[data-network-packets]')!
      expect(packets.style.display).toBe('none')
      expect(requestFrame).not.toHaveBeenCalled()

      const firstLine = svg.querySelector('line')
      engine.resize(358, 256)
      expect(svg.getAttribute('viewBox')).toBe('0 0 358 256')
      engine.resize(288, 256)
      engine.setPlayback(true, false)
      expect(packets.style.display).toBe('')
      expect(packets.children).toHaveLength(35)
      expect(
        Array.from(packets.children).every((packet) =>
          packet.hasAttribute('cx'),
        ),
      ).toBe(true)
      expect(svg.querySelector('line')).toBe(firstLine)
      expect(requestFrame).toHaveBeenCalledTimes(1)
      engine.setPlayback(false, false)
      expect(cancelFrame).toHaveBeenCalledWith(42)
      expect(requestFrame).toHaveBeenCalledTimes(1)

      engine.setPlayback(true, false)
      engine.destroy()
      expect(svg.childElementCount).toBe(0)
      expect(cancelFrame).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('technology network configuration', () => {
  it('includes the approved 22 technologies by tier and their normalized local logos', () => {
    expect(technologyNodes).toHaveLength(22)
    expect(new Set(technologyNodes.map(({ id }) => id)).size).toBe(22)
    const group = (tier: (typeof technologyNodes)[number]['tier']) =>
      technologyNodes
        .filter((node) => node.tier === tier)
        .map(({ label }) => label)
    expect(group('primary')).toEqual(['React', 'Node.js'])
    expect(group('core')).toEqual([
      'JavaScript',
      'TypeScript',
      'Express.js',
      'MongoDB',
      'MySQL',
      'PostgreSQL',
      'Tailwind CSS',
      'GitHub',
      'Vercel',
      'Python',
    ])
    expect(group('supporting')).toEqual([
      'HTML5',
      'CSS3',
      'Bootstrap',
      'Next.js',
      'Pandas',
      'Firebase',
      'Git',
      'VS Code',
      'Postman',
      'Figma',
    ])
    for (const { id, iconPath } of technologyNodes) {
      expect(iconPath).toBe(`icons/technologies/${id}.svg`)
      const svg = readFileSync(resolve('public', iconPath), 'utf8')
      const root = new DOMParser().parseFromString(
        svg,
        'image/svg+xml',
      ).documentElement
      expect(root.localName).toBe('svg')
      expect(root.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(root.getAttribute('width')).toBe('24')
      expect(root.getAttribute('height')).toBe('24')
      expect(root.querySelector('path')?.getAttribute('fill')).toBe('#fafafa')
    }
  })

  it('forms a single connected graph without self links or repeated connections', () => {
    expect(networkConnections.length).toBeGreaterThanOrEqual(34)
    expect(networkConnections.length).toBeLessThanOrEqual(36)
    const ids = new Set(technologyNodes.map(({ id }) => id))
    const pairs = new Set<string>()
    for (const { from, to, packet } of networkConnections) {
      expect(ids.has(from) && ids.has(to) && from !== to).toBe(true)
      const pair = [from, to].sort().join('/')
      expect(pairs.has(pair)).toBe(false)
      pairs.add(pair)
      expect(packet.period).toBeGreaterThan(0)
      expect(packet.phase).toBeGreaterThanOrEqual(0)
      expect(packet.phase).toBeLessThan(1)
    }
    expect(
      new Set(networkConnections.map(({ packet }) => packet.phase)).size,
    ).toBe(networkConnections.length)
    expect(
      new Set(networkConnections.map(({ packet }) => packet.period)).size,
    ).toBeGreaterThan(1)
    const reachable = new Set(['react'])
    for (const id of reachable) {
      for (const { from, to } of networkConnections) {
        if (from === id) reachable.add(to)
        if (to === id) reachable.add(from)
      }
    }
    expect(reachable).toEqual(ids)
  })

  it('uses approved depth, spread and visibility settings', () => {
    expect(networkVisual.depthIntensity).toBe(0.675)
    expect(networkVisual.networkSpread).toBe(0.925)
    expect(networkVisual.horizontalExpansion).toBeCloseTo(1.275)
    expect(networkVisual.connectionVisibility).toBe(0.675)
  })
})

describe('technology network geometry', () => {
  it.each([
    [288, 256],
    [358, 256],
    [706, 416],
    [447, 416],
    [568, 544],
  ])(
    'keeps all nodes separated and inside a %i × %i canvas throughout ambient movement',
    (width, height) => {
      const nodes = layoutNetwork(width, height)
      // Use a conservative envelope: radius, maximum independent x/y movement, and border.
      const envelopes = nodes.map(
        ({ radius, technology }) =>
          radius * (1 + Math.SQRT2 * (0.095 + technology.depth * 0.04)) + 0.5,
      )
      expect(nodes).toHaveLength(22)
      for (const node of nodes) {
        const diameter = node.radius * 2
        const range =
          node.technology.tier === 'primary'
            ? [76, 88]
            : node.technology.tier === 'core'
              ? [48, 56]
              : [36, 42]
        expect(diameter).toBeGreaterThanOrEqual(
          range[0] * Math.min(1, Math.min(width / 420, height / 360)),
        )
        expect(diameter).toBeLessThanOrEqual(range[1])
      }
      for (let i = 0; i < nodes.length; i++) {
        const { x, y } = nodes[i].base
        const r = envelopes[i]
        expect(x - r).toBeGreaterThanOrEqual(0)
        expect(y - r).toBeGreaterThanOrEqual(0)
        expect(x + r).toBeLessThanOrEqual(width)
        expect(y + r).toBeLessThanOrEqual(height)
        for (let j = 0; j < i; j++) {
          const other = nodes[j].base
          expect(Math.hypot(x - other.x, y - other.y)).toBeGreaterThan(
            r + envelopes[j],
          )
        }
      }
    },
  )

  it('separates ambient motion from base positions and drag offsets', () => {
    const [node] = layoutNetwork(450, 416)
    const base = { ...node.base }
    node.dragOffset.x = 5
    projectNode(node, 0, 2, false)
    const animated = { ...node.projected }
    projectNode(node, 0, 2, false)
    expect(node.projected).toEqual(animated)
    expect(node.base).toEqual(base)
    expect(animated.x).toBeCloseTo(base.x + node.ambient.x + 5)
    projectNode(node, 0, 10, true)
    expect(node.ambient).toEqual({ x: 0, y: 0 })
    expect(node.projected).toEqual({ x: base.x + 5, y: base.y })
  })

  it('advances packets by elapsed time and wraps at the end of the edge', () => {
    expect(packetProgress(0, 0.25, 4)).toBe(0.25)
    expect(packetProgress(2, 0.25, 4)).toBe(0.75)
    expect(packetProgress(3, 0.25, 4)).toBe(0)
    expect(packetProgress(4, 0.25, 4)).toBe(0.25)
    expect(packetOpacity(0)).toBe(0)
    expect(packetOpacity(1)).toBeCloseTo(0)
    expect(packetOpacity(0.5)).toBeGreaterThan(packetOpacity(0.25))
  })

  it('interpolates along the visible edge after both projected endpoints move', () => {
    const [from, to] = layoutNetwork(450, 416)
    from.radius = 10
    to.radius = 20
    from.projected = { x: 0, y: 0 }
    to.projected = { x: 90, y: 0 }
    const position = { x: 0, y: 0 }
    expect(projectPacket(position, from, to, 0.25)).toBe(true)
    expect(position).toEqual({ x: 25, y: 0 })

    from.projected = { x: 30, y: 20 }
    to.projected = { x: 30, y: 130 }
    expect(projectPacket(position, from, to, 0.25)).toBe(true)
    expect(position).toEqual({ x: 30, y: 50 })
    projectPacket(position, from, to, 1)
    expect(position).toEqual({ x: 30, y: 110 })
  })
})
