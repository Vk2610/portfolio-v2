import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'

export const trackingDefaults = {
  enabled: true,
  yaw: 45,
  pitch: 25,
  responsiveness: 9,
  sensitivity: 1,
  deadZone: 2.2,
  inactivity: 1800,
  returnSpeed: 4.2,
}

export function trackingAllowance(state, emotion, reduced = false) {
  if (
    reduced ||
    [
      'losing balance',
      'falling',
      'impact',
      'settling',
      'dizzy reaction',
      'recovering',
    ].includes(state) ||
    emotion === 'dizzy'
  )
    return 0
  if (emotion === 'angry' || emotion === 'happy') return 0.32
  if (state.startsWith('walking') || state === 'turning') return 0.48
  return 1
}

const { clamp, damp, degToRad, radToDeg, lerp } = MathUtils

export function createHeadTracking(rig, camera, getBounds) {
  let config = { ...trackingDefaults }
  let pointer = null
  let latencyUntil = 0
  let yaw = 0
  let pitch = 0
  let targetYaw = 0
  let targetPitch = 0
  let filteredYaw = 0
  let filteredPitch = 0
  let blend = 1
  const center = new Vector3()
  const screen = new Vector3()
  const projected = new Vector3()
  const delta = new Vector3()
  const axis = new Vector3()
  const bodyQ = new Quaternion()
  const jointQ = new Quaternion()
  const euler = new Euler(0, 0, 0, 'YXZ')
  const transform = new Matrix4()
  const sampleInTorso = new Vector3()

  function point(x, y, time, touch = false) {
    if (!pointer || pointer.touch !== touch)
      latencyUntil = time + (touch ? 30 : 65)
    if (!pointer || Math.hypot(pointer.x - x, pointer.y - y) >= 1.5 || touch) {
      pointer = { x, y, time, touch }
    }
  }

  function projectTarget() {
    const { left, top, width, height } = getBounds()
    if (!(width && height)) return
    rig.head.localToWorld(center.set(0, 0.976, 0.1))
    camera.updateMatrixWorld()
    screen.copy(center).project(camera)
    if (screen.z < -1 || screen.z > 1) return
    const x = (2 * (pointer.x - left)) / width - 1
    const y = 1 - (2 * (pointer.y - top)) / height
    projected.set(x, y, screen.z).unproject(camera)
    rig.root.getWorldQuaternion(bodyQ).invert()
    delta.copy(projected).sub(center).applyQuaternion(bodyQ)
    const size = rig.neck.scale.x * rig.root.scale.x
    // With the camera edge-on, a small horizontal component keeps screen
    // direction legible even though the pointer travels nearly along body Z.
    axis.set(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(bodyQ)
    const sideAssist =
      Math.max(0, 0.16 - Math.abs(axis.x)) * (x - screen.x) * 2.6
    const distance =
      Math.max(size * 0.7, size + delta.z * 0.13) / config.sensitivity
    const nextYaw = clamp(
      Math.atan2(delta.x + sideAssist, distance),
      -degToRad(config.yaw),
      degToRad(config.yaw),
    )
    const nextPitch = clamp(
      -Math.atan2(delta.y, distance),
      -degToRad(config.pitch),
      degToRad(config.pitch),
    )
    const zone = degToRad(config.deadZone)
    if (Math.abs(nextYaw - targetYaw) > zone || Math.abs(nextYaw) < zone) {
      targetYaw = Math.abs(nextYaw) < zone ? 0 : nextYaw
    }
    if (
      Math.abs(nextPitch - targetPitch) > zone ||
      Math.abs(nextPitch) < zone
    ) {
      targetPitch = Math.abs(nextPitch) < zone ? 0 : nextPitch
    }
  }

  function overlapsChest(testPitch, testYaw) {
    jointQ.setFromEuler(euler.set(testPitch, testYaw, 0))
    for (let i = 0; i < rig.headSamples.length; i += 5) {
      sampleInTorso.copy(rig.headSamples[i])
      sampleInTorso.y += 0.976
      sampleInTorso.applyQuaternion(jointQ).applyMatrix4(transform)
      const { x, y, z } = sampleInTorso
      if (y < 1.3 || y > 1.63) continue
      const level = (y - 1.3) / 0.33
      if (
        (x / lerp(0.52, 0.27, level)) ** 2 +
          ((z - 0.033) / lerp(0.43, 0.21, level)) ** 2 <
        1
      )
        return true
    }
    return false
  }

  function step(time, dt, state, emotion, reduced) {
    const allowance = trackingAllowance(state, emotion, reduced)
    const amount = config.enabled ? allowance : 0
    blend = damp(blend, amount, amount ? 9 : 14, dt)
    const fresh =
      pointer && time - pointer.time < (pointer.touch ? 480 : config.inactivity)
    const active = amount > 0 && fresh
    if (active && time >= latencyUntil) projectTarget()
    else if (!active) targetYaw = targetPitch = 0
    const speed = active ? config.responsiveness : config.returnSpeed
    filteredYaw = damp(filteredYaw, targetYaw, speed * 1.45, dt)
    filteredPitch = damp(filteredPitch, targetPitch, speed * 1.45, dt)
    yaw = damp(yaw, filteredYaw * blend, speed, dt)
    pitch = damp(pitch, filteredPitch * blend, speed, dt)
    let safePitch = clamp(
      pitch,
      -degToRad(config.pitch),
      degToRad(config.pitch),
    )
    let safeYaw = clamp(yaw, -degToRad(config.yaw), degToRad(config.yaw))
    if (allowance === 0 || (amount === 0 && blend < 0.005)) {
      yaw = pitch = safePitch = safeYaw = filteredYaw = filteredPitch = 0
    }
    if (amount && (Math.abs(safePitch) > 0.02 || Math.abs(safeYaw) > 0.02)) {
      rig.torso.updateWorldMatrix(true, false)
      rig.head.updateWorldMatrix(true, false)
      transform
        .copy(rig.torso.matrixWorld)
        .invert()
        .multiply(rig.head.matrixWorld)
      if (overlapsChest(safePitch, safeYaw) && !overlapsChest(0, 0)) {
        let low = 0,
          high = 1
        for (let i = 0; i < 7; i++) {
          const mid = (low + high) / 2
          if (overlapsChest(safePitch * mid, safeYaw * mid)) high = mid
          else low = mid
        }
        safePitch *= low
        safeYaw *= low
      }
    }
    rig.look.quaternion.setFromEuler(euler.set(safePitch, safeYaw, 0))
    return { yaw: radToDeg(safeYaw), pitch: radToDeg(safePitch) }
  }

  return {
    point,
    step,
    clear: () => {
      pointer = null
    },
    reset: () => {
      pointer = null
      yaw = pitch = targetYaw = targetPitch = filteredYaw = filteredPitch = 0
      rig.look.quaternion.identity()
    },
    configure: (next) => {
      config = { ...config, ...next }
    },
  }
}
