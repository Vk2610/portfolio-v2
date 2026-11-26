export type SurfaceEdge = 'top' | 'bottom'

export const APPROVED_SURFACE_KINDS = new Set([
  'hero-platform',
  'section-divider',
  'project-preview',
  'project-preview-mobile',
  'project-card',
])

export interface DomSurfaceRect {
  id: string
  kind: string
  element: Element
  docLeft: number
  docTop: number
  width: number
  edge: SurfaceEdge
}

export interface WorldSurface {
  id: string
  kind: string
  x: number
  y: number
  z: number
  width: number
  depth: number
  docLeft: number
  docTop: number
  pxWidth: number
}

export interface WorldCoordinateOrigin {
  anchorDocX: number
  anchorDocY: number
  pxPerWorldUnit: number
}

export function isSurfaceElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false
  if (el.hasAttribute('data-hero-robot')) return true

  if (el.closest('[inert], [aria-hidden="true"]')) {
    return false
  }

  const style = window.getComputedStyle(el)
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number.parseFloat(style.opacity) === 0
  ) {
    return false
  }

  const rect = el.getBoundingClientRect()
  return rect.width > 1 && rect.height >= 0
}

export function collectDomSurfaces(
  root: ParentNode = document,
): DomSurfaceRect[] {
  const elements = root.querySelectorAll('[data-robot-surface]')
  const scrollX = window.scrollX || window.pageXOffset || 0
  const scrollY = window.scrollY || window.pageYOffset || 0
  const counts = new Map<string, number>()
  const surfaces: DomSurfaceRect[] = []

  for (const el of elements) {
    if (!isSurfaceElementVisible(el)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width <= 1) continue

    const kind = el.getAttribute('data-robot-surface') || ''
    if (!APPROVED_SURFACE_KINDS.has(kind)) continue
    const edge: SurfaceEdge =
      el.getAttribute('data-robot-surface-edge') === 'bottom' ? 'bottom' : 'top'
    const index = (counts.get(kind) ?? 0) + 1
    counts.set(kind, index)

    const y = edge === 'bottom' ? rect.bottom : rect.top
    surfaces.push({
      id: `${kind}-${index}`,
      kind,
      element: el,
      docLeft: rect.left + scrollX,
      docTop: y + scrollY,
      width: rect.width,
      edge,
    })
  }

  return surfaces
}

export function domToWorldSurface(
  surface: DomSurfaceRect,
  origin: WorldCoordinateOrigin,
): WorldSurface {
  const { anchorDocX, anchorDocY, pxPerWorldUnit } = origin
  const scale = Math.max(1, pxPerWorldUnit)
  const centerDocX = surface.docLeft + surface.width / 2

  return {
    id: surface.id,
    kind: surface.kind,
    x: (centerDocX - anchorDocX) / scale,
    y: (anchorDocY - surface.docTop) / scale,
    z: 0,
    width: surface.width / scale,
    depth: 1.6,
    docLeft: surface.docLeft,
    docTop: surface.docTop,
    pxWidth: surface.width,
  }
}

export function resolveHeroWorldOrigin(
  heroHost: Element,
  viewHeightWorld: number,
): WorldCoordinateOrigin | null {
  const rect = heroHost.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0 || viewHeightWorld <= 0) {
    return null
  }
  const scrollX = window.scrollX || window.pageXOffset || 0
  const scrollY = window.scrollY || window.pageYOffset || 0
  return {
    anchorDocX: rect.left + scrollX + rect.width / 2,
    anchorDocY: rect.bottom + scrollY,
    pxPerWorldUnit: rect.height / viewHeightWorld,
  }
}

export function computeSurfaceSignature(surfaces: WorldSurface[]): string {
  return surfaces
    .map(
      (s) =>
        `${s.id}:${s.x.toFixed(3)},${s.y.toFixed(3)},${s.width.toFixed(3)}`,
    )
    .join('|')
}
