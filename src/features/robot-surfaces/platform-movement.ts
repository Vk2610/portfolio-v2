import type { WorldSurface } from './surface-registry'

export interface PlatformBounds {
  surface: WorldSurface
  canStand: boolean
  canWalk: boolean
  minX: number
  maxX: number
  walkableWidth: number
}

const STAND_MARGIN = 0.1
const WALK_CLEARANCE = 0.08
const MIN_WALK_SPAN = 0.35

export function evaluatePlatformBounds(
  surface: WorldSurface,
  robotHalfWidth: number,
): PlatformBounds {
  const minStandWidth = robotHalfWidth * 2 + STAND_MARGIN
  if (surface.width < minStandWidth) {
    return {
      surface,
      canStand: false,
      canWalk: false,
      minX: surface.x,
      maxX: surface.x,
      walkableWidth: 0,
    }
  }

  const walkSpan = surface.width - (robotHalfWidth * 2 + WALK_CLEARANCE * 2)
  if (walkSpan < MIN_WALK_SPAN) {
    return {
      surface,
      canStand: true,
      canWalk: false,
      minX: surface.x,
      maxX: surface.x,
      walkableWidth: 0,
    }
  }

  return {
    surface,
    canStand: true,
    canWalk: true,
    minX: surface.x - walkSpan / 2,
    maxX: surface.x + walkSpan / 2,
    walkableWidth: walkSpan,
  }
}
