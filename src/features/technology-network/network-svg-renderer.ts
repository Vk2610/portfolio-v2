import type { Point, TechnologyNode } from './network.types'

const svgNamespace = 'http://www.w3.org/2000/svg'
const iconCache = new Map<string, Promise<SVGSVGElement | null>>()

function loadIcon(url: string) {
  const cached = iconCache.get(url)
  if (cached) return cached

  // The sources are the portfolio's local technology assets. Cache the parsed
  // markup and clone each logo once per mounted renderer.
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error('Technology SVG unavailable')
      return response.text()
    })
    .then((markup) => {
      const root = new DOMParser().parseFromString(
        markup,
        'image/svg+xml',
      ).documentElement
      if (root.namespaceURI !== svgNamespace || root.localName !== 'svg')
        return null
      return root as unknown as SVGSVGElement
    })
    .catch(() => null)
  iconCache.set(url, pending)
  return pending
}

export function loadNetworkIcons(nodes: readonly TechnologyNode[]) {
  const base = import.meta.env.BASE_URL
  return Promise.all(
    nodes.map(({ iconPath }) => loadIcon(`${base}${iconPath}`)),
  )
}

function element<Tag extends keyof SVGElementTagNameMap>(tag: Tag) {
  return document.createElementNS(svgNamespace, tag)
}

function number(target: SVGElement, name: string, value: number) {
  target.setAttribute(name, String(value))
}

function circle(
  target: SVGCircleElement,
  x: number,
  y: number,
  radius: number,
  opacity: number,
) {
  number(target, 'cx', x)
  number(target, 'cy', y)
  number(target, 'r', radius)
  number(target, 'opacity', opacity)
}

export type CursorFrame = {
  ring: Point
  ringRadius: number
  ringOpacity: number
  orbit: Point
  pointer: Point
  pointerRadius: number
}

export function createNetworkSvgRenderer(
  svg: SVGSVGElement,
  edgeCount: number,
  drawOrder: readonly number[],
  labels: readonly string[],
) {
  const linesLayer = element('g')
  const packetsLayer = element('g')
  const nodesLayer = element('g')
  const activeLayer = element('g')
  const cursorLayer = element('g')
  packetsLayer.setAttribute('data-network-packets', '')
  const lines = Array.from({ length: edgeCount }, () => element('line'))
  const packets = Array.from({ length: edgeCount }, () => element('circle'))
  const nodes = labels.map((label) => {
    const group = element('g')
    const boundary = element('circle')
    const fallback = element('text')
    group.setAttribute('data-network-glyph', '')
    boundary.setAttribute('fill', 'var(--ink-900)')
    boundary.setAttribute('stroke', 'var(--ink-500)')
    fallback.setAttribute('text-anchor', 'middle')
    fallback.setAttribute('dominant-baseline', 'central')
    fallback.setAttribute('font-family', 'system-ui')
    fallback.setAttribute('font-weight', '500')
    fallback.textContent = label
    group.append(boundary, fallback)
    return { group, boundary, fallback, icon: null as SVGSVGElement | null }
  })

  linesLayer.setAttribute('stroke', 'var(--ink-500)')
  linesLayer.append(...lines)
  packetsLayer.setAttribute('fill', 'var(--ink-50)')
  packetsLayer.append(...packets)
  nodesLayer.setAttribute('fill', 'var(--ink-50)')
  activeLayer.setAttribute('fill', 'var(--ink-50)')
  nodesLayer.append(...drawOrder.map((i) => nodes[i].group))

  const ring = element('circle')
  const orbit = element('circle')
  const pointer = element('circle')
  cursorLayer.setAttribute('fill', 'var(--ink-50)')
  ring.setAttribute('fill', 'none')
  ring.setAttribute('stroke', 'var(--ink-50)')
  cursorLayer.append(ring, orbit, pointer)
  svg.replaceChildren(
    linesLayer,
    packetsLayer,
    nodesLayer,
    activeLayer,
    cursorLayer,
  )

  let active = -1
  return {
    resize(width: number, height: number) {
      svg.setAttribute('viewBox', `0 0 ${width || 1} ${height || 1}`)
    },
    setIcons(icons: readonly (SVGSVGElement | null)[]) {
      nodes.forEach((node, index) => {
        const source = icons[index]
        if (!source) return
        const clone = document.importNode(source, true)
        node.icon = clone
        node.fallback.remove()
        node.group.append(clone)
      })
    },
    edge(index: number, from: Point, to: Point, opacity: number) {
      const line = lines[index]
      number(line, 'x1', from.x)
      number(line, 'y1', from.y)
      number(line, 'x2', to.x)
      number(line, 'y2', to.y)
      number(line, 'opacity', opacity)
    },
    showPackets(show: boolean) {
      packetsLayer.style.display = show ? '' : 'none'
    },
    packet(index: number, position: Point, radius: number, opacity: number) {
      circle(packets[index], position.x, position.y, radius, opacity)
    },
    hidePacket(index: number) {
      number(packets[index], 'opacity', 0)
    },
    setActive(index: number) {
      if (index === active) return
      if (active >= 0) {
        const previous = drawOrder.indexOf(active)
        const next = drawOrder.slice(previous + 1).find((i) => i !== index)
        nodesLayer.insertBefore(
          nodes[active].group,
          next === undefined ? null : nodes[next].group,
        )
      }
      if (index >= 0) activeLayer.append(nodes[index].group)
      active = index
    },
    node(
      index: number,
      position: Point,
      radius: number,
      iconSize: number,
      fillOpacity: number,
      strokeOpacity: number,
      iconOpacity: number,
    ) {
      const { group, boundary, fallback, icon } = nodes[index]
      group.setAttribute('transform', `translate(${position.x} ${position.y})`)
      number(boundary, 'r', radius)
      number(boundary, 'fill-opacity', fillOpacity)
      number(boundary, 'stroke-opacity', strokeOpacity)
      if (icon) {
        number(icon, 'x', -iconSize / 2)
        number(icon, 'y', -iconSize / 2)
        number(icon, 'width', iconSize)
        number(icon, 'height', iconSize)
        number(icon, 'opacity', iconOpacity)
      } else {
        number(fallback, 'opacity', iconOpacity)
        number(fallback, 'font-size', Math.max(6, radius * 0.58))
      }
    },
    cursor(frame: CursorFrame, orbitRadius: number) {
      circle(
        ring,
        frame.ring.x,
        frame.ring.y,
        frame.ringRadius,
        frame.ringOpacity,
      )
      circle(
        orbit,
        frame.orbit.x,
        frame.orbit.y,
        orbitRadius,
        frame.ringOpacity,
      )
      circle(pointer, frame.pointer.x, frame.pointer.y, frame.pointerRadius, 1)
    },
    destroy() {
      svg.replaceChildren()
    },
  }
}
