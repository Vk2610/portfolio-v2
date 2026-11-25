import {
  networkConnections,
  networkInteraction,
  networkVisual,
  technologyNodes,
} from './network-config'
import type { Point, ProjectedNode, TechnologyNode } from './network.types'
import {
  createNetworkInteractions,
  clampCenter,
  renderedRadius,
} from './network-interactions'
import { createNetworkSvgRenderer } from './network-svg-renderer'

const nodeDiameter = {
  primary: [68.4, 79.2],
  core: [48, 56],
  supporting: [36, 42],
} as const
const iconMinimum = { primary: 40, core: 26, supporting: 20 } as const
export function layoutNetwork(width: number, height: number): ProjectedNode[] {
  const sizeScale = Math.min(1, Math.min(width / 420, height / 360))
  const desktop = width >= 768
  const clearance = desktop
    ? networkVisual.boundaryClearance.desktop
    : networkVisual.boundaryClearance.mobile
  const availableWidth = Math.max(0, width - 2 * clearance)
  const availableHeight = Math.max(0, height - 2 * clearance)

  return technologyNodes.map((technology) => {
    const [min, max] = nodeDiameter[technology.tier]
    const radius = (sizeScale * (min + (max - min) * technology.depth)) / 2
    const margin =
      Math.max(
        radius + clearance,
        radius * networkInteraction.hoverScale +
          networkInteraction.ringOffset +
          networkInteraction.orbitDot / 2,
      ) +
      floatAmplitude(radius, technology.depth) +
      0.5
    const base = {
      x: clampCenter(
        width / 2 +
          (technology.base.x - 0.5) *
            networkVisual.networkSpread *
            networkVisual.horizontalExpansion *
            availableWidth,
        width,
        margin,
      ),
      y: clampCenter(
        height / 2 +
          (technology.base.y - 0.5) *
            networkVisual.networkSpread *
            networkVisual.verticalExpansion *
            availableHeight,
        height,
        margin,
      ),
    }
    return {
      technology,
      base,
      ambient: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      projected: { ...base },
      radius,
      opacity:
        networkVisual.depthOpacity.background +
        (networkVisual.depthOpacity.foreground -
          networkVisual.depthOpacity.background) *
          technology.depth,
    }
  })
}

function floatAmplitude(radius: number, depth: number) {
  return (
    radius * (0.08 + (depth * 0.055 * networkVisual.depthIntensity) / 0.675)
  )
}

export function projectNode(
  node: ProjectedNode,
  index: number,
  seconds: number,
  staticFrame: boolean,
) {
  const phase = index * 2.39996
  const speed =
    ((0.42 + node.technology.depth * 0.34) * networkVisual.depthIntensity) /
    0.675
  const amplitude = floatAmplitude(node.radius, node.technology.depth)

  node.ambient.x = staticFrame
    ? 0
    : Math.sin(seconds * speed + phase) * amplitude
  node.ambient.y = staticFrame
    ? 0
    : Math.cos(seconds * speed * 0.81 + phase) * amplitude
  node.projected.x = node.base.x + node.ambient.x + node.dragOffset.x
  node.projected.y = node.base.y + node.ambient.y + node.dragOffset.y
}

export function packetProgress(seconds: number, phase: number, period: number) {
  return (seconds / period + phase) % 1
}

export function projectPacket(
  position: Point,
  from: ProjectedNode,
  to: ProjectedNode,
  progress: number,
) {
  const dx = to.projected.x - from.projected.x
  const dy = to.projected.y - from.projected.y
  const distance = Math.hypot(dx, dy)
  const startRadius = renderedRadius(from)
  const span = distance - startRadius - renderedRadius(to)
  if (span <= 0) return false

  // Travel along the visible span so short edges spend less time behind nodes.
  const fraction = (startRadius + span * progress) / distance
  position.x = from.projected.x + dx * fraction
  position.y = from.projected.y + dy * fraction
  return true
}

export function packetOpacity(progress: number) {
  // Ease to zero at both ends so wrapping the position never creates a flash.
  return 0.65 * Math.sin(Math.PI * progress) ** 2
}

function fallbackLabel({ label }: TechnologyNode) {
  return label.length <= 4
    ? label
    : label
        .split(' ')
        .map((word) => word[0])
        .join('')
        .padEnd(2, label[1])
}

