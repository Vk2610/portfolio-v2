export interface HeroRobotPlacement {
  left: number
  top: number
  width: number
  height: number
}

function measureIntroTextRect(introEl: Element): DOMRect | null {
  const rect = introEl.getBoundingClientRect()
  if (typeof document !== 'undefined' && document.createRange) {
    const range = document.createRange()
    if (typeof range.getBoundingClientRect === 'function') {
      range.selectNodeContents(introEl)
      const textRect = range.getBoundingClientRect()
      if (textRect.width > 0 && textRect.height > 0) {
        return textRect
      }
    }
  }
  return rect.width > 0 ? rect : null
}

export function computeHeroRobotPlacement(
  heading: Element,
  container: Element,
): HeroRobotPlacement | null {
  const firstWord = heading.querySelector('.type-reveal-piece') ?? heading
  const leftColumn = heading.parentElement ?? heading
  const introEl = heading.previousElementSibling

  const wordRect = firstWord.getBoundingClientRect()
  const colRect = leftColumn.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  if (wordRect.width <= 0 || wordRect.height <= 0) return null

  const computed = window.getComputedStyle(firstWord)
  const fontSize = Number.parseFloat(computed.fontSize) || 44
  const height = Math.round(Math.min(130, Math.max(84, fontSize * 1.45)))

  const introRect = introEl ? measureIntroTextRect(introEl) : null
  const colRight = Math.round(colRect.right - containerRect.left)
  const colLeft = Math.max(0, Math.round(colRect.left - containerRect.left))

  const rawLeft = introRect
    ? Math.round(introRect.right - containerRect.left + 12)
    : colLeft + 96
  const right = Math.max(colLeft + 120, colRight)
  const left = Math.max(colLeft, Math.min(rawLeft, right - 120))
  const width = right - left

  const surfaceY = introRect
    ? Math.round(introRect.bottom - containerRect.top)
    : Math.round(wordRect.top - containerRect.top - 8)

  return {
    left,
    top: surfaceY - height,
    width,
    height,
  }
}
