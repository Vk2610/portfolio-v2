export type FlightState =
  | 'GROUNDED'
  | 'TAKEOFF'
  | 'TRAVELLING'
  | 'HOVERING'
  | 'APPROACHING'
  | 'LANDING'
  | 'DESCENDING'

export interface FlightPoseFrame {
  state: FlightState
  hoverOffset: number
  boosterIntensity: number
  kneeBend: number
  armSpread: number
  legExtend: number
  isFlying: boolean
}

export const TAKEOFF_DURATION = 0.85
export const DESCENDING_DURATION = 0.9
export const TARGET_HOVER_HEIGHT = 0.95

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

function easeOutCubic(t: number): number {
  const u = 1 - Math.max(0, Math.min(1, t))
  return 1 - u * u * u
}

export interface FlightController {
  getState: () => FlightState
  isFlying: () => boolean
  startTakeoff: () => boolean
  startLanding: () => boolean
  reset: () => void
  setScrolling: (active: boolean) => void
  getInactiveTime: () => number
  approach: () => boolean
  beginLanding: () => boolean
  step: (dt: number, reduced: boolean) => FlightPoseFrame
}

export function createFlightController(): FlightController {
  let state: FlightState = 'GROUNDED'
  let elapsed = 0
  let hoverOffset = 0
  let startDescendHeight = TARGET_HOVER_HEIGHT
  let inactiveTime = 0
  let scrolling = false

  function startTakeoff(): boolean {
    if (state !== 'GROUNDED') return false
    state = 'TAKEOFF'
    elapsed = 0
    inactiveTime = 0
    scrolling = false
    hoverOffset = 0
    return true
  }

  function setScrolling(active: boolean) {
    scrolling = active
    if (state === 'GROUNDED') return
    if (active && ['APPROACHING', 'LANDING', 'DESCENDING'].includes(state)) {
      state = 'TRAVELLING'
      elapsed = 0
      inactiveTime = 0
      return
    }
    if (state === 'DESCENDING') return
    if (state === 'TAKEOFF') return
    state = active ? 'TRAVELLING' : 'HOVERING'
    inactiveTime = 0
  }

  function approach() {
    if (state !== 'HOVERING') return false
    state = 'APPROACHING'
    elapsed = 0
    startDescendHeight = TARGET_HOVER_HEIGHT
    return true
  }

  function beginLanding() {
    if (state !== 'APPROACHING') return false
    state = 'LANDING'
    elapsed = 0
    startDescendHeight = hoverOffset
    return true
  }

  function startLanding(): boolean {
    if (state !== 'HOVERING' && state !== 'TAKEOFF') return false
    startDescendHeight = hoverOffset
    state = 'DESCENDING'
    elapsed = 0
    return true
  }

  function reset() {
    state = 'GROUNDED'
    elapsed = 0
    hoverOffset = 0
    startDescendHeight = TARGET_HOVER_HEIGHT
    inactiveTime = 0
  }

  function step(dt: number, reduced: boolean): FlightPoseFrame {
    if (state === 'GROUNDED') {
      hoverOffset = 0
      return {
        state,
        hoverOffset: 0,
        boosterIntensity: 0,
        kneeBend: 0,
        armSpread: 0,
        legExtend: 0,
        isFlying: false,
      }
    }

    elapsed += dt

    if (state === 'TAKEOFF') {
      if (elapsed >= TAKEOFF_DURATION) {
        state = scrolling ? 'TRAVELLING' : 'HOVERING'
        elapsed = 0
        hoverOffset = TARGET_HOVER_HEIGHT
      } else {
        const crouchIn = smoothstep(0, 0.22, elapsed)
        const crouchOut = 1 - smoothstep(0.22, 0.45, elapsed)
        const kneeBend = crouchIn * crouchOut * 0.28
        const liftT = smoothstep(0.2, TAKEOFF_DURATION, elapsed)
        hoverOffset = TARGET_HOVER_HEIGHT * easeOutCubic(liftT)
        const boosterIntensity = smoothstep(0.05, 0.45, elapsed)
        const armSpread = smoothstep(0.22, 0.72, elapsed) * 0.32
        const legExtend = smoothstep(0.25, 0.7, elapsed) * 0.12
        return {
          state,
          hoverOffset,
          boosterIntensity,
          kneeBend,
          armSpread,
          legExtend,
          isFlying: true,
        }
      }
    }

    if (state === 'APPROACHING') {
      hoverOffset = TARGET_HOVER_HEIGHT
      if (elapsed >= 1) {
        state = 'LANDING'
        elapsed = 0
      }
      return {
        state,
        hoverOffset,
        boosterIntensity: 0.78,
        kneeBend: 0,
        armSpread: 0.3,
        legExtend: 0.12,
        isFlying: true,
      }
    }
    if (state === 'LANDING') {
      const t = smoothstep(0, 0.9, elapsed)
      hoverOffset = startDescendHeight * (1 - t)
      if (elapsed >= 0.9) {
        state = 'GROUNDED'
        hoverOffset = 0
        return {
          state,
          hoverOffset: 0,
          boosterIntensity: 0,
          kneeBend: 0,
          armSpread: 0,
          legExtend: 0,
          isFlying: false,
        }
      }
      return {
        state,
        hoverOffset,
        boosterIntensity: 0.78 * (1 - smoothstep(0.45, 0.9, elapsed)),
        kneeBend: Math.sin(t * Math.PI) * 0.18,
        armSpread: 0.25 * (1 - t),
        legExtend: 0.12 * (1 - t),
        isFlying: true,
      }
    }
    if (state === 'TRAVELLING' || state === 'HOVERING') {
      if (state === 'HOVERING') inactiveTime += dt
      else inactiveTime = 0
      const bob = reduced ? 0 : Math.sin(elapsed * 2.6) * 0.055
      hoverOffset = TARGET_HOVER_HEIGHT + bob
      const boosterIntensity = reduced
        ? 0.75
        : 0.78 + Math.sin(elapsed * 2.6 + 0.4) * 0.08
      const armSpread = 0.32 + (reduced ? 0 : Math.sin(elapsed * 2.6) * 0.03)
      return {
        state,
        hoverOffset,
        boosterIntensity,
        kneeBend: 0,
        armSpread,
        legExtend: 0.1 + (reduced ? 0 : Math.sin(elapsed * 2.6 - 0.5) * 0.025),
        isFlying: true,
      }
    }

    // DESCENDING
    if (elapsed >= DESCENDING_DURATION) {
      state = 'GROUNDED'
      elapsed = 0
      hoverOffset = 0
      return {
        state,
        hoverOffset: 0,
        boosterIntensity: 0,
        kneeBend: 0,
        armSpread: 0,
        legExtend: 0,
        isFlying: false,
      }
    }

    const descendT = smoothstep(0, 0.72, elapsed)
    hoverOffset = startDescendHeight * (1 - descendT)
    const touchdownT = smoothstep(0.66, DESCENDING_DURATION, elapsed)
    const kneeBend = Math.sin(touchdownT * Math.PI) * 0.24
    const boosterIntensity =
      0.8 * (1 - smoothstep(0.55, DESCENDING_DURATION, elapsed))
    const armSpread = 0.32 * (1 - smoothstep(0.5, DESCENDING_DURATION, elapsed))
    const legExtend = 0.1 * (1 - smoothstep(0.45, 0.72, elapsed))

    return {
      state,
      hoverOffset,
      boosterIntensity,
      kneeBend,
      armSpread,
      legExtend,
      isFlying: true,
    }
  }

  return {
    getState: () => state,
    isFlying: () => state !== 'GROUNDED',
    startTakeoff,
    startLanding,
    reset,
    setScrolling,
    getInactiveTime: () => inactiveTime,
    approach,
    beginLanding,
    step,
  }
}