export function createNetworkEngine(
  svg: SVGSVGElement,
  controls?: { root: HTMLElement; tooltip: HTMLElement },
) {
  if (typeof SVGSVGElement === 'undefined') return null
  const indices = new Map<string, number>(
    technologyNodes.map(({ id }, index) => [id, index]),
  )
  const edges = networkConnections.map(({ from, to, packet }) => ({
    from: indices.get(from)!,
    to: indices.get(to)!,
    packet,
  }))
  const labels = technologyNodes.map(fallbackLabel)
  const packetPosition: Point = { x: 0, y: 0 }
  const drawOrder = technologyNodes
    .map((_, index) => index)
    .sort((a, b) => technologyNodes[a].depth - technologyNodes[b].depth)
  const renderer = createNetworkSvgRenderer(
    svg,
    edges.length,
    drawOrder,
    labels,
  )
  const interactions =
    controls &&
    createNetworkInteractions(controls.root, svg, controls.tooltip, () => {
      if (reduced && ready()) draw()
    })

  let nodes: ProjectedNode[] = []
  let iconsReady = false
  let width = 0
  let height = 0
  let visible = false
  let reduced = false
  let elapsed = 0
  let previousTime: number | null = null
  let frameId: number | null = null

  function draw(delta = 16) {
    for (let i = 0; i < nodes.length; i++)
      if (!interactions?.isDragging(i))
        projectNode(nodes[i], i, elapsed, reduced)
    const interaction = interactions?.update(nodes, width, height, delta)

    renderer.showPackets(!reduced)
    const packetRadius = width < 380 ? 1.2 : 1.6
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i]
      const a = nodes[edge.from]
      const b = nodes[edge.to]
      const emphasis = Math.min(
        a.interaction?.emphasis ?? 1,
        b.interaction?.emphasis ?? 1,
      )
      const focus = Math.max(
        a.interaction?.brightness ?? 0,
        b.interaction?.brightness ?? 0,
      )
      renderer.edge(
        i,
        a.projected,
        b.projected,
        Math.min(
          1,
          networkVisual.connectionVisibility * emphasis + focus * 0.27,
        ),
      )

      if (!reduced) {
        const t = packetProgress(elapsed, edge.packet.phase, edge.packet.period)
        if (projectPacket(packetPosition, a, b, t)) {
          const opacity = Math.min(
            1,
            packetOpacity(t) * (emphasis + focus * 0.45),
          )
          renderer.packet(i, packetPosition, packetRadius, opacity)
        } else {
          renderer.hidePacket(i)
        }
      }
    }

    renderer.setActive(interaction?.index ?? -1)
    for (let i = 0; i < nodes.length; i++) {
      const { projected, radius, opacity, technology } = nodes[i]
      const emphasis = nodes[i].interaction?.emphasis ?? 1
      const brightness = nodes[i].interaction?.brightness ?? 0
      const scale = nodes[i].interaction?.scale ?? 1
      const strokeOpacity = Math.min(
        1,
        emphasis *
          (opacity *
            (0.55 +
              (0.45 * technology.depth * networkVisual.depthIntensity) /
                0.675) +
            brightness * 0.23),
      )
      const iconSize =
        Math.min(
          radius * 1.15,
          Math.max(
            iconMinimum[technology.tier] * (width < 420 ? width / 420 : 1),
            radius * 0.84,
          ),
        ) * scale
      renderer.node(
        i,
        projected,
        radius * scale,
        iconSize,
        emphasis,
        strokeOpacity,
        Math.min(1, opacity + brightness * 0.12) * emphasis,
      )
    }

    if (interactions && interaction) {
      renderer.cursor(
        interactions.cursorFrame(elapsed, interaction.cursorActive),
        networkInteraction.orbitDot / 2,
      )
      interactions.syncNativeCursor(interaction.cursorActive)
    }
  }

  function ready() {
    return visible && iconsReady && width > 0 && height > 0
  }

  function tick(timestamp: number) {
    frameId = null
    const delta = previousTime === null ? 16 : timestamp - previousTime
    if (previousTime !== null) elapsed += delta / 1000
    previousTime = timestamp
    draw(delta)
    frameId = requestAnimationFrame(tick)
  }

  function update() {
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    previousTime = null

    interactions?.setActive(ready(), reduced)
    if (!ready()) return
    draw()
    if (!reduced) frameId = requestAnimationFrame(tick)
  }

  return {
    setIcons(loaded: readonly (SVGSVGElement | null)[]) {
      renderer.setIcons(loaded)
      iconsReady = true
      update()
    },
    resize(nextWidth: number, nextHeight: number) {
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      renderer.resize(width, height)
      const previousNodes = nodes
      nodes = layoutNetwork(width, height)
      for (let i = 0; i < previousNodes.length; i++)
        nodes[i].dragOffset = previousNodes[i].dragOffset
      update()
    },
    setPlayback(nextVisible: boolean, nextReduced: boolean) {
      if (visible === nextVisible && reduced === nextReduced) return
      visible = nextVisible
      reduced = nextReduced
      update()
    },
    destroy() {
      visible = false
      update()
      interactions?.destroy()
      renderer.destroy()
    },
  }
}
