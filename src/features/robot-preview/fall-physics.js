import RAPIER from '@dimforge/rapier3d-compat'
import { Matrix4, Quaternion, Vector3 } from 'three'

const fixedStep = 1 / 120
export const physicsDefaults = {
  gravity: 9.81,
  friction: 0.75,
  restitution: 0.2,
  mass: 6,
  damping: 0.68,
  dropHeight: 1.25,
}

let ready
export const preparePhysics = () => (ready ??= RAPIER.init({}))

const weights = {
  'Pearlescent helmet': 5.1,
  'Wraparound smoked visor': 0.16,
  'Rounded chest shell': 2.4,
  'Upper joint': 0.23,
  'Pearlescent arm guard': 0.32,
  'Mitten hand': 0.16,
  'Hip joint': 0.35,
  'Boot shell': 0.43,
  'Thin outsole': 0.045,
  'Ear shell': 0.11,
  'Antenna light': 0.015,
  'Antenna stem': 0.018,
}
const fitted = new Set([
  'Pearlescent helmet',
  'Wraparound smoked visor',
  'Boot shell',
  'Thin outsole',
])

export function createFallPhysics(rig, initial = physicsDefaults) {
  let options = { ...initial }
  const world = new RAPIER.World({ x: 0, y: -options.gravity, z: 0 })
  world.timestep = fixedStep
  world.numSolverIterations = 8
  world.integrationParameters.maxCcdSubsteps = 4
  const ground = { x: 0, z: 0, width: 60, depth: 60, height: 0 }
  let surfaces = []
  let platforms = []
  let dynamic = null
  let colliders = []
  let elapsed = 0
  let accumulator = 0
  let stableFor = 0
  let impacted = false
  let hitStrongly = false
  let grounded = false
  let supportHeight = 0
  let impactSpeed = 0

  const parts = rig.hitMeshes
    .filter((part) => weights[part.name])
    .map((part) => {
      part.geometry.computeBoundingBox()
      const box = part.geometry.boundingBox
      const center = box.getCenter(new Vector3())
      const samples = []
      if (fitted.has(part.name)) {
        const vertices = part.geometry.getAttribute('position')
        const stride = Math.max(1, Math.floor(vertices.count / 245))
        for (let i = 0; i < vertices.count; i += stride) {
          samples.push(
            vertices.getX(i) - center.x,
            vertices.getY(i) - center.y,
            vertices.getZ(i) - center.z,
          )
        }
      }
      return {
        part,
        center,
        half: box.getSize(new Vector3()).multiplyScalar(0.5),
        mass: weights[part.name],
        samples,
      }
    })
  const total = parts.reduce((sum, part) => sum + part.mass, 0)
  const priorPosition = new Vector3()
  const priorRotation = new Quaternion()
  const currentPosition = new Vector3()
  const currentRotation = new Quaternion()
  const inverse = new Matrix4()
  const localMatrix = new Matrix4()
  const localPos = new Vector3()
  const localRotation = new Quaternion()
  const localScale = new Vector3()
  const offset = new Vector3()
  const direction = new Vector3()

  function updateSurfaces(next) {
    for (const { collider } of surfaces) world.removeCollider(collider, false)
    platforms = next.map((surface) => ({ ...surface }))
    surfaces = [ground, ...platforms].map((surface) => ({
      ...surface,
      collider: world.createCollider(
        RAPIER.ColliderDesc.cuboid(surface.width / 2, 0.12, surface.depth / 2)
          .setTranslation(surface.x, surface.height - 0.12, surface.z)
          .setFriction(options.friction)
          .setRestitution(options.restitution),
      ),
    }))
  }

  updateSurfaces([])

  function floorAt(x, z, below = Infinity) {
    let height = 0
    for (const surface of platforms) {
      if (
        surface.height <= below &&
        Math.abs(x - surface.x) <= surface.width / 2 &&
        Math.abs(z - surface.z) <= surface.depth / 2
      )
        height = Math.max(height, surface.height)
    }
    return height
  }

  function clear() {
    if (dynamic) world.removeRigidBody(dynamic)
    dynamic = null
    colliders = []
    elapsed = 0
    accumulator = 0
    stableFor = 0
    impacted = false
    hitStrongly = false
    impactSpeed = 0
    grounded = false
  }

  function updateParts(rebuild = false) {
    if (!dynamic) return
    rig.root.updateMatrixWorld(true)
    inverse.copy(rig.root.matrixWorld).invert()
    const overall = rig.root.scale.x
    if (rebuild) {
      for (const old of colliders) world.removeCollider(old, false)
      colliders = []
    }
    for (const [
      index,
      { part, center, half, mass, samples },
    ] of parts.entries()) {
      localMatrix
        .multiplyMatrices(inverse, part.matrixWorld)
        .decompose(localPos, localRotation, localScale)
      localPos
        .add(
          offset
            .copy(center)
            .multiply(localScale)
            .applyQuaternion(localRotation),
        )
        .multiplyScalar(overall)
      if (rebuild) {
        offset.copy(half).multiply(localScale).multiplyScalar(overall)
        const radius = 0.7 * Math.min(offset.x, offset.y, offset.z)
        // Round the simplified shells so contacts can roll across the head and limbs.
        const hull = samples.length
          ? RAPIER.ColliderDesc.roundConvexHull(
              Float32Array.from(
                samples,
                (value, i) =>
                  value *
                  (i % 3 === 0
                    ? localScale.x
                    : i % 3 === 1
                      ? localScale.y
                      : localScale.z) *
                  overall,
              ),
              0.016 * overall,
            )
          : null
        const proxy =
          hull ??
          RAPIER.ColliderDesc.roundCuboid(
            Math.max(0.001, offset.x * 0.95 - radius),
            Math.max(0.001, offset.y * 0.95 - radius),
            Math.max(0.001, offset.z * 0.95 - radius),
            radius,
          )
        const collider = world.createCollider(
          proxy
            .setTranslation(localPos.x, localPos.y, localPos.z)
            .setRotation(localRotation)
            .setMass((options.mass * mass) / total)
            .setFriction(options.friction)
            .setRestitution(options.restitution),
          dynamic,
        )
        colliders.push(collider)
      } else {
        colliders[index].setTranslationWrtParent(localPos)
        colliders[index].setRotationWrtParent(localRotation)
      }
    }
  }

  function start({ velocity, roll }) {
    clear()
    const { position, quaternion } = rig.root
    dynamic = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(quaternion)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setAngvel(roll)
        .setLinearDamping(options.damping * 0.45)
        .setAngularDamping(options.damping)
        .setCcdEnabled(true),
    )
    priorPosition.copy(position)
    priorRotation.copy(quaternion)
    currentPosition.copy(position)
    currentRotation.copy(quaternion)
    supportHeight = floorAt(position.x, position.z, position.y + 0.08)
    impactSpeed = 0
    updateParts(true)
  }

  function prepareFlight() {
    if (!dynamic) {
      start({ velocity: { x: 0, y: 0.55, z: 0 }, roll: { x: 0, y: 0, z: 0 } })
      return
    }
    impacted = false
    hitStrongly = false
    stableFor = 0
    grounded = false
    impactSpeed = 0
    dynamic.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  function controlFlight(target, dt, landing = false) {
    if (!dynamic || !target) return
    const position = dynamic.translation()
    const velocity = dynamic.linvel()
    const desired = {
      x: Math.max(-1.25, Math.min(1.25, (target.x - position.x) * 1.8)),
      y: Math.max(
        landing ? -0.9 : -0.35,
        Math.min(landing ? 0.9 : 2.15, (target.y - position.y) * 1.7),
      ),
      z: Math.max(-0.8, Math.min(0.8, (target.z - position.z) * 1.8)),
    }
    const gain = landing ? 3.8 : 4.5
    const force = {
      x: (desired.x - velocity.x) * gain * options.mass,
      y: ((desired.y - velocity.y) * gain + options.gravity) * options.mass,
      z: (desired.z - velocity.z) * gain * options.mass,
    }
    dynamic.addForce(force, true)
    const angularVelocity = dynamic.angvel()
    const damping = Math.exp(-Math.min(dt, 0.05) * 4)
    dynamic.setAngvel({
      x: angularVelocity.x * damping,
      y: angularVelocity.y * damping,
      z: angularVelocity.z * damping,
    }, true)
  }

  function dragTo(position) {
    if (!dynamic) prepareFlight()
    dynamic.setTranslation(position, true)
    dynamic.setLinvel({ x: 0, y: 0, z: 0 }, true)
    dynamic.setAngvel({ x: 0, y: 0, z: 0 }, true)
    priorPosition.set(position.x, position.y, position.z)
    currentPosition.copy(priorPosition)
    priorRotation.copy(rig.root.quaternion)
    currentRotation.copy(prigRotation())
    accumulator = 0
    grounded = false
    stableFor = 0
    updateParts()
  }

  function prigRotation() {
    return rig.root.quaternion
  }

  function releaseDrag(velocity) {
    if (!dynamic) return
    dynamic.setLinvel(velocity, true)
    dynamic.setAngvel({ x: 0, y: 0, z: 0 }, true)
    impacted = false
    hitStrongly = false
    impactSpeed = 0
    stableFor = 0
    grounded = false
  }

  function advance(dt) {
    if (!dynamic) return null
    accumulator = Math.min(accumulator + dt, fixedStep * 9)
    updateParts()
    while (accumulator >= fixedStep) {
      accumulator -= fixedStep
      elapsed += fixedStep
      priorPosition.copy(currentPosition)
      priorRotation.copy(currentRotation)
      const speedBefore = direction.copy(dynamic.linvel()).length()
      const rotationBefore = direction.copy(dynamic.angvel()).length()
      world.step()
      currentPosition.copy(dynamic.translation())
      currentRotation.copy(dynamic.rotation())
      grounded = false
      const upY = direction.set(0, 1, 0).applyQuaternion(currentRotation).y
      for (const part of colliders) {
        for (const surface of surfaces) {
          world.contactPair(part, surface.collider, (contact) => {
            if (!contact.numSolverContacts()) return
            grounded = true
            supportHeight = surface.height
            if (
              !impacted &&
              elapsed > 0.1 &&
              (speedBefore > 1.0 ||
                Math.abs(upY) < 0.76 ||
                rotationBefore > 2.2)
            ) {
              impacted = true
              impactSpeed = speedBefore
              hitStrongly =
                speedBefore > 0.95 || rotationBefore > 1.25 || upY < 0.62
            }
          })
        }
      }
      const slow =
        direction.copy(dynamic.linvel()).length() < 0.27 &&
        direction.copy(dynamic.angvel()).length() < 0.43
      stableFor = grounded && slow ? stableFor + fixedStep : 0
    }
    const alpha = accumulator / fixedStep
    const settled =
      (elapsed > 0.35 && stableFor >= 0.32) ||
      (grounded && dynamic.isSleeping())
    rig.root.position
      .copy(settled ? currentPosition : priorPosition)
      .lerp(currentPosition, settled ? 1 : alpha)
    rig.root.quaternion
      .copy(settled ? currentRotation : priorRotation)
      .slerp(currentRotation, settled ? 1 : alpha)
    return {
      grounded,
      impacted,
      hitStrongly,
      settled,
      supportHeight,
      impactSpeed,
      elapsed,
    }
  }

  function configure(next) {
    options = { ...options, ...next }
    world.gravity = { x: 0, y: -options.gravity, z: 0 }
    if (dynamic) {
      dynamic.setLinearDamping(options.damping * 0.45)
      dynamic.setAngularDamping(options.damping)
      updateParts(true)
    }
    for (const { collider } of surfaces) {
      collider.setFriction(options.friction)
      collider.setRestitution(options.restitution)
    }
  }

  return {
    start,
    prepareFlight,
    controlFlight,
    dragTo,
    releaseDrag,
    clear,
    advance,
    configure,
    updateSurfaces,
    floorAt,
    rebuild: () => updateParts(true),
    debug: () => world.debugRender(),
    dispose: () => world.free(),
  }
}
