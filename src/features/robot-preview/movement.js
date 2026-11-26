import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { getRig, solveLimb } from './rig.js'

const { clamp, lerp, damp } = MathUtils
const step = (t) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const yAxis = new Vector3(0, 1, 0)
const xAxis = new Vector3(1, 0, 0)
const zAxis = new Vector3(0, 0, 1)

export const movementDefaults = {
  walkSpeed: 0.55,
  strideLength: 0.4,
  breathingIntensity: 1,
  breathingPeriod: 3.65,
  jumpHeight: 0.19,
  transitionSpeed: 9,
}

export function landingOrientation(rotation) {
  const up = yAxis.clone().applyQuaternion(rotation)
  const forward = zAxis.clone().applyQuaternion(rotation)
  const right = xAxis.clone().applyQuaternion(rotation)
  if (up.y > 0.58) return 'seated'
  if (Math.abs(forward.y) >= Math.abs(right.y))
    return forward.y < 0 ? 'front' : 'back'
  return right.y < 0 ? 'right' : 'left'
}

function facing(rotation) {
  const forward = zAxis.clone().applyQuaternion(rotation)
  const right = xAxis.clone().applyQuaternion(rotation)
  return Math.hypot(forward.x, forward.z) > 0.47
    ? Math.atan2(forward.x, forward.z)
    : Math.atan2(-right.z, right.x)
}

function sampleSupport(rig) {
  const meshes = rig.hitMeshes.map((mesh) => {
    const positions = mesh.geometry.getAttribute('position')
    const samples = []
    const interval = Math.max(1, Math.floor(positions.count / 180))
    for (let index = 0; index < positions.count; index += interval) {
      samples.push(new Vector3().fromBufferAttribute(positions, index))
    }
    return { mesh, samples }
  })
  return () => {
    rig.root.updateMatrixWorld(true)
    let low = Infinity
    for (const { mesh, samples } of meshes) {
      const m = mesh.matrixWorld.elements
      for (const { x, y, z } of samples)
        low = Math.min(low, m[1] * x + m[5] * y + m[9] * z + m[13])
    }
    return low
  }
}

