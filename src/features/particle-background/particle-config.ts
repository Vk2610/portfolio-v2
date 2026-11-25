const referenceDensity = 0.6

export const particleConfig = {
  enabled: true,
  directionAngle: 45,
  density: referenceDensity,
  speedMultiplier: 0.55,
  visibilityIntensity: 0.7,
  desktopParticleCount: 90,
  mobileParticleCount: 40,
  minimumParticleSize: 0.5,
  maximumParticleSize: 2,
  minimumOpacity: 0.1,
  maximumOpacity: 0.65,
  particleShape: 'mixed' as 'mixed' | 'circle' | 'streak',
  depthLayers: 3,
  maximumDevicePixelRatio: 2,
  mobileBreakpoint: 768,
  desktopBreakpoint: 1024,
  foregroundStreakChance: 0.28,
  streakLengthMultiplier: 3,
  pulseAmplitude: 0.015,
  maximumFrameSeconds: 0.1,
}

export type ParticleConfig = typeof particleConfig

export function particleCount(width: number, config = particleConfig) {
  // The configured counts already represent the reference density.
  const densityFactor = config.density / referenceDensity
  const mobile = Math.max(
    30,
    Math.min(50, config.mobileParticleCount * densityFactor),
  )
  const desktop = Math.max(
    80,
    Math.min(120, config.desktopParticleCount * densityFactor),
  )
  const tabletShare = Math.max(
    0,
    Math.min(
      1,
      (width - config.mobileBreakpoint) /
        (config.desktopBreakpoint - config.mobileBreakpoint),
    ),
  )
  return Math.round(mobile + (desktop - mobile) * tabletShare)
}
