import {
  networkConnections,
  networkVisual,
  technologyNodes,
} from './network-config'
import type { Point, ProjectedNode, TechnologyNode } from './network.types'

const nodeDiameter = {
  primary: [68.4, 79.2],
  core: [48, 56],
  supporting: [36, 42],
} as const
const iconMinimum = { primary: 40, core: 26, supporting: 20 } as const
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadIcon(url: string) {
  const cached = imageCache.get(url)
  if (cached) return cached

  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
  imageCache.set(url, pending)
  return pending
}

export function loadNetworkIcons() {
  const base = import.meta.env.BASE_URL
  return Promise.all(
    technologyNodes.map(({ iconPath }) => loadIcon(`${base}${iconPath}`)),
  )
}

export function layoutNetwork(width: number, height: number): ProjectedNode[] {
  const sizeScale = Math.min(1, Math.min(width / 420, height / 360))
  const desktop = width >= 768
  const clearance = desktop
    ? networkVisual.boundaryClearance.desktop
    : networkVisual.boundaryClearance.mobile
  const largestRadius = 44 * sizeScale
  const maxFloat = largestRadius * 0.135
  const cursorClearance = desktop ? largestRadius * 0.14 : 0
  const paddingX = clearance + largestRadius + maxFloat + cursorClearance
  const paddingY = clearance + largestRadius + maxFloat
  const availableWidth = Math.max(0, width - 2 * paddingX)
  const availableHeight = Math.max(0, height - 2 * paddingY)

  return technologyNodes.map((technology) => {
    const base = {
      x:
        paddingX +
        (0.5 +
          (technology.base.x - 0.5) *
            networkVisual.networkSpread *
            networkVisual.horizontalExpansion) *
          availableWidth,
      y:
        paddingY +
        (0.5 +
          (technology.base.y - 0.5) *
            networkVisual.networkSpread *
            networkVisual.verticalExpansion) *
          availableHeight,
    }
    return {
      technology,
      base,
      ambient: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      projected: { ...base },
      radius:
        (sizeScale *
          (nodeDiameter[technology.tier][0] +
            (nodeDiameter[technology.tier][1] -
              nodeDiameter[technology.tier][0]) *
              technology.depth)) /
        2,
      opacity:
        networkVisual.depthOpacity.background +
        (networkVisual.depthOpacity.foreground -
          networkVisual.depthOpacity.background) *
          technology.depth,
    }
  })
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
  const amplitude =
    node.radius *
    (0.08 +
      (node.technology.depth * 0.055 * networkVisual.depthIntensity) / 0.675)

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
  const span = distance - from.radius - to.radius
  if (span <= 0) return false

  // Travel along the visible span so short edges spend less time behind nodes.
  const fraction = (from.radius + span * progress) / distance
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

export function createNetworkEngine(canvas: HTMLCanvasElement) {
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  const context = ctx
  const palette = getComputedStyle(canvas)
  const foreground = palette.getPropertyValue('--ink-50').trim()
  const border = palette.getPropertyValue('--ink-500').trim()
  const surface = palette.getPropertyValue('--ink-900').trim()
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

  let nodes: ProjectedNode[] = []
  let icons: Awaited<ReturnType<typeof loadNetworkIcons>> | null = null
  let width = 0
  let height = 0
  let visible = false
  let reduced = false
  let elapsed = 0
  let previousTime: number | null = null
  let frameId: number | null = null

  function dot(x: number, y: number, radius: number) {
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
  }

  function draw() {
    if (!icons) return
    context.clearRect(0, 0, width, height)

    for (let i = 0; i < nodes.length; i++)
      projectNode(nodes[i], i, elapsed, reduced)

    context.lineWidth = 1
    context.strokeStyle = border
    context.globalAlpha = networkVisual.connectionVisibility
    context.beginPath()
    for (const edge of edges) {
      const a = nodes[edge.from].projected
      const b = nodes[edge.to].projected
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
    }
    context.stroke()

    if (!reduced) {
      context.fillStyle = foreground
      const packetRadius = width < 380 ? 1.2 : 1.6
      for (const edge of edges) {
        const t = packetProgress(elapsed, edge.packet.phase, edge.packet.period)
        if (!projectPacket(packetPosition, nodes[edge.from], nodes[edge.to], t))
          continue
        context.globalAlpha = packetOpacity(t)
        dot(packetPosition.x, packetPosition.y, packetRadius)
        context.fill()
      }
    }

    const drawOrder = nodes
      .map((_, index) => index)
      .sort((a, b) => nodes[a].technology.depth - nodes[b].technology.depth)
    for (const i of drawOrder) {
      const {
        projected: { x, y },
        radius,
        opacity,
      } = nodes[i]
      context.globalAlpha = 1
      context.fillStyle = surface
      dot(x, y, radius)
      context.fill()
      context.globalAlpha =
        opacity *
        (0.55 +
          (0.45 * nodes[i].technology.depth * networkVisual.depthIntensity) /
            0.675)
      context.stroke()

      context.globalAlpha = opacity
      const icon = icons[i]
      if (icon) {
        const size = Math.min(
          radius * 1.15,
          Math.max(
            iconMinimum[nodes[i].technology.tier] *
              (width < 420 ? width / 420 : 1),
            radius * 0.84,
          ),
        )
        context.drawImage(icon, x - size / 2, y - size / 2, size, size)
      } else {
        context.fillStyle = foreground
        context.font = `500 ${Math.max(6, radius * 0.58)}px system-ui`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(labels[i], x, y, radius * 1.6)
      }
    }
    context.globalAlpha = 1
  }

  function ready() {
    return visible && icons !== null && width > 0 && height > 0
  }

  function tick(timestamp: number) {
    frameId = null
    if (previousTime !== null) elapsed += (timestamp - previousTime) / 1000
    previousTime = timestamp
    draw()
    frameId = requestAnimationFrame(tick)
  }

  function update() {
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    previousTime = null

    if (!ready()) return
    draw()
    if (!reduced) frameId = requestAnimationFrame(tick)
  }

  return {
    setIcons(loaded: Awaited<ReturnType<typeof loadNetworkIcons>>) {
      icons = loaded
      update()
    },
    resize(nextWidth: number, nextHeight: number, pixelRatio: number) {
      const ratio = Math.min(2, Math.max(1, pixelRatio))
      const pixelWidth = Math.round(nextWidth * ratio)
      const pixelHeight = Math.round(nextHeight * ratio)
      if (
        nextWidth === width &&
        nextHeight === height &&
        canvas.width === pixelWidth &&
        canvas.height === pixelHeight
      )
        return
      width = nextWidth
      height = nextHeight
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      if (width > 0 && height > 0)
        context.setTransform(
          pixelWidth / width,
          0,
          0,
          pixelHeight / height,
          0,
          0,
        )
      nodes = layoutNetwork(width, height)
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
    },
  }
}
