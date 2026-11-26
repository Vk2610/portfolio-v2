const PARTICLE_COUNT = 3
const ORBIT_RADIUS = 8
const PRESSED_RADIUS = 3
const RELEASE_RADIUS = 10
const ORBIT_SPEED = 1.5
const CYAN_RGB = [0, 229, 255] as const
const RED_RGB = [255, 51, 68] as const

interface Particle {
  el: HTMLSpanElement
  x: number
  y: number
  vx: number
  vy: number
  stiffness: number
  damping: number
  phase: number
}

export interface MagneticRobotCursor {
  setPointer: (x: number, y: number) => void
  setHover: (hovering: boolean) => void
  setPressed: (pressed: boolean) => void
  releaseBurst: () => void
  touchPress: (x: number, y: number) => void
  touchRelease: () => void
  step: (
    timeMs: number,
    dt: number,
    angryWeight: number,
    reduced: boolean,
  ) => boolean
  destroy: () => void
}

export function interpolateParticleColor(angryWeight: number): string {
  const t = Math.min(1, Math.max(0, angryWeight))
  const r = Math.round(CYAN_RGB[0] + (RED_RGB[0] - CYAN_RGB[0]) * t)
  const g = Math.round(CYAN_RGB[1] + (RED_RGB[1] - CYAN_RGB[1]) * t)
  const b = Math.round(CYAN_RGB[2] + (RED_RGB[2] - CYAN_RGB[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function createMagneticRobotCursor(): MagneticRobotCursor {
  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('data-robot-magnetic-cursor', '')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '9998'
  overlay.style.pointerEvents = 'none'
  overlay.style.overflow = 'hidden'
  overlay.style.opacity = '0'
  overlay.style.transition = 'opacity var(--duration-fast, 150ms) ease-in-out'

  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el = document.createElement('span')
    el.style.position = 'fixed'
    el.style.top = '0'
    el.style.left = '0'
    el.style.width = '3px'
    el.style.height = '3px'
    el.style.borderRadius = '9999px'
    el.style.backgroundColor = 'rgb(0, 229, 255)'
    el.style.willChange = 'transform'
    overlay.appendChild(el)

    particles.push({
      el,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      stiffness: 260 + i * 10,
      damping: 24 + i * 1.2,
      phase: (i * Math.PI * 2) / PARTICLE_COUNT,
    })
  }

  document.body.appendChild(overlay)

  let pointerX = 0
  let pointerY = 0
  let hovering = false
  let pressed = false
  let releaseExpandUntil = 0
  let touchActive = false
  let touchFadeUntil = 0
  let initialized = false
  let activeRobotFlag = false
  let lastColor = ''

  function syncGlobalCursorFlag(active: boolean) {
    if (active === activeRobotFlag) return
    activeRobotFlag = active
    const html = document.documentElement
    if (active) {
      html.setAttribute('data-cursor-robot', 'true')
    } else {
      html.removeAttribute('data-cursor-robot')
    }
    window.dispatchEvent(
      new CustomEvent('portfolio:robot-cursor', { detail: { active } }),
    )
  }

  function snapParticles(
    x: number,
    y: number,
    radius: number,
    timeSec: number,
  ) {
    for (const p of particles) {
      const angle = timeSec * ORBIT_SPEED + p.phase
      p.x = x + Math.cos(angle) * radius
      p.y = y + Math.sin(angle) * radius
      p.vx = 0
      p.vy = 0
    }
  }

  function setPointer(x: number, y: number) {
    pointerX = x
    pointerY = y
    if (!initialized) {
      initialized = true
      snapParticles(x, y, ORBIT_RADIUS, performance.now() / 1000)
    }
  }

  function setHover(next: boolean) {
    if (hovering === next) return
    hovering = next
    if (hovering) {
      touchActive = false
      snapParticles(
        pointerX,
        pointerY,
        pressed ? PRESSED_RADIUS : ORBIT_RADIUS,
        performance.now() / 1000,
      )
    }
  }

  function setPressed(next: boolean) {
    pressed = next
    if (pressed) releaseExpandUntil = 0
  }

  function releaseBurst() {
    pressed = false
    releaseExpandUntil = performance.now() + 110
  }

  function touchPress(x: number, y: number) {
    pointerX = x
    pointerY = y
    touchActive = true
    touchFadeUntil = Infinity
    pressed = true
    releaseExpandUntil = 0
    initialized = true
    snapParticles(x, y, ORBIT_RADIUS, performance.now() / 1000)
  }

  function touchRelease() {
    if (!touchActive) return
    releaseBurst()
    touchFadeUntil = performance.now() + 280
  }

  function step(
    timeMs: number,
    dt: number,
    angryWeight: number,
    reduced: boolean,
  ): boolean {
    if (reduced) {
      overlay.style.opacity = '0'
      syncGlobalCursorFlag(false)
      return false
    }

    if (touchActive && !pressed && timeMs >= touchFadeUntil) {
      touchActive = false
    }

    const visible = hovering || touchActive
    overlay.style.opacity = visible ? '1' : '0'
    syncGlobalCursorFlag(hovering)

    if (!visible) return false

    const timeSec = timeMs / 1000
    const targetRadius = pressed
      ? PRESSED_RADIUS
      : timeMs < releaseExpandUntil
        ? RELEASE_RADIUS
        : ORBIT_RADIUS
    const color = interpolateParticleColor(angryWeight)
    const colorChanged = color !== lastColor
    if (colorChanged) lastColor = color

    const stepDt = Math.min(dt, 0.033)
    for (const p of particles) {
      const angle = timeSec * ORBIT_SPEED + p.phase
      const targetX = pointerX + Math.cos(angle) * targetRadius
      const targetY = pointerY + Math.sin(angle) * targetRadius

      const ax = (targetX - p.x) * p.stiffness - p.vx * p.damping
      const ay = (targetY - p.y) * p.stiffness - p.vy * p.damping
      p.vx += ax * stepDt
      p.vy += ay * stepDt
      p.x += p.vx * stepDt
      p.y += p.vy * stepDt

      if (colorChanged) {
        p.el.style.backgroundColor = color
      }
      p.el.style.transform = `translate3d(${p.x - 1.5}px, ${p.y - 1.5}px, 0)`
    }

    return true
  }

  function destroy() {
    syncGlobalCursorFlag(false)
    overlay.remove()
  }

  return {
    setPointer,
    setHover,
    setPressed,
    releaseBurst,
    touchPress,
    touchRelease,
    step,
    destroy,
  }
}
