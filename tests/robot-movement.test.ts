// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { OrthographicCamera, Quaternion, Vector3 } from 'three'
import { createRobot } from '../src/features/robot-preview/robot.js'
import { createEmotionController } from '../src/features/robot-preview/emotions.js'
import {
  createFallPhysics,
  physicsDefaults,
  preparePhysics,
} from '../src/features/robot-preview/fall-physics.js'
import {
  createMovement,
  landingOrientation,
} from '../src/features/robot-preview/movement.js'
import {
  createHeadTracking,
  trackingAllowance,
} from '../src/features/robot-preview/head-tracking.js'

beforeAll(preparePhysics)

function setup(scales?: { head: number; body: number; overall: number }) {
  const robot = createRobot()
  if (scales) robot.setScales(scales)
  let now = 0
  const emotions = createEmotionController({ now: () => now, random: () => 0 })
  const physics = createFallPhysics(robot)
  const movement = createMovement(robot, physics, emotions, physicsDefaults)
  function tick() {
    now += 1000 / 60
    movement.update(now, 1 / 60)
    return movement.status()
  }
  return { robot, feelings: emotions, physics, movement, tick }
}

describe('H1 movement', () => {
  it('turns and travels in both directions while a stance ankle holds its ground position', () => {
    const { robot, movement, tick, physics } = setup()
    try {
      movement.walk(1)
      const states = new Set()
      let longestPlant = 0
      let plant = 0
      const prior = new Vector3()
      const current = new Vector3()
      for (let i = 0; i < 200; i++) {
        states.add(tick().state)
        movement.rig.sides[0].leg.tip.getWorldPosition(current)
        plant = i > 105 && current.distanceTo(prior) < 0.0012 ? plant + 1 : 0
        longestPlant = Math.max(plant, longestPlant)
        prior.copy(current)
      }
      const right = robot.root.position.x
      expect(right).toBeGreaterThan(0.9)
      expect(states).toEqual(new Set(['turning', 'walking right']))
      expect(longestPlant).toBeGreaterThan(7)
      movement.walk(-1)
      for (let i = 0; i < 240; i++) tick()
      expect(movement.status().state).toBe('walking left')
      expect(robot.root.position.x).toBeLessThan(right - 0.6)
      expect(
        new Vector3(0, 0, 1).applyQuaternion(robot.root.quaternion).x,
      ).toBeLessThan(-0.99)
    } finally {
      physics.dispose()
    }
  })

  it('performs one ballistic jump and returns to idle without dizziness', () => {
    const { robot, movement, feelings, tick, physics } = setup()
    try {
      const poses = new Set()
      feelings.registerInteraction()
      let peak = 0
      let wasAirborne = false
      let launches = 0
      for (let i = 0; i < 180; i++) {
        const status = tick()
        poses.add(status.state)
        if (!status.grounded && !wasAirborne) {
          launches++
          feelings.registerInteraction()
        }
        wasAirborne = !status.grounded
        peak = Math.max(peak, robot.root.position.y)
      }
      expect(poses).toEqual(
        new Set(['jump anticipation', 'jumping', 'jump landing', 'idle']),
      )
      expect(launches).toBe(1)
      expect(peak).toBeGreaterThan(0.57)
      expect(peak).toBeLessThan(0.95)
      expect(feelings.getCurrentEmotion()).toBe('neutral')
      expect(movement.status().grounded).toBe(true)
    } finally {
      physics.dispose()
    }
  })

  it.each(['front', 'back', 'left', 'right'])(
    'runs a %s physics fall through contact and recovery',
    (direction) => {
      const { robot, movement, tick, physics } = setup()
      try {
        if (direction === 'left')
          robot.setScales({ head: 1.18, body: 0.5, overall: 0.82 })
        const seen = new Set()
        let lowest = Infinity
        let initialRest: Vector3 | undefined
        expect(movement.beginFall(direction, { balance: true })).toBe(true)
        expect(movement.walk(1)).toBe(false)
        for (let i = 0; i < 840; i++) {
          const state = tick().state
          seen.add(state)
          if (state === 'dizzy reaction')
            initialRest ??= robot.root.position.clone()
          if (direction === 'front' && state !== 'idle' && i % 8 === 0) {
            robot.root.updateMatrixWorld(true)
            for (const mesh of robot.hitMeshes.filter(
              (part: { name: string }) =>
                [
                  'Wraparound smoked visor',
                  'Pearlescent helmet',
                  'Thin outsole',
                ].includes(part.name),
            )) {
              const positions = mesh.geometry.attributes.position
              const point = new Vector3()
              for (let j = 0; j < positions.count; j += 137) {
                point
                  .fromBufferAttribute(positions, j)
                  .applyMatrix4(mesh.matrixWorld)
                lowest = Math.min(lowest, point.y)
              }
            }
          }
        }
        for (const phase of [
          'falling',
          'impact',
          'settling',
          'dizzy reaction',
          'recovering',
          'idle',
        ]) {
          expect(seen.has(phase)).toBe(true)
        }
        expect(initialRest).toBeDefined()
        if (direction === 'front') expect(lowest).toBeGreaterThan(-0.028)
        expect(movement.status().state).toBe('idle')
        expect(Math.abs(robot.root.position.x - initialRest!.x)).toBeLessThan(
          0.01,
        )
        expect(Math.abs(robot.root.position.z - initialRest!.z)).toBeLessThan(
          0.01,
        )
        expect(robot.root.position.length()).toBeGreaterThan(0.15)
      } finally {
        physics.dispose()
      }
    },
  )

  it('classifies prone, supine, side and seated resting transforms', () => {
    const x = new Vector3(1, 0, 0)
    const z = new Vector3(0, 0, 1)
    expect(
      landingOrientation(new Quaternion().setFromAxisAngle(x, Math.PI / 2)),
    ).toBe('front')
    expect(
      landingOrientation(new Quaternion().setFromAxisAngle(x, -Math.PI / 2)),
    ).toBe('back')
    expect(
      landingOrientation(new Quaternion().setFromAxisAngle(z, Math.PI / 2)),
    ).toBe('left')
    expect(
      landingOrientation(new Quaternion().setFromAxisAngle(z, -Math.PI / 2)),
    ).toBe('right')
    expect(
      landingOrientation(new Quaternion().setFromAxisAngle(x, -0.49)),
    ).toBe('seated')
  })

  it.each(['left', 'seated'])(
    'recovers from an actual %s Rapier rest',
    (orientation) => {
      const { movement, tick, physics } = setup(
        orientation === 'seated'
          ? { head: 1.35, body: 0.4, overall: 1.25 }
          : undefined,
      )
      try {
        if (orientation === 'left') {
          movement.configurePhysics({
            gravity: 6,
            friction: 0.3,
            dropHeight: 0.55,
            restitution: 0.1,
            damping: 1,
          })
        }
        movement.beginFall(orientation === 'left' ? 'left' : 'right', {
          drop: true,
        })
        const found = new Set()
        let recoverySeen = false
        for (let i = 0; i < 850; i++) {
          const state = tick()
          found.add(state.orientation)
          recoverySeen ||= state.state === 'recovering'
        }
        expect(found.has(orientation)).toBe(true)
        expect(recoverySeen).toBe(true)
        expect(movement.status().state).toBe('idle')
      } finally {
        physics.dispose()
      }
    },
  )
})

