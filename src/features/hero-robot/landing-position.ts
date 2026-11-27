export interface LandingBounds {
  minX: number
  maxX: number
}

export interface LandingPoint {
  x: number
  directlyBelow: boolean
  distance: number
  inTravelDirection: boolean
}

export function selectLandingPoint(
  safeBounds: LandingBounds,
  visibleBounds: LandingBounds,
  currentX: number,
  currentY: number,
  platformY: number,
  direction: 'up' | 'down' = 'down',
): LandingPoint | null {
  const minX = Math.max(safeBounds.minX, visibleBounds.minX)
  const maxX = Math.min(safeBounds.maxX, visibleBounds.maxX)
  if (maxX < minX) return null

  if (currentX >= minX && currentX <= maxX) {
    return {
      x: currentX,
      directlyBelow: true,
      distance: Math.abs(currentY - platformY),
      inTravelDirection:
        direction === 'up' ? platformY >= currentY : platformY <= currentY,
    }
  }

  const x = Math.max(minX, Math.min(maxX, currentX))
  return {
    x,
    directlyBelow: false,
    distance: Math.hypot(currentX - x, currentY - platformY),
    inTravelDirection:
      direction === 'up' ? platformY >= currentY : platformY <= currentY,
  }
}
