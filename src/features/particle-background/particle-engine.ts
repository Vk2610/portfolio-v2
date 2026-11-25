import { particleConfig, particleCount } from './particle-config'

type Particle = {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  phase: number
  pulseRate: number
  streak: boolean
}

export function createParticle(
  depth: number,
  width: number,
  height: number,
  config = particleConfig,
  random = Math.random,
): Particle {
  const weight = depth / Math.max(1, config.depthLayers - 1)
  const sizeWeight = (weight * 2 + random()) / 3
  const visibility = (weight * 2 + random()) / 3
  // Shape the layer distribution without multiplying the opacity range twice.
  // The configured opacity bounds remain reachable; intensity controls contrast.
  const opacityWeight = Math.pow(visibility, config.visibilityIntensity)
  return {
    x: random() * width,
    y: random() * height,
    size:
      config.minimumParticleSize +
      sizeWeight * (config.maximumParticleSize - config.minimumParticleSize),
    speed: (10 + weight * 22 + random() * 8) * config.speedMultiplier,
    opacity:
      config.minimumOpacity +
      opacityWeight * (config.maximumOpacity - config.minimumOpacity),
    phase: random() * 2 * Math.PI,
    pulseRate: 0.25 + random() * 0.35,
    streak:
      config.particleShape === 'streak' ||
      (config.particleShape === 'mixed' &&
        weight === 1 &&
        random() < config.foregroundStreakChance),
  }
}

export function movementVector(angle: number) {
  const radians = (angle * Math.PI) / 180
  return { x: Math.cos(radians), y: Math.sin(radians) }
}

function wrap(position: number, length: number, padding: number) {
  if (position >= -padding && position <= length + padding) return position
  const span = length + padding * 2
  return ((((position + padding) % span) + span) % span) - padding
}

export function advanceParticle(
  particle: Particle,
  direction: ReturnType<typeof movementVector>,
  elapsed: number,
  width: number,
  height: number,
  padding: number,
) {
  const distance = particle.speed * elapsed
  particle.x = wrap(particle.x + direction.x * distance, width, padding)
  particle.y = wrap(particle.y + direction.y * distance, height, padding)
}

export function createParticleEngine(
  canvas: HTMLCanvasElement,
  config = particleConfig,
) {
  if (!config.enabled) return null
  let context: CanvasRenderingContext2D | null
  try {
    context = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!context) return null
  const ctx = context
  const ink =
    getComputedStyle(canvas).getPropertyValue('--ink-50').trim() || '#fafafa'
  const direction = movementVector(config.directionAngle)
  // Recycle only when the complete painted shape has gone outside the viewport.
  const overscan =
    config.maximumParticleSize * (1 + config.streakLengthMultiplier)
  const particles: Particle[] = []
  let width = 0
  let height = 0
  let disposed = false
  let visible = false
  let reduced = false
  let frame: number | null = null
  let previousTime: number | null = null
  let elapsed = 0

  function draw(seconds: number) {
    ctx.clearRect(0, 0, width, height)
    for (const particle of particles) {
      if (seconds > 0)
        advanceParticle(particle, direction, seconds, width, height, overscan)
      const pulse = reduced
        ? 0
        : Math.sin(elapsed * particle.pulseRate + particle.phase) *
          config.pulseAmplitude *
          particle.opacity
      ctx.globalAlpha = Math.max(
        config.minimumOpacity,
        Math.min(config.maximumOpacity, particle.opacity + pulse),
      )
      ctx.beginPath()
      if (particle.streak) {
        const length = particle.size * config.streakLengthMultiplier
        ctx.lineWidth = particle.size
        ctx.moveTo(particle.x, particle.y)
        ctx.lineTo(
          particle.x + direction.x * length,
          particle.y + direction.y * length,
        )
        ctx.stroke()
      } else {
        ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  function tick(timestamp: number) {
    frame = null
    if (disposed || !visible || reduced) return
    const seconds =
      previousTime === null
        ? 0
        : Math.min(
            config.maximumFrameSeconds,
            (timestamp - previousTime) / 1000,
          )
    previousTime = timestamp
    elapsed += seconds
    draw(seconds)
    frame = requestAnimationFrame(tick)
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    previousTime = null
  }

  function refresh() {
    if (!visible || width <= 0 || height <= 0) {
      stop()
      return
    }
    draw(0)
    if (!reduced && frame === null) frame = requestAnimationFrame(tick)
  }

  return {
    resize(nextWidth: number, nextHeight: number, pixelRatio: number) {
      if (disposed) return
      const ratio = Math.min(
        config.maximumDevicePixelRatio,
        Math.max(1, pixelRatio),
      )
      const pixelWidth = Math.round(nextWidth * ratio)
      const pixelHeight = Math.round(nextHeight * ratio)
      if (
        nextWidth === width &&
        nextHeight === height &&
        canvas.width === pixelWidth &&
        canvas.height === pixelHeight
      )
        return

      if (width > 0 && height > 0 && nextWidth > 0 && nextHeight > 0) {
        for (const particle of particles) {
          particle.x *= nextWidth / width
          particle.y *= nextHeight / height
        }
      }

      width = nextWidth
      height = nextHeight
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      if (width > 0 && height > 0) {
        ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0)
        ctx.fillStyle = ctx.strokeStyle = ink
        ctx.lineCap = 'round'
        const count = particleCount(width, config)
        if (particles.length > count) particles.length = count
        while (particles.length < count) {
          particles.push(
            createParticle(
              particles.length % config.depthLayers,
              width,
              height,
              config,
            ),
          )
        }
      }
      refresh()
    },
    setPlayback(nextVisible: boolean, nextReduced: boolean) {
      if (disposed || (visible === nextVisible && reduced === nextReduced))
        return
      visible = nextVisible
      reduced = nextReduced
      stop()
      refresh()
    },
    destroy() {
      disposed = true
      stop()
    },
  }
}