export function createMovement(robot, physics, emotions, physicsOptions) {
  const rig = getRig(robot)
  const lowest = sampleSupport(rig)
  const { root, body, neck, torso, head, sides } = rig
  let options = { ...movementDefaults }
  let physical = { ...physicsOptions }
  let state = 'idle'
  let age = 0
  let yaw = 0
  let route = 0
  let speed = 0
  let phase = 0.12
  let walkMix = 0
  let emotion = 'neutral'
  let floor = 0
  let airborne = false
  let lastEmotion = 'neutral'
  let fallDirection = 'front'
  let hit = false
  let jump = null
  let landing = null
  let sequence = null
  let currentPhysics = null
  let stopYaw = null
  let flight = null
  let dragging = false
  let softLanding = null

  const goal = new Vector3()
  const pole = new Vector3()
  const anchor = new Vector3()
  const armTarget = new Vector3()
  const rotation = new Quaternion()
  const baseRotation = new Quaternion()
  const q = new Quaternion()
  const authored = new Quaternion()
  const euler = new Euler(0, 0, 0, 'YXZ')
  const velocities = new Vector3()
  const angular = new Vector3()
  const currentJoints = rig.joints.map(() => new Quaternion())
  const physicalStates = new Set([
    'losing balance',
    'falling',
    'impact',
    'settling',
    'dizzy reaction',
    'recovering',
    'powered flight',
    'landing approach',
    'soft landing',
    'dragging',
  ])
  const isLocked = () => physicalStates.has(state)

  function setState(next) {
    if (state === next) return
    age = 0
    state = next
  }

  function bodyOffset(localY) {
    body.position.y += localY
    neck.position.y += localY
  }

  function keepAboveGround(amount = 1) {
    const correction = floor - lowest() + 0.004
    root.position.y += correction > 0 ? correction : correction * amount
  }

  function levelLeg(side, endpoint, amount = 1) {
    rig.levelFoot(solveFoot(side, endpoint, amount), amount)
  }

  function solveFoot({ leg, sign }, endpoint, amount) {
    pole.set(sign * 0.52, 0.5, 1.2)
    body.localToWorld(pole)
    solveLimb(leg, endpoint, pole, amount)
    return leg
  }

  function gait(dt, time, reduced) {
    const intended = route ? 0 : (stopYaw ?? yaw)
    const difference = wrap(intended - yaw)
    const ready = Math.abs(difference) < 0.012
    const canWalk = emotion === 'neutral'
    const desired = route && ready && canWalk ? options.walkSpeed : 0
    speed = damp(speed, desired, state === 'arms folded' ? 13 : 8, dt)
    if (speed < 0.035 && !ready && canWalk) {
      yaw += clamp(difference, -2.75 * dt, 2.75 * dt)
      yaw = wrap(yaw)
    }
    if (ready && stopYaw !== null) stopYaw = null
    root.quaternion.setFromAxisAngle(yAxis, yaw)
    walkMix = damp(walkMix, desired || speed > 0.028 ? 1 : 0, 12, dt)
    const movement = speed > 0.014 ? speed * dt : 0
    root.position.x += route * movement
    const support = physics.floorAt(
      root.position.x,
      root.position.z,
      floor + 0.08,
    )
    if (support < floor - 0.06) {
      beginFall('front')
      return
    }
    floor = support
    root.position.y = floor
    if (Math.abs(root.position.x) > 2.05 && route) route = 0
    const legScale = body.scale.x * root.scale.x
    const stride = Math.min(
      (options.strideLength * legScale) / 0.6,
      legScale * 0.61,
    )
    if (movement > 0) phase = (phase + (movement / stride) * 0.63) % 1
    if (walkMix > 0.008) {
      const pulse = Math.sin(phase * Math.PI * 4)
      bodyOffset((-0.061 + pulse * 0.013) * body.scale.x * walkMix)
      rig.offset(
        torso,
        0.045 * walkMix,
        Math.sin(phase * Math.PI * 2) * 0.085 * walkMix,
        0.023 * pulse * walkMix,
      )
      rig.offset(
        head,
        -0.031 * walkMix,
        -Math.sin(phase * Math.PI * 2) * 0.035 * walkMix,
        0,
      )
      for (const side of sides) {
        const p = (phase + (side.sign > 0 ? 0.5 : 0)) % 1
        const inStance = p < 0.63
        const swing = (p - 0.63) / 0.37
        const offset = inStance ? 0.5 - p / 0.63 : -0.5 + step(swing)
        const lift = inStance ? 0 : Math.sin(swing * Math.PI) ** 1.5 * 0.16
        goal.copy(side.leg.neutral)
        goal.z += (offset * stride) / legScale
        goal.y += lift - body.position.y / body.scale.x
        body.localToWorld(goal)
        levelLeg(side, goal, walkMix)
        rig.offset(
          side.arm.upper,
          -Math.sin(p * 2 * Math.PI) * 0.39 * walkMix,
          0,
          0,
        )
        rig.offset(side.arm.joint, -0.15 * walkMix, 0, 0)
      }
    } else if (!reduced) {
      const breath = Math.sin((time * 2 * Math.PI) / options.breathingPeriod)
      const intensity = options.breathingIntensity
      torso.position.y = 0.78 + breath * 0.012 * intensity
      neck.position.y += breath * 0.008 * body.scale.x * intensity
      rig.offset(
        torso,
        0.012 * breath * intensity,
        0,
        Math.sin(time * 0.74) * 0.014 * intensity,
      )
      rig.offset(
        head,
        0.014 * Math.sin(time * 0.92),
        0,
        0.025 * Math.sin(time * 0.54),
      )
      for (const { arm, sign } of sides)
        rig.offset(arm.upper, 0, 0, sign * breath * 0.018 * intensity)
    }
    if (canWalk) {
      if (!ready && speed < 0.035) setState('turning')
      else if (route || speed > 0.03)
        setState(route < 0 ? 'walking left' : 'walking right')
      else setState('idle')
    } else if (emotion === 'happy' || fold < 0.005) setState('idle')
  }

  function jumpPose(height, crouch, spread) {
    root.position.y = floor + height
    const squat = -crouch * body.scale.x
    bodyOffset(squat)
    for (const side of sides) {
      goal.copy(side.leg.neutral)
      goal.y -= squat / body.scale.x
      body.localToWorld(goal)
      levelLeg(side, goal, step(crouch * 12))
      rig.offset(side.arm.upper, -0.14 * spread, 0, side.sign * 1.09 * spread)
      rig.offset(side.arm.joint, -0.25 * spread, 0, 0)
    }
  }

  function startJump() {
    if (jump || isLocked()) return
    const height =
      (rig.baseHeightForScale() + neck.scale.x * 2.22) * root.scale.x
    jump = {
      elapsed: 0,
      v: Math.sqrt(2 * physical.gravity * height * options.jumpHeight),
      gravity: physical.gravity,
    }
    speed = 0
    walkMix = 0
    setState('jump anticipation')
  }

  function playJump(dt) {
    jump.elapsed += dt
    const anticipation = 0.22
    const flight = (2 * jump.v) / jump.gravity
    const t = jump.elapsed - anticipation
    const land = t - flight
    airborne = t >= 0 && land < 0
    if (t < 0) {
      setState('jump anticipation')
      jumpPose(
        0,
        0.17 * Math.sin((Math.PI * jump.elapsed) / anticipation),
        step(jump.elapsed / anticipation),
      )
    } else if (land < 0) {
      setState('jumping')
      jumpPose(
        jump.v * t - (jump.gravity * t * t) / 2,
        Math.sin((Math.PI * t) / flight) * 0.25,
        1,
      )
    } else {
      setState('jump landing')
      const p = land / 0.34
      jumpPose(0, 0.21 * Math.sin(Math.PI * clamp(p, 0, 1)), 1 - step(p))
      if (p >= 1) jump = null
    }
  }

  let fold = 0
  function foldArms(dt) {
    fold = damp(fold, Number(emotion === 'angry'), options.transitionSpeed, dt)
    if (fold < 0.005) return
    for (const { arm, sign } of sides) {
      const y = sign < 0 ? 1.09 : 0.84
      const z = sign < 0 ? 0.64 : 0.73
      goal.set(-sign * 0.04, y, z)
      pole.set(sign * 1.0, 0.68, 0.57)
      torso.localToWorld(goal)
      torso.localToWorld(pole)
      solveLimb(arm, goal, pole, fold)
      armTarget.set(-sign * 0.38, y + 0.04, z + 0.015)
      torso.localToWorld(armTarget)
      rig.aimHand(arm, armTarget, fold)
    }
    setState(
      emotion !== 'angry'
        ? 'unfolding arms'
        : fold < 0.95
          ? 'folding arms'
          : 'arms folded',
    )
  }

  function beginFall(
    direction = 'front',
    { balance = false, drop = false } = {},
  ) {
    if (isLocked()) return false
    const vertical =
      jump && airborne ? jump.v - jump.gravity * (jump.elapsed - 0.22) : 0
    velocities.set(Math.sin(yaw) * speed, vertical, Math.cos(yaw) * speed)
    speed = 0
    walkMix = 0
    jump = null
    route = 0
    stopYaw = null
    fallDirection = direction
    hit = false
    landing = null
    if (drop) root.position.y += physical.dropHeight
    if (balance && !airborne) setState('losing balance')
    else launchFall()
    return true
  }

  function launchFall() {
    const toward =
      fallDirection === 'front' ? 1 : fallDirection === 'back' ? -1 : 0
    const lateral =
      fallDirection === 'left' ? 1 : fallDirection === 'right' ? -1 : 0
    angular
      .set(toward * 2.9, 0.22, lateral * 2.7)
      .applyQuaternion(root.quaternion)
    anchor
      .set(-lateral * 0.48, 0, toward * 0.52)
      .applyQuaternion(root.quaternion)
    velocities.add(anchor)
    physics.start({ velocity: velocities, roll: angular })
    setState('falling')
  }

  function captureLanding() {
    landing = {
      q: root.quaternion.clone(),
      positionY: root.position.y,
      orientation: landingOrientation(root.quaternion),
      yaw: facing(root.quaternion),
      side: landingOrientation(root.quaternion) === 'left' ? -1 : 1,
      joints: rig.joints.map((joint) => joint.quaternion.clone()),
    }
    yaw = landing.yaw
    floor = currentPhysics.supportHeight
    physics.clear()
    currentPhysics = null
  }

  function beginPoweredFlight(target) {
    if (
      dragging ||
      ['recovering', 'dizzy reaction', 'losing balance'].includes(state) ||
      jump
    )
      return false
    if (state === 'falling' || state === 'impact' || state === 'settling')
      physics.prepareFlight()
    else
      physics.start({
        velocity: { x: 0, y: 0.45, z: 0 },
        roll: { x: 0, y: 0, z: 0 },
      })
    route = speed = walkMix = 0
    jump = null
    yaw = 0
    flight = { target: { ...target }, landing: false, thrust: 1 }
    hit = false
    currentPhysics = null
    emotions.resetEmotion()
    setState('powered flight')
    return true
  }

  function setFlightTarget(target) {
    if (!flight || !target) return false
    flight.target = { ...target }
    flight.landing = true
    if (state === 'powered flight') setState('landing approach')
    return true
  }

  function endPoweredFlight() {
    if (!flight) return false
    flight = null
    currentPhysics = null
    hit = false
    setState('falling')
    return true
  }

  function startDrag() {
    if (dragging) return true
    dragging = true
    flight = null
    route = speed = walkMix = 0
    jump = null
    yaw = 0
    root.quaternion.setFromAxisAngle(yAxis, 0)
    physics.prepareFlight()
    currentPhysics = null
    hit = false
    emotions.resetEmotion()
    setState('dragging')
    return true
  }

  function dragTo(position) {
    if (!dragging) return false
    physics.dragTo(position)
    root.position.set(position.x, position.y, position.z)
    root.quaternion.identity()
    return true
  }

  function endDrag(velocity = { x: 0, y: 0, z: 0 }) {
    if (!dragging) return false
    dragging = false
    physics.releaseDrag(velocity)
    flight = null
    currentPhysics = null
    hit = false
    setState('falling')
    return true
  }

  function physicalPose(amount, balance = false) {
    for (const { sign, arm, leg } of sides) {
      rig.offset(
        arm.upper,
        -0.32 * amount,
        sign * 0.17 * amount,
        sign * 0.64 * amount,
      )
      rig.offset(arm.joint, -0.36 * amount, 0, 0)
      rig.offset(leg.upper, -0.29 * amount + sign * 0.18 * amount, 0, 0)
      rig.offset(leg.joint, 0.48 * amount, 0, 0)
    }
    if (balance) rig.offset(head, -0.1 * amount, 0, -0.14 * amount)
  }

  function seatPose(amount, kneel = 0) {
    for (const { arm, leg, sign } of sides) {
      rig.offset(
        leg.upper,
        (-1.1 + kneel * 0.95) * amount,
        0,
        sign * 0.1 * amount,
      )
      rig.offset(leg.joint, (1.18 + kneel * 0.14) * amount, 0, 0)
      rig.offset(leg.tip, -0.29 * amount, 0, 0)
      rig.offset(arm.upper, 0.28 * amount, 0, sign * 0.1 * amount)
    }
  }

  function headingPose(lean, roll) {
    baseRotation.setFromAxisAngle(yAxis, yaw)
    return rotation
      .copy(baseRotation)
      .multiply(q.setFromEuler(euler.set(lean, 0, roll)))
  }

  function supportArm(side, amount) {
    if (amount < 0.01) return
    const arm = side.arm
    arm.upper.getWorldPosition(goal)
    goal.x += side.sign * 0.16 * body.scale.x * root.scale.x
    goal.y = floor + 0.25 * body.scale.x * root.scale.x
    goal.z += 0.17 * body.scale.x * root.scale.x
    arm.upper.getWorldPosition(pole)
    pole.x += side.sign * 0.45
    pole.z -= 0.21
    solveLimb(arm, goal, pole, amount)
  }

  function dizzyPose(time, reduced) {
    const isFall = Boolean(landing)
    const p = step(age / 0.72)
    const side = landing?.side ?? 1
    if (isFall) {
      root.quaternion.copy(landing.q).slerp(headingPose(-0.52, side * -0.1), p)
      seatPose(p)
      root.position.y = lerp(landing.positionY, floor, p)
      keepAboveGround(p)
      supportArm(
        sides.find((limb) => limb.sign !== side),
        p * 0.9,
      )
    }
    const wobble = reduced
      ? 0
      : Math.sin(time * 10) * Math.exp(-age * 0.55) * 0.055
    rig.offset(
      head,
      0.06 * p + wobble,
      wobble * 0.65,
      -side * (0.22 * p + wobble),
    )
    const chosen = sides.find((limb) => limb.sign === side)
    const { arm } = chosen
    rig.helmetContact(side, arm, armTarget)
    arm.upper.getWorldPosition(anchor)
    goal.copy(armTarget).sub(anchor).normalize()
    goal.multiplyScalar(-body.scale.x * root.scale.x * 0.24).add(armTarget)
    pole.set(side * 1.4, 0.8, 0.55)
    torso.localToWorld(pole)
    solveLimb(arm, goal, pole, p)
    rig.aimHand(arm, armTarget, p)
    if (isFall) {
      rig.joints.forEach((joint, index) =>
        joint.quaternion.slerp(landing.joints[index], 1 - p),
      )
    }
    if (isFall) keepAboveGround(Math.min(p, 0.7))
  }

  function startRecovery() {
    if (state !== 'dizzy reaction') return false
    if (!landing) {
      setState('idle')
      emotion = 'neutral'
      emotions.resetEmotion()
      return true
    }
    sequence = {
      q: root.quaternion.clone(),
      y: root.position.y,
      joints: rig.joints.map((joint) => joint.quaternion.clone()),
    }
    emotions.resetEmotion()
    setState('recovering')
    return true
  }

  function recover() {
    const p = clamp(age / 1.65, 0, 1)
    const shift = step(p / 0.54)
    const rise = step((p - 0.51) / 0.49)
    const side = landing.side
    const roll = ['left', 'right'].includes(landing.orientation)
      ? -side * 0.32
      : 0
    const lean = landing.orientation === 'front' ? 0.76 : 0.53
    root.quaternion
      .copy(sequence.q)
      .slerp(
        headingPose(lean * (1 - rise), roll * Math.sin(Math.PI * shift)),
        shift,
      )
    seatPose((1 - rise) * step(p / 0.35), shift)
    rig.joints.forEach((joint, index) =>
      joint.quaternion.slerp(sequence.joints[index], 1 - step(p / 0.35)),
    )
    root.position.y = lerp(sequence.y, floor, shift)
    keepAboveGround(step(p / 0.22))
    const brace = step(p / 0.21) * (1 - step((p - 0.42) / 0.31))
    for (const limb of sides) {
      const correctSide =
        landing.orientation === 'front' ||
        landing.orientation === 'seated' ||
        limb.sign === side
      if (correctSide) supportArm(limb, brace)
    }
    bodyOffset(-0.05 * body.scale.x * Math.sin(Math.PI * p))
    keepAboveGround(step(p / 0.17))
    if (p === 1) {
      landing = null
      sequence = null
      setState('idle')
    }
  }

  function update(time, dt, reduced = false) {
    age += dt
    emotion = emotions.getCurrentEmotion()
    const timeSec = time / 1000
    rig.joints.forEach((joint, index) =>
      currentJoints[index].copy(joint.quaternion),
    )
    torso.position.y = 0.78
    rig.rest()
    airborne = false
    if (state === 'losing balance') {
      const p = step(age / 0.3)
      const signed = fallDirection === 'back' ? -1 : 1
      const side =
        fallDirection === 'left' ? 1 : fallDirection === 'right' ? -1 : 0
      root.quaternion.copy(
        headingPose(side ? 0 : signed * p * 0.16, side * p * 0.16),
      )
      physicalPose(p, true)
      keepAboveGround()
      if (age >= 0.3) launchFall()
    } else if (state === 'dragging') {
      const brace = reduced ? 0.14 : 0.19
      for (const { arm, leg, sign } of sides) {
        rig.offset(arm.upper, -0.12, 0, sign * brace)
        rig.offset(arm.joint, -0.08, 0, 0)
        rig.offset(leg.upper, -0.025, 0, 0)
        rig.offset(leg.joint, 0.04, 0, 0)
      }
    } else if (state === 'powered flight' || state === 'landing approach') {
      const landingApproach = state === 'landing approach'
      physics.controlFlight(flight?.target, dt, landingApproach)
      currentPhysics = physics.advance(dt)
      const armSpread = landingApproach ? 0.24 : 0.32
      for (const { arm, leg, sign } of sides) {
        rig.offset(arm.upper, -0.16, 0, sign * armSpread)
        rig.offset(arm.joint, -0.08, 0, 0)
        rig.offset(leg.upper, -0.035, 0, 0)
        rig.offset(leg.joint, 0.08, 0, 0)
      }
      const target = flight?.target
      if (
        currentPhysics?.settled &&
        currentPhysics.grounded &&
        target &&
        Math.abs(currentPhysics.supportHeight - target.y) < 0.16
      ) {
        const hard =
          currentPhysics.hitStrongly && currentPhysics.impactSpeed > 1.2
        captureLanding()
        flight = null
        if (hard) {
          setState('dizzy reaction')
          emotions.triggerDizzy()
        } else {
          softLanding = {
            y: root.position.y,
            joints: rig.joints.map((joint) => joint.quaternion.clone()),
          }
          setState('soft landing')
        }
      } else if (
        currentPhysics?.settled &&
        currentPhysics.grounded &&
        !target
      ) {
        flight = null
        setState('falling')
      }
    } else if (state === 'soft landing') {
      const p = clamp(age / 0.42, 0, 1)
      const bend = Math.sin(Math.PI * p)
      for (const { arm, leg, sign } of sides) {
        rig.offset(leg.upper, -0.08 * bend, 0, 0)
        rig.offset(leg.joint, 0.16 * bend, 0, 0)
        rig.offset(arm.upper, -0.12 * (1 - p), 0, sign * 0.18 * (1 - p))
      }
      bodyOffset(-0.045 * body.scale.x * bend)
      root.position.y = floor
      if (p >= 1) {
        softLanding = null
        landing = null
        setState('idle')
      }
    } else if (
      state === 'falling' ||
      state === 'impact' ||
      state === 'settling'
    ) {
      physicalPose(0.5 + Math.sin(timeSec * 5) * 0.16)
      currentPhysics = physics.advance(dt)
      if (currentPhysics?.impacted && !hit) {
        hit = true
        setState('impact')
      } else if (state === 'impact' && age > 0.18) setState('settling')
      if (currentPhysics?.settled) {
        const strong = currentPhysics.hitStrongly
        captureLanding()
        if (strong) {
          setState('dizzy reaction')
          emotions.triggerDizzy()
        }
        else {
          keepAboveGround(0)
          startRecovery()
        }
      }
    } else if (state === 'recovering') {
      recover()
    } else if (jump) {
      if (emotion === 'neutral') emotions.setEmotion('happy')
      playJump(dt)
    } else if (state === 'dizzy reaction' || emotion === 'dizzy') {
      if (state !== 'dizzy reaction') {
        speed = 0
        walkMix = 0
        root.position.y = floor
        setState('dizzy reaction')
      }
      dizzyPose(timeSec, reduced)
      if (emotion === 'neutral' && age > 0.12) startRecovery()
    } else {
      if (emotion === 'happy' && lastEmotion !== 'happy') startJump()
      if (jump) playJump(dt)
      else {
        gait(dt, timeSec, reduced)
        foldArms(dt)
      }
    }
    if (
      !reduced &&
      ![
        'falling',
        'impact',
        'settling',
        'recovering',
        'powered flight',
        'landing approach',
        'dragging',
      ].includes(state)
    ) {
      for (const { antenna, sign } of sides)
        rig.offset(
          antenna,
          Math.sin(timeSec * 2.9 + sign) * (airborne ? 0.035 : 0.016),
          0,
          Math.cos(timeSec * 2.2) * 0.01,
        )
    }
    if (['falling', 'impact', 'settling'].includes(state)) {
      const k = 1 - Math.exp(-dt * options.transitionSpeed)
      rig.joints.forEach((joint, index) => {
        authored.copy(joint.quaternion)
        joint.quaternion.copy(currentJoints[index]).slerp(authored, k)
      })
    }
    lastEmotion = emotions.getCurrentEmotion()
  }

  function walk(direction) {
    if (isLocked()) return false
    route = Math.sign(direction)
    stopYaw = null
    return true
  }

  function turn(direction) {
    if (isLocked()) return false
    route = 0
    stopYaw = wrap(yaw + (direction * Math.PI) / 4)
    return true
  }

  function configure(next) {
    options = { ...options, ...next }
  }
  function configurePhysics(next) {
    physical = { ...physical, ...next }
    physics.configure(next)
  }
  function reset() {
    physics.clear()
    root.position.set(0, 0, 0)
    root.quaternion.identity()
    rig.rest()
    clearTracking()
    yaw = route = speed = walkMix = floor = fold = 0
    phase = 0.12
    stopYaw = jump = landing = sequence = currentPhysics = null
    airborne = hit = false
    state = 'idle'
    age = 0
    lastEmotion = emotion = 'neutral'
  }
  const { clearTracking } = rig

  return {
    rig,
    update,
    walk,
    turn,
    stop: () => walk(0),
    beginFall,
    beginPoweredFlight,
    setFlightTarget,
    endPoweredFlight,
    startDrag,
    dragTo,
    endDrag,
    startRecovery,
    isLocked,
    configure,
    configurePhysics,
    reset,
    proportionsChanged: () => physics.rebuild(),
    stagePlatform: (height, x = 0) => {
      if (isLocked() || jump) return false
      speed = route = walkMix = 0
      floor = height
      root.position.set(x, height, 0)
      return true
    },
    status: () => ({
      state,
      grounded:
        currentPhysics?.grounded ??
        !airborne && !['powered flight', 'landing approach', 'falling'].includes(state),
      physics: currentPhysics ? 'Dynamic' : 'Animation',
      orientation: landing?.orientation ?? null,
      floor,
      time: age,
      thrust: flight?.landing ? 0.35 : flight ? 1 : 0,
      dragging,
    }),
  }
}
