/* global window, document, ResizeObserver, MutationObserver */

const candidates = [
  ['hr', 'top', 'section divider'],
  ['#work [aria-controls="project-preview"]', 'bottom', 'project index border'],
  ['#work article.border-b', 'bottom', 'project accordion border'],
  ['#contact .border-b', 'bottom', 'contact row border'],
]
const contentSelector =
  'h1,h2,h3,p,a,button,img,canvas,[role="tablist"],[data-cursor="network"]'

export const pixelsPerUnit = 23
export const companionScale = 0.83
export function clearanceFor(scale = companionScale) {
  return {
    radius: 1.42 * scale * pixelsPerUnit,
    height: 3.84 * scale * pixelsPerUnit,
  }
}
const clearance = clearanceFor()

function visible(element, styles, includeEntering = false) {
  if (element.closest('[inert], [aria-hidden="true"]')) return false
  if (element.checkVisibility) {
    return element.checkVisibility({
      opacityProperty: !includeEntering,
      visibilityProperty: true,
    })
  }
  return (
    styles.display !== 'none' &&
    styles.visibility === 'visible' &&
    (includeEntering || Number(styles.opacity) > 0.12)
  )
}

function painted(color) {
  return (
    color !== 'transparent' &&
    color !== 'rgba(0, 0, 0, 0)' &&
    !/[,/]\s*0(?:\.0+)?\s*\)$/.test(color)
  )
}

export function walkingCorridors(
  line,
  obstacles,
  radius = clearance.radius,
  height = clearance.height,
) {
  let spans = [[line.left + radius, line.right - radius]]
  for (const obstacle of obstacles) {
    if (obstacle.top >= line.y - 2 || obstacle.bottom <= line.y - height)
      continue
    const left = obstacle.left - radius - 3
    const right = obstacle.right + radius + 3
    spans = spans.flatMap(([start, end]) => {
      if (right <= start || left >= end) return [[start, end]]
      return [
        [start, Math.min(end, left)],
        [Math.max(start, right), end],
      ]
    })
  }
  return spans.filter(([start, end]) => end - start >= 20)
}

export function toWorld(line, frame, depth) {
  return {
    x: (line.left + (line.right - line.left) / 2 - frame.x) / pixelsPerUnit,
    width: (line.right - line.left) / pixelsPerUnit,
    height: (frame.y - line.y) / pixelsPerUnit,
    z: depth.z,
    depth: depth.width,
  }
}

function collectContent(main, scrollX, scrollY) {
  const boxes = []
  const range = document.createRange()
  for (const el of main.querySelectorAll(contentSelector)) {
    // The Hero SVG handles its own pointer and should remain unobstructed.
    if (el.parentElement?.closest('[data-cursor="network"]')) continue
    const styles = window.getComputedStyle(el)
    if (!visible(el, styles, true)) continue
    const fineText = el.matches('h1,h2,h3,p,a,button')
    if (fineText) range.selectNodeContents(el)
    const rects = fineText
      ? range.getClientRects()
      : [el.getBoundingClientRect()]
    for (const rect of rects) {
      if (rect.width < 2 || rect.height < 2) continue
      boxes.push({
        left: rect.left + scrollX,
        right: rect.right + scrollX,
        top: rect.top + scrollY,
        bottom: rect.bottom + scrollY,
      })
    }
    if (el.matches('a,button')) {
      for (const icon of el.querySelectorAll('svg')) {
        const rect = icon.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) continue
        boxes.push({
          left: rect.left + scrollX,
          right: rect.right + scrollX,
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
        })
      }
    }
  }
  return boxes
}

export function watchSurfaces(main, invalidate, size = clearance) {
  const observed = new Set()
  const ids = new WeakMap()
  let nextId = 0
  const resize = new ResizeObserver(invalidate)
  const mutation = new MutationObserver((changes) => {
    if (
      changes.some(({ target }) => !target.closest?.('[data-cursor="network"]'))
    )
      invalidate()
  })
  resize.observe(main)
  mutation.observe(main, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'inert'],
  })

  function measure() {
    const { scrollX, scrollY } = window
    const rendered = []
    const present = new Set()
    for (const [selector, edge, label] of candidates) {
      for (const element of main.querySelectorAll(selector)) {
        present.add(element)
        if (!observed.has(element)) {
          resize.observe(element)
          observed.add(element)
        }
        const styles = window.getComputedStyle(element)
        if (!visible(element, styles)) continue
        if (
          element.matches('hr') &&
          element
            .getAnimations?.()
            .some((animation) => animation.playState === 'running')
        )
          continue
        const top = edge === 'top'
        const thickness = Number.parseFloat(
          top ? styles.borderTopWidth : styles.borderBottomWidth,
        )
        if (!(thickness > 0)) continue
        if (!painted(top ? styles.borderTopColor : styles.borderBottomColor))
          continue
        const rect = element.getBoundingClientRect()
        if (rect.width < 12 || rect.height < 0.25) continue
        if (!ids.has(element)) ids.set(element, ++nextId)
        const line = {
          id: ids.get(element),
          label,
          left: rect.left + scrollX,
          right: rect.right + scrollX,
          y:
            scrollY +
            (top ? rect.top + thickness / 2 : rect.bottom - thickness / 2),
        }
        if (
          !rendered.some(
            (other) =>
              Math.abs(other.y - line.y) < 1.1 &&
              other.left <= line.left + 1 &&
              other.right >= line.right - 1,
          )
        )
          rendered.push(line)
      }
    }
    for (const element of observed) {
      if (!present.has(element)) {
        resize.unobserve(element)
        observed.delete(element)
      }
    }
    const obstacles = collectContent(main, scrollX, scrollY)
    return rendered
      .sort((a, b) => a.y - b.y || a.left - b.left)
      .map((line) => ({
        ...line,
        corridors: walkingCorridors(line, obstacles, size.radius, size.height),
      }))
  }

  return {
    measure,
    dispose: () => {
      resize.disconnect()
      mutation.disconnect()
      observed.clear()
    },
  }
}
