export interface LandingBounds {
  minX: number
  maxX: number
}

export interface LandingPoint {
  x: number
  directlyBelow: boolean
  distance: number
}

export function selectLandingPoint(
  safeBounds: LandingBounds,
  visibleBounds: LandingBounds,
  currentX: number,
  currentY: number,
  platformY: number,
): LandingPoint | null {
  const minX = Math.max(safeBounds.minX, visibleBounds.minX)
  const maxX = Math.min(safeBounds.maxX, visibleBounds.maxX)
  if (maxX < minX || platformY >= currentY) return null

  if (currentX >= minX && currentX <= maxX) {
    return {
      x: currentX,
      directlyBelow: true,
      distance: currentY - platformY,
    }
  }

  const x = Math.max(minX, Math.min(maxX, currentX))
  return {
    x,
    directlyBelow: false,
    distance: Math.hypot(currentX - x, currentY - platformY),
  }
}