describe('H1 additive head tracking', () => {
  it('tracks left/right and up/down and leaves all other rig transforms alone', () => {
    const { robot, movement, physics } = setup()
    try {
      robot.setScales({ head: 1.18, body: 0.52, overall: 0.94 })
      robot.root.position.set(0.6, 0, 0)
      const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 40)
      camera.position.set(0.6, 2.2, 8)
      camera.lookAt(0.6, 2.2, 0)
      const tracking = createHeadTracking(movement.rig, camera, () => ({
        left: 0,
        top: 0,
        width: 600,
        height: 600,
      }))
      const parts = [robot.root, robot.body, robot.head, ...movement.rig.joints]
      const before = parts.map((part) => part.quaternion.clone())
      let time = 0
      function run(n: number, state = 'idle') {
        let angles = { yaw: 0, pitch: 0 }
        for (let i = 0; i < n; i++) {
          time += 1000 / 60
          angles = tracking.step(time, 1 / 60, state, 'neutral', false)
        }
        return angles
      }
      tracking.point(460, 180, time)
      expect(run(3)).toEqual({ yaw: 0, pitch: 0 })
      const right = run(45)
      expect(right.yaw).toBeGreaterThan(12)
      expect(right.yaw).toBeLessThanOrEqual(45)
      expect(right.pitch).toBeLessThan(-8)
      expect(right.pitch).toBeGreaterThanOrEqual(-25)
      tracking.point(115, 455, time)
      const left = run(45)
      expect(left.yaw).toBeLessThan(-15)
      expect(left.pitch).toBeGreaterThan(10)
      parts.forEach((part, index) =>
        expect(part.quaternion.toArray()).toEqual(before[index].toArray()),
      )
      expect(run(1, 'falling')).toEqual({ yaw: 0, pitch: 0 })
      tracking.point(495, 130, time)
      run(40)
      expect(Math.abs(run(240).yaw)).toBeLessThan(0.1)
      tracking.point(150, 410, time, true)
      expect(run(24).yaw).toBeLessThan(-5)
      expect(Math.abs(run(160).yaw)).toBeLessThan(0.1)
    } finally {
      physics.dispose()
    }
  })

  it('limits walking and reactions and disables tracking for all physical states', () => {
    expect(trackingAllowance('walking right', 'neutral')).toBeLessThan(1)
    expect(trackingAllowance('jumping', 'happy')).toBeLessThan(0.5)
    expect(trackingAllowance('arms folded', 'angry')).toBeLessThan(0.5)
    for (const state of [
      'falling',
      'impact',
      'settling',
      'dizzy reaction',
      'recovering',
    ]) {
      expect(trackingAllowance(state, 'neutral')).toBe(0)
    }
  })
})
