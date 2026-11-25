import { describe, expect, it, vi } from 'vitest'
import {
  particleConfig,
  particleCount,
} from '../src/features/particle-background/particle-config'
import {
  advanceParticle,
  createParticle,
  createParticleEngine,
  movementVector,
} from '../src/features/particle-background/particle-engine'

describe('ambient particle configuration and geometry', () => {
  it('uses the approved density once and interpolates between mobile and desktop counts', () => {
    expect(particleConfig).toMatchObject({
      enabled: true,
      directionAngle: 45,
      density: 0.6,
      speedMultiplier: 0.55,
      visibilityIntensity: 0.7,
      minimumParticleSize: 0.5,
      maximumParticleSize: 2,
      minimumOpacity: 0.1,
      maximumOpacity: 0.65,
      particleShape: 'mixed',
      depthLayers: 3,
      maximumDevicePixelRatio: 2,
    })
    expect(particleCount(390)).toBe(40)
    expect(particleCount(896)).toBe(65)
    expect(particleCount(1440)).toBe(90)
    expect(particleCount(1440, { ...particleConfig, density: 0.7 })).toBe(105)
  })

  it('makes foreground particles larger, brighter and faster than background particles', () => {
    const back = createParticle(0, 300, 300, particleConfig, () => 0.25)
    const mid = createParticle(1, 300, 300, particleConfig, () => 0.25)
    const front = createParticle(2, 300, 300, particleConfig, () => 0.25)
    for (const key of ['size', 'speed', 'opacity'] as const) {
      expect(back[key]).toBeLessThan(mid[key])
      expect(mid[key]).toBeLessThan(front[key])
    }
    expect(back.streak).toBe(false)
    expect(front.streak).toBe(true)
  })

  it('keeps opacity within the configured range and can reach its maximum', () => {
    const brightest = createParticle(2, 300, 300, particleConfig, () => 1)
    const dimmest = createParticle(0, 300, 300, particleConfig, () => 0)
    expect(dimmest.opacity).toBeGreaterThanOrEqual(
      particleConfig.minimumOpacity,
    )
    expect(brightest.opacity).toBe(particleConfig.maximumOpacity)
  })

  it('preserves the diagonal on a wide viewport and wraps outside the painted area', () => {
    const particle = {
      ...createParticle(0, 300, 100),
      x: 0,
      y: 0,
      speed: Math.SQRT2 * 10,
    }
    const direction = movementVector(45)
    advanceParticle(particle, direction, 0.5, 300, 100, 8)
    expect(particle.x).toBeCloseTo(5)
    expect(particle.y).toBeCloseTo(5)

    particle.x = 307
    particle.y = 107
    advanceParticle(particle, direction, 0.3, 300, 100, 8)
    expect(particle.x).toBeCloseTo(-6)
    expect(particle.y).toBeCloseTo(-6)
  })
})

describe('ambient particle lifecycle', () => {
  it('draws a static frame for reduced motion and resets elapsed time after pause', () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
    }
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const frames = new Map<number, FrameRequestCallback>()
    let nextId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback)
      return nextId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const randomness = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const frameAt = (timestamp: number) => {
      const [id, callback] = frames.entries().next().value!
      frames.delete(id)
      callback(timestamp)
    }

    try {
      const engine = createParticleEngine(canvas)!
      engine.resize(390, 800, 3)
      expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
      expect(frames.size).toBe(0)

      engine.setPlayback(true, true)
      expect(ctx.arc).toHaveBeenCalledTimes(40)
      expect(frames.size).toBe(0)
      engine.resize(400, 810, 2)
      expect(ctx.arc).toHaveBeenCalledTimes(80)
      expect(frames.size).toBe(0)

      engine.setPlayback(true, false)
      expect(frames.size).toBe(1)
      frameAt(1000)
      frameAt(1016)
      const beforePause = ctx.arc.mock.calls.at(-1)
      engine.setPlayback(false, false)
      expect(frames.size).toBe(0)
      engine.setPlayback(true, false)
      frameAt(10_000)
      expect(ctx.arc.mock.calls.at(-1)?.slice(0, 2)).toEqual(
        beforePause?.slice(0, 2),
      )

      engine.destroy()
      expect(frames.size).toBe(0)
      engine.setPlayback(true, false)
      expect(frames.size).toBe(0)
    } finally {
      randomness.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('skips context setup if disabled and tolerates unavailable Canvas 2D', () => {
    const canvas = document.createElement('canvas')
    const context = vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    expect(
      createParticleEngine(canvas, { ...particleConfig, enabled: false }),
    ).toBeNull()
    expect(context).not.toHaveBeenCalled()
    expect(createParticleEngine(canvas)).toBeNull()
  })
})
