import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  networkConnections,
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

describe('technology network rendering', () => {
  it('draws all nodes, handles failed logos and stops scheduling frames when paused', () => {
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
    }
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    const requestFrame = vi.fn().mockReturnValue(42)
    const cancelFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)

    try {
      const engine = createNetworkEngine(canvas)!
      engine.resize(288, 256, 3)
      expect(canvas.width).toBe(576)
      expect(canvas.height).toBe(512)
      expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
      engine.setIcons(
        technologyNodes.map((_, index) => (index === 0 ? null : new Image())),
      )
      expect(context.clearRect).not.toHaveBeenCalled()

      engine.setPlayback(true, true)
      expect(context.drawImage).toHaveBeenCalledTimes(21)
      expect(context.fillText).toHaveBeenCalledTimes(1)
      expect(context.arc).toHaveBeenCalledTimes(22)
      expect(requestFrame).not.toHaveBeenCalled()

      context.arc.mockClear()
      engine.setPlayback(true, false)
      expect(context.arc).toHaveBeenCalledTimes(22 + networkConnections.length)
      expect(requestFrame).toHaveBeenCalledTimes(1)
      engine.setPlayback(false, false)
      expect(cancelFrame).toHaveBeenCalledWith(42)
      expect(requestFrame).toHaveBeenCalledTimes(1)

      engine.setPlayback(true, false)
      engine.destroy()
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
