import {
  networkConnections,
  networkInteraction as config,
  technologyNodes,
} from './network-config'
import type { CursorFrame } from './network-svg-renderer'
import type { Point, ProjectedNode } from './network.types'

export function renderedRadius(node: ProjectedNode) {
  return node.radius * (node.interaction?.scale ?? 1)
}

export function hitNode(
  nodes: readonly ProjectedNode[],
  point: Point,
  retained = -1,
) {
  let nearest = -1
  let score = Infinity
  for (let i = 0; i < nodes.length; i++) {
    const { projected } = nodes[i]
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y)
    const radius = renderedRadius(nodes[i])
    if (i === retained && distance <= radius + config.magneticLimit) return i
    if (distance <= radius && distance / radius < score) {
      nearest = i
      score = distance / radius
    }
  }
  return nearest
}

export function clampCenter(
  position: number,
  length: number,
  clearance: number,
) {
  const margin = Math.min(clearance, length / 2)
  return Math.max(margin, Math.min(length - margin, position))
}

export function magneticTarget(distance: number, axisDelta: number) {
  return (
    axisDelta * Math.min(0.22, config.magneticLimit / Math.max(1, distance))
  )
}

export function clientToNetwork(
  svg: SVGSVGElement,
  x: number,
  y: number,
  width: number,
  height: number,
): Point {
  const screen = svg.getScreenCTM?.()
  if (screen && screen.a * screen.d !== screen.b * screen.c) {
    const inverse = screen.inverse()
    const point = {
      x: inverse.a * x + inverse.c * y + inverse.e,
      y: inverse.b * x + inverse.d * y + inverse.f,
    }
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) return point
  }

  // Match xMidYMid meet if a screen matrix is temporarily unavailable.
  const rect = svg.getBoundingClientRect()
  const scale =
    width > 0 && height > 0
      ? Math.min(rect.width / width, rect.height / height)
      : 0
  if (scale <= 0) return { x: x - rect.left, y: y - rect.top }
  return {
    x: (x - rect.left - (rect.width - width * scale) / 2) / scale,
    y: (y - rect.top - (rect.height - height * scale) / 2) / scale,
  }
}

const neighbours = technologyNodes.map(
  ({ id }) =>
    new Set(
      networkConnections.flatMap(({ from, to }) =>
        from === id ? [to] : to === id ? [from] : [],
      ),
    ),
)

