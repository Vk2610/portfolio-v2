export type HeroLandingTrajectory = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  velocity: { x: number; y: number }
  duration: number
  dip: number
  clearance: number
}

export function sampleHeroLandingTrajectory(
  curve: HeroLandingTrajectory,
  progress: number,
) {
  const t = Math.max(0, Math.min(1, progress))
  const u = 1 - t
  const dx = curve.to.x - curve.from.x
  const p1 = {
    x: curve.from.x + curve.velocity.x * curve.duration / 3,
    y: curve.from.y + curve.velocity.y * curve.duration / 3 - curve.dip,
  }
  const p2 = {
    x: curve.from.x + dx * 0.82,
    y: curve.to.y - curve.clearance,
  }
  return {
    x: u ** 3 * curve.from.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * curve.to.x,
    y: u ** 3 * curve.from.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * curve.to.y,
  }
}
