import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

const down = new Vector3(0, -1, 0)
const identity = new Quaternion()
const euler = new Euler(0, 0, 0, 'YXZ')
const q = new Quaternion()
const parentQ = new Quaternion()
const v = new Vector3()
const anchor = new Vector3()
const axis = new Vector3()
const bend = new Vector3()
const middle = new Vector3()
const end = new Vector3()
const scale = new Vector3()

function aim(bone, from, to) {
  bone.parent.getWorldQuaternion(parentQ).invert()
  v.copy(to).sub(from).applyQuaternion(parentQ).normalize()
  bone.quaternion.setFromUnitVectors(down, v)
}

// Two-segment IK. The pole chooses where the elbow or knee bends.
export function solveLimb(chain, target, pole, amount = 1) {
  const { upper, joint, tip, first, second, rest } = chain
  upper.getWorldScale(scale)
  const a = first * scale.x
  const b = second * scale.x
  upper.getWorldPosition(anchor)
  axis.copy(target).sub(anchor)
  const d = MathUtils.clamp(axis.length(), Math.abs(a - b) + 0.001, a + b - 0.0001)
  if (!axis.lengthSq()) axis.copy(down)
  axis.normalize()
  bend.copy(pole).sub(anchor)
  bend.addScaledVector(axis, -bend.dot(axis))
  if (bend.lengthSq() < 0.0000001) bend.set(0, 0, 1).addScaledVector(axis, -axis.z)
  bend.normalize()
  const along = (a * a - b * b + d * d) / (2 * d)
  middle.copy(anchor).addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)))
  end.copy(anchor).addScaledVector(axis, d)
  aim(upper, anchor, middle)
  q.copy(upper.quaternion)
  aim(joint, middle, end)
  joint.quaternion.slerp(rest[1], 1 - amount)
  upper.quaternion.copy(rest[0]).slerp(q, amount)
  return tip
}

export function getRig(robot) {
  const { root, body, neck, head, look } = robot
  const get = (name) => root.getObjectByName(name)
  const torso = get('Torso')
  const makeChain = (name, upperName, jointName, tipName) => {
    const upper = get(name + ' ' + upperName)
    const joint = get(name + ' ' + jointName)
    const tip = get(name + ' ' + tipName)
    return {
      upper, joint, tip,
      first: joint.position.length(),
      second: joint.worldToLocal(tip.getWorldPosition(new Vector3())).length(),
      rest: [upper.quaternion.clone(), joint.quaternion.clone(), tip.quaternion.clone()],
      neutral: body.worldToLocal(tip.getWorldPosition(new Vector3())),
    }
  }
  const sides = ['Left', 'Right'].map((name, index) => ({
    sign: index ? 1 : -1,
    arm: makeChain(name, 'shoulder', 'elbow', 'wrist'),
    leg: makeChain(name, 'hip', 'knee', 'ankle'),
    antenna: get(name + ' antenna'),
  }))
  const joints = [torso, head, ...sides.flatMap(({ arm, leg, antenna }) =>
    [arm.upper, arm.joint, arm.tip, leg.upper, leg.joint, leg.tip, antenna],
  )]
  const originals = joints.map((part) => part.quaternion.clone())
  const baseHeight = neck.position.y
  const helmet = get('Pearlescent helmet')
  const headSamples = []
  const positions = helmet.geometry.getAttribute('position')
  const candidate = new Vector3()
  for (let i = 0; i < positions.count; i += 7) {
    candidate.fromBufferAttribute(positions, i)
    if (candidate.y < -0.48 && candidate.z < 0.61 && Math.abs(candidate.x) > 0.20) {
      headSamples.push(candidate.clone())
    }
  }

  function rest() {
    joints.forEach((part, i) => part.quaternion.copy(originals[i]))
    body.position.y = 0
    neck.position.y = baseHeightForScale()
  }

  function baseHeightForScale() {
    return baseHeight + (body.scale.x - 0.6) * 2.63 - (neck.scale.x - 1) * 0.018
  }

  const point = new Vector3()
  const shoulder = new Vector3()
  function helmetContact(side, arm, target) {
    arm.upper.getWorldPosition(shoulder)
    helmet.updateWorldMatrix(true, false)
    let closest = Infinity
    for (const sample of headSamples) {
      if (sample.x * side < 0.2) continue
      point.copy(sample).applyMatrix4(helmet.matrixWorld)
      const distance = point.distanceTo(shoulder) + Math.abs(sample.x - side * 0.68) * 0.15
      if (distance < closest) {
        target.copy(point)
        closest = distance
      }
    }
    return target
  }

  function offset(part, x, y, z) {
    part.quaternion.multiply(q.setFromEuler(euler.set(x, y, z)))
  }

  function levelFoot(leg, amount) {
    leg.tip.parent.getWorldQuaternion(parentQ).invert()
    root.getWorldQuaternion(q).premultiply(parentQ)
    leg.tip.quaternion.copy(leg.rest[2]).slerp(q, amount)
  }

  return { ...robot, torso, sides, joints, rest, baseHeightForScale, helmetContact, levelFoot, offset,
    clearTracking: () => look.quaternion.copy(identity),
  }
}