export function createNetworkInteractions(
  root: HTMLElement,
  svg: SVGSVGElement,
  tooltip: HTMLElement,
  refresh: () => void,
) {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-network-node]'),
  )
  const tooltipName = tooltip.querySelector('strong')!
  const tooltipDescription = tooltip.querySelector('span')!
  const pointer = { x: 0, y: 0 }
  const screenPointer = { x: 0, y: 0 }
  let pointerFine = false
  const cursor: CursorFrame = {
    ring: { x: 0, y: 0 },
    ringRadius: 0,
    ringOpacity: 0,
    orbit: { x: 0, y: 0 },
    pointer,
    pointerRadius: 0,
  }
  const frame = { index: -1, cursorActive: false }
  const fine = window.matchMedia?.('(any-pointer: fine)')
  let nodes: ProjectedNode[] = []
  let hover = -1
  let selected = -1
  let focused = -1
  let over = false
  let reduced = false
  let active = false
  let tooltipTarget = -1
  let tooltipIndex = -1
  let tooltipTimer: ReturnType<typeof setTimeout> | undefined
  let ring = -1
  let ringOpacity = 0
  let press: {
    id: number
    index: number
    start: Point
    grab: Point
    dragging: boolean
    target: HTMLElement
  } | null = null
  const listeners = new AbortController()
  const signal = listeners.signal

  function hideTooltip() {
    clearTimeout(tooltipTimer)
    tooltipTarget = tooltipIndex = -1
    tooltip.hidden = true
  }

  function syncTooltip() {
    const next = press?.dragging
      ? -1
      : focused >= 0
        ? focused
        : hover >= 0
          ? hover
          : selected
    if (next === tooltipTarget) return
    hideTooltip()
    if (next < 0) return
    tooltipTarget = next
    const show = () => {
      const { label, description } = technologyNodes[next]
      tooltipName.textContent = label
      tooltipDescription.textContent = description
      tooltipIndex = next
      tooltip.hidden = false
      refresh()
    }
    if (next === focused || (hover < 0 && next === selected)) show()
    else tooltipTimer = setTimeout(show, config.tooltipDelay)
  }

  function reprojectPointer() {
    const point = clientToNetwork(
      svg,
      screenPointer.x,
      screenPointer.y,
      width,
      height,
    )
    pointer.x = point.x
    pointer.y = point.y
    over =
      pointerFine &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x < width &&
      point.y < height
  }

  function track(event: PointerEvent) {
    screenPointer.x = event.clientX
    screenPointer.y = event.clientY
    pointerFine = event.pointerType === 'mouse' && fine?.matches === true
    reprojectPointer()
  }

  function move(event: PointerEvent) {
    if (!active || (press && event.pointerId !== press.id)) return
    track(event)
    if (
      press &&
      (press.dragging ||
        Math.hypot(pointer.x - press.start.x, pointer.y - press.start.y) >=
          config.dragThreshold)
    ) {
      press.dragging = true
      selected = -1
    }
    hover = over && !press ? hitNode(nodes, pointer, hover) : -1
    syncTooltip()
    refresh()
  }

  function down(event: PointerEvent) {
    if (!active || press || event.button !== 0) return
    track(event)
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-network-node]',
    )
    const index = hitNode(nodes, pointer)
    focused = -1
    if (index < 0 || !target) {
      selected = -1
      syncTooltip()
      refresh()
      return
    }
    event.preventDefault()
    const { projected } = nodes[index]
    press = {
      id: event.pointerId,
      index,
      start: { ...pointer },
      grab: { x: pointer.x - projected.x, y: pointer.y - projected.y },
      dragging: false,
      target,
    }
    target.setPointerCapture(event.pointerId)
  }

  function finish(event?: PointerEvent) {
    if (!press || (event && press.id !== event.pointerId)) return
    const { id, index, dragging, grab, target } = press
    if (event?.type === 'pointerup') track(event)
    const node = nodes[index]
    if (dragging && node?.interaction) {
      const state = node.interaction
      const position =
        event?.type === 'pointerup' ? dragPosition(node, grab) : node.projected
      node.dragOffset.x = position.x - node.base.x
      node.dragOffset.y = position.y - node.base.y
      state.release.x = -node.ambient.x - state.parallax.x
      state.release.y = -node.ambient.y - state.parallax.y
      state.magnetic.x = state.magnetic.y = 0
    } else if (event?.type === 'pointerup') {
      selected = index
    }
    press = null
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id)
    if (event?.type !== 'pointerup') pointerFine = over = false
    hover = over ? hitNode(nodes, pointer) : -1
    syncTooltip()
    refresh()
  }

  let width = 0
  let height = 0
  function dragPosition(node: ProjectedNode, grab: Point) {
    const clearance =
      node.radius * config.hoverScale + config.ringOffset + config.orbitDot / 2
    return {
      x: clampCenter(pointer.x - grab.x, width, clearance),
      y: clampCenter(pointer.y - grab.y, height, clearance),
    }
  }

  function dismiss() {
    focused = selected = hover = -1
    hideTooltip()
    refresh()
  }

  root.addEventListener('pointermove', move, { signal })
  root.addEventListener('pointerenter', move, { signal })
  root.addEventListener('pointerdown', down, { signal })
  for (const event of ['pointerup', 'lostpointercapture'] as const)
    root.addEventListener(event, finish, { signal })
  root.addEventListener(
    'pointercancel',
    (event) => {
      if (press && press.id !== event.pointerId) return
      pointerFine = over = false
      hover = -1
      root.style.cursor = ''
      finish(event)
      syncTooltip()
      refresh()
    },
    { signal },
  )
  root.addEventListener(
    'pointerleave',
    () => {
      pointerFine = over = false
      hover = -1
      root.style.cursor = ''
      syncTooltip()
      refresh()
    },
    { signal },
  )
  root.addEventListener(
    'focusin',
    (event) => {
      focused = buttons.indexOf(event.target as HTMLButtonElement)
      syncTooltip()
      refresh()
    },
    { signal },
  )
  root.addEventListener(
    'focusout',
    () => {
      focused = -1
      syncTooltip()
      refresh()
    },
    { signal },
  )
  root.addEventListener(
    'click',
    (event) => {
      if (event.detail !== 0) return
      const index = buttons.indexOf(event.target as HTMLButtonElement)
      if (index < 0) return
      selected = focused = index
      syncTooltip()
      refresh()
    },
    { signal },
  )
  function viewportChanged() {
    if (!active) return
    if (pointerFine || press) {
      reprojectPointer()
      hover = over && !press ? hitNode(nodes, pointer, hover) : -1
      if (!over) root.style.cursor = ''
      syncTooltip()
    }
    refresh()
  }
  window.addEventListener('scroll', viewportChanged, {
    capture: true,
    passive: true,
    signal,
  })
  window.addEventListener('resize', viewportChanged, { signal })
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape' &&
        (tooltipIndex >= 0 || tooltipTarget >= 0 || selected >= 0)
      )
        dismiss()
    },
    { signal },
  )

  return {
    setActive(next: boolean, reduce: boolean) {
      active = next
      reduced = reduce
      if (!active) {
        pointerFine = over = false
        finish()
        dismiss()
      }
      if (!active || reduced) root.style.cursor = ''
    },
    isDragging(index: number) {
      return press?.dragging === true && press.index === index
    },
    update(current: ProjectedNode[], w: number, h: number, delta: number) {
      nodes = current
      if (w !== width || h !== height) {
        width = w
        height = h
        if (pointerFine || press) reprojectPointer()
      }
      const dragged = press?.dragging ? press.index : -1
      const index =
        dragged >= 0
          ? dragged
          : focused >= 0
            ? focused
            : hover >= 0
              ? hover
              : selected
      const blend = reduced ? 1 : Math.min(1, delta / config.transition)
      const aim = (value: number, target: number) =>
        value + (target - value) * blend
      const px = width
        ? Math.max(-1, Math.min(1, (pointer.x / width) * 2 - 1))
        : 0
      const py = height
        ? Math.max(-1, Math.min(1, (pointer.y / height) * 2 - 1))
        : 0
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const state = (node.interaction ??= {
          scale: 1,
          emphasis: 1,
          brightness: 0,
          parallax: { x: 0, y: 0 },
          magnetic: { x: 0, y: 0 },
          release: { x: 0, y: 0 },
        })
        const highlighted = i === index
        const related =
          index < 0 || highlighted || neighbours[index].has(node.technology.id)
        state.emphasis = aim(
          state.emphasis,
          related ? 1 : config.unrelatedOpacity,
        )
        state.brightness = aim(state.brightness, highlighted ? 1 : 0)
        state.scale = aim(
          state.scale,
          highlighted && !reduced ? config.hoverScale : 1,
        )
        if (i === dragged && press) {
          const position = dragPosition(node, press.grab)
          node.projected.x = position.x
          node.projected.y = position.y
          continue
        }
        const depth = node.technology.depth
        const strength =
          over && !reduced ? config.parallaxLimit * depth * depth : 0
        if (dragged < 0) {
          state.parallax.x = aim(state.parallax.x, px * strength)
          state.parallax.y = aim(state.parallax.y, py * strength)
        }
        const dx = pointer.x - node.projected.x - state.parallax.x
        const dy = pointer.y - node.projected.y - state.parallax.y
        const distance = Math.hypot(dx, dy)
        const magnetic = !reduced && dragged < 0 && over && i === hover
        state.magnetic.x = aim(
          state.magnetic.x,
          magnetic ? magneticTarget(distance, dx) : 0,
        )
        state.magnetic.y = aim(
          state.magnetic.y,
          magnetic ? magneticTarget(distance, dy) : 0,
        )
        if (node.dragOffset.x || node.dragOffset.y) {
          const margin =
            renderedRadius(node) + config.ringOffset + config.orbitDot / 2
          node.projected.x = clampCenter(node.projected.x, width, margin)
          node.projected.y = clampCenter(node.projected.y, height, margin)
        }
        node.projected.x +=
          state.parallax.x + state.magnetic.x + state.release.x
        node.projected.y +=
          state.parallax.y + state.magnetic.y + state.release.y
        state.release.x = aim(state.release.x, 0)
        state.release.y = aim(state.release.y, 0)
        if (
          state.brightness > 0.001 ||
          state.parallax.x ||
          state.parallax.y ||
          node.dragOffset.x ||
          node.dragOffset.y
        ) {
          const margin =
            renderedRadius(node) + config.ringOffset + config.orbitDot / 2
          node.projected.x = clampCenter(node.projected.x, width, margin)
          node.projected.y = clampCenter(node.projected.y, height, margin)
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const { projected } = nodes[i]
        const button = buttons[i]
        const radius = renderedRadius(nodes[i])
        button.style.width = button.style.height = `${radius * 2}px`
        button.style.transform = `translate(${projected.x - radius}px, ${projected.y - radius}px)`
        button.style.zIndex = i === index ? '2' : '1'
      }
      if (tooltipIndex >= 0) {
        const node = nodes[tooltipIndex]
        const rect = svg.getBoundingClientRect()
        const left = Math.max(8 - rect.left, 0)
        const right = Math.min(window.innerWidth - rect.left - 8, width)
        const x = Math.max(
          left,
          Math.min(
            right - tooltip.offsetWidth,
            node.projected.x - tooltip.offsetWidth / 2,
          ),
        )
        const gap = renderedRadius(node) + 12
        const above = node.projected.y - gap - tooltip.offsetHeight
        const below = node.projected.y + gap
        const y =
          above + rect.top >= 8
            ? above
            : Math.min(
                below,
                window.innerHeight - rect.top - tooltip.offsetHeight - 8,
              )
        tooltip.style.left = `${x}px`
        tooltip.style.top = `${y}px`
      }
      const cursorActive = active && over && !reduced
      const target = cursorActive ? (dragged >= 0 ? dragged : hover) : -1
      if (target >= 0) ring = target
      ringOpacity = Math.max(
        0,
        Math.min(
          1,
          ringOpacity + ((target >= 0 ? 1 : -1) * delta) / config.transition,
        ),
      )
      frame.index = index
      frame.cursorActive = cursorActive
      return frame
    },
    cursorFrame(seconds: number, cursorActive: boolean) {
      cursor.ringOpacity = 0
      const node = nodes[ring]
      if (!reduced && ringOpacity > 0 && node) {
        const { x, y } = node.projected
        cursor.ring.x = x
        cursor.ring.y = y
        cursor.ringRadius = renderedRadius(node) + config.ringOffset
        cursor.ringOpacity = ringOpacity
        const angle = ((seconds * 1000) / config.orbitDuration) * Math.PI * 2
        cursor.orbit.x = x + Math.cos(angle) * cursor.ringRadius
        cursor.orbit.y = y + Math.sin(angle) * cursor.ringRadius
      }
      cursor.pointerRadius = cursorActive
        ? ((hover >= 0 ? 0.7 : 1) * config.cursorDot) / 2
        : 0
      return cursor
    },
    syncNativeCursor(cursorActive: boolean) {
      root.style.cursor = cursorActive ? 'none' : ''
    },
    destroy() {
      active = pointerFine = over = false
      listeners.abort()
      finish()
      hideTooltip()
      root.style.cursor = ''
    },
  }
}
