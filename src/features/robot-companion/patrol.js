import { Box3, Vector3 } from 'three'
import { clearanceFor, pixelsPerUnit, toWorld } from './surface-registry.js'

const near = (a, b, tolerance = 0.045) => Math.abs(a - b) < tolerance
const stopBuffer = 8
const readyStates = new Set([
  'idle',
  'walking left',
  'walking right',
  'turning',
])

export function visibleOverlap(source, destination) {
  return source
    .flatMap(([a, b]) =>
      destination.map(([left, right]) => [
        Math.max(a, left),
        Math.min(b, right),
      ]),
    )
    .filter(([left, right]) => right - left >= 28)
}

export function dropSlots(lanes, forward = 100, trailing = 14) {
  return lanes
    .flatMap(([a, b]) => [
      { left: a + trailing, right: b - forward, heading: 1 },
      { left: a + forward, right: b - trailing, heading: -1 },
    ])
    .filter((slot) => slot.right - slot.left >= 5)
}

export function choosePatrolDirection(corridor, x, previous = 0) {
  if (!corridor) return 0
  const left = x - corridor[0]
  const right = corridor[1] - x
  if (previous === -1 && left >= stopBuffer + 8) return -1
  if (previous === 1 && right >= stopBuffer + 8) return 1
  if (left < stopBuffer + 8 && right < stopBuffer + 8) return 0
  return right > left ? 1 : -1
}

export function makePatrol({
  robot,
  movement,
  physics,
  frame,
  report,
  clearance = clearanceFor(),
}) {
  const soleParts = robot.hitMeshes.filter(
    (part) => part.name === 'Thin outsole',
  )
  const soleBox = new Box3()
  const forward = new Vector3()
  let live = []
  let registered = []
  let support = null
  let seeded = false
  let dirty = false
  let direction = 0
  let nextPause = 0
  let resumeAt = 0
  let cooldown = 0
  let burst = 0
  let burstStarted = -Infinity
  let burstLatest = -Infinity
  let requestedFallUntil = 0
  let chain = new Set()
  let previousState = 'idle'

  const documentX = () => frame.x + pixelsPerUnit * robot.root.position.x
  const positionZ = () => robot.root.position.z
  const onTrack = () =>
    !movement.isLocked() && readyStates.has(movement.status().state)
  const corridorAt = (line, x) =>
    line?.corridors.find(([left, right]) => x >= left && x <= right)

  function depthFor(line) {
    const yFromSupport = line.y - (support?.y ?? line.y)
    if (line.id === support?.id) return { z: positionZ() - 0.18, width: 1.44 }
    // Each DOM edge is a rail whose depth is perpendicular to the page.
    // Lower rails span the projected landing depth of the rolling body.
    const width = 10 + Math.min(9, Math.max(0, yFromSupport) / 125)
    return { z: positionZ() + width * 0.37, width }
  }

  function publish() {
    const next = live.map((line) => ({
      ...line,
      world: toWorld(line, frame, depthFor(line)),
    }))
    const unchanged =
      next.length === registered.length &&
      next.every((line, index) => {
        const old = registered[index]
        return (
          old.id === line.id &&
          ['x', 'width', 'height', 'z', 'depth'].every((key) =>
            near(old.world[key], line.world[key], 0.024),
          )
        )
      })
    if (!unchanged) physics.updateSurfaces(next.map((line) => line.world))
    registered = next
    dirty = false
  }

  function placeOn(line, x, initial = false) {
    const relativeZ = positionZ()
    if (
      !movement.stagePlatform(
        (frame.y - line.y) / pixelsPerUnit,
        (x - frame.x) / pixelsPerUnit,
      )
    )
      return false
    robot.root.position.z = initial ? 0.18 : relativeZ
    robot.root.updateMatrixWorld(true)
    support = line
    direction = 0
    return true
  }

  function seed(view, now) {
    const eligible = live.filter(
      (line) =>
        line.y >= view.top + 70 &&
        line.y <= view.bottom + 2 &&
        line.corridors.some(([left, right]) => right - left >= 38),
    )
    // Prefer the first viable line in or just below the current reading position.
    const first = eligible[0]
    if (!first) return false
    const receiver = live.find(
      (line) =>
        line.y > first.y + 20 &&
        line.y - first.y < 440 &&
        line.corridors.some(([a, b]) => b - a > 34),
    )
    const shared = receiver
      ? visibleOverlap(first.corridors, receiver.corridors)
      : []
    const choices = shared.length ? shared : first.corridors
    const largest = choices.reduce((best, interval) =>
      interval[1] - interval[0] >= best[1] - best[0] ? interval : best,
    )
    const x = largest[0] + (largest[1] - largest[0]) * 0.54
    frame.x = x
    if (!placeOn(first, x, true)) return false
    seeded = true
    nextPause = now + 8800
    publish()
    return true
  }

  function findLine(floor) {
    const x = documentX()
    const z = positionZ()
    return registered.find(
      (line) =>
        near(line.world.height, floor, 0.085) &&
        x >= line.left - 1 &&
        x <= line.right + 1 &&
        Math.abs(z - line.world.z) <= line.world.depth / 2 + 0.055,
    )
  }

  function hasFooting(line) {
    if (!line) return false
    const world = line.world
    const left = world.x - world.width / 2
    const right = world.x + world.width / 2
    const front = world.z + world.depth / 2
    const back = world.z - world.depth / 2
    let touched = false
    let closestGap = Infinity
    robot.root.updateMatrixWorld(true)
    for (const foot of soleParts) {
      soleBox.setFromObject(foot)
      const close = near(soleBox.min.y, world.height, 0.078)
      closestGap = Math.min(closestGap, Math.abs(soleBox.min.y - world.height))
      if (
        close &&
        (soleBox.min.x < left - 0.035 ||
          soleBox.max.x > right + 0.035 ||
          soleBox.min.z < back - 0.035 ||
          soleBox.max.z > front + 0.035)
      )
        return false
      touched ||= close
    }
    report('soleGap', (closestGap * pixelsPerUnit).toFixed(1))
    return touched
  }

  function lowerSurfaces(line) {
    const x = documentX()
    return registered.filter(
      (candidate) =>
        candidate.y > line.y + 20 &&
        candidate.y - line.y < 850 &&
        candidate.left + 10 < x &&
        candidate.right - 10 > x,
    )
  }

  function fall(now, balance = false) {
    if (!onTrack()) return false
    forward.set(0, 0, 1).applyQuaternion(robot.root.quaternion)
    const target =
      Math.abs(forward.x) < 0.43
        ? forward.z >= 0
          ? 'front'
          : 'back'
        : forward.x > 0
          ? 'left'
          : 'right'
    if (!movement.beginFall(target, { balance })) return false
    chain = new Set()
    report('contacts', '0')
    direction = 0
    cooldown = now + 5100
    burst = 0
    requestedFallUntil = 0
    return true
  }

  function synchronize(now, view) {
    if (!seeded) {
      if (dirty) seed(view, now)
      return
    }
    if (!onTrack()) return
    const floor = movement.status().floor
    const landed = findLine(floor)
    const switched = landed && landed.id !== support?.id
    const x = documentX()
    if (switched) {
      support = landed
      direction = 0
      resumeAt = now + 380
      nextPause = now + 9000
    }
    if (dirty || switched) {
      const updated = live.find((line) => line.id === support?.id)
      if (!updated && support) {
        support = null
        publish()
        fall(now)
        return
      }
      if (updated) {
        const moved = !near((frame.y - updated.y) / pixelsPerUnit, floor)
        const lostWidth = x < updated.left || x > updated.right
        if (landed && (moved || lostWidth)) {
          const originalFraction =
            (x - support.left) / (support.right - support.left)
          const attachX = lostWidth
            ? updated.left +
              (updated.right - updated.left) *
                Math.min(0.89, Math.max(0.11, originalFraction))
            : x
          if (placeOn(updated, attachX)) resumeAt = now + 220
        }
        support = updated
      }
      publish()
    }
  }

  function update(now, view, reduced) {
    synchronize(now, view)
    if (!seeded) return false
    const status = movement.status()
    if (previousState === 'recovering' && status.state === 'idle') {
      resumeAt = now + 1000
      direction = 0
    }
    previousState = status.state
    const line = findLine(status.floor)
    report('state', status.state)
    report('support', line?.label ?? '')
    report('surfaceCount', String(registered.length))
    if (!onTrack()) return true
    if (reduced || !line || !hasFooting(line)) {
      if (direction) movement.stop()
      direction = 0
      if (!line && status.state === 'idle' && status.floor > 0.1) fall(now)
      return true
    }

    const x = documentX()
    const corridor = corridorAt(line, x)
    if (burst >= 86 && now - burstLatest < 370 && now >= cooldown) {
      requestedFallUntil = now + 9200
      burst = 0
    }
    let towardsDrop = 0
    if (
      requestedFallUntil > now &&
      line.y >= view.top - 100 &&
      line.y <= view.bottom + 90
    ) {
      const lower = lowerSurfaces(line)
      const next = lower.find((candidate) => candidate.corridors.length)
      const lanes =
        next && corridor ? visibleOverlap([corridor], next.corridors) : []
      const facing =
        status.state === 'walking left'
          ? -1
          : status.state === 'walking right'
            ? 1
            : 0
      const slots = dropSlots(lanes)
      let best = Infinity
      for (const slot of slots) {
        const inside = x >= slot.left && x <= slot.right
        if (inside && facing === slot.heading) {
          fall(now)
          return true
        }
        const shift = (slot.left + slot.right) / 2 - x
        const cost =
          (inside ? 0 : Math.abs(shift)) + (slot.heading === facing ? 0 : 9)
        if (cost < best) {
          best = cost
          towardsDrop = inside ? slot.heading : Math.sign(shift)
        }
      }
      if (
        towardsDrop &&
        direction !== towardsDrop &&
        movement.walk(towardsDrop)
      ) {
        direction = towardsDrop
        return true
      }
    }
    const remaining = corridor
      ? direction > 0
        ? corridor[1] - x
        : x - corridor[0]
      : 0
    // A clearance boundary beside content is a turnaround, never a ledge.
    if (
      direction &&
      corridor &&
      remaining < stopBuffer &&
      now >= cooldown &&
      status.state.startsWith('walking')
    ) {
      const edge =
        direction > 0
          ? corridor[1] + clearance.radius
          : corridor[0] - clearance.radius
      const physicalEdge = direction > 0 ? line.right : line.left
      const receiving = lowerSurfaces(line).some((candidate) =>
        direction > 0
          ? candidate.right > physicalEdge + 32
          : candidate.left < physicalEdge - 32,
      )
      if (near(edge, physicalEdge, 1.6) && receiving && Math.random() < 0.15) {
        fall(now, true)
        return true
      }
    }
    if (
      direction &&
      (remaining < stopBuffer ||
        now >= nextPause ||
        Math.abs(robot.root.position.x) > 1.86)
    ) {
      movement.stop()
      direction = 0
      resumeAt = now + (now >= nextPause ? 650 + Math.random() * 621 : 200)
      if (now >= nextPause) nextPause = now + 7000 + Math.random() * 8700
    }
    if (status.state !== 'idle' || direction || now < resumeAt || !corridor)
      return true
    // The existing walking controller bounds its local X. Recenter the
    // coordinate frame once stopped, preserving document X, Y, Z and facing.
    if (Math.abs(robot.root.position.x) > 1.62) {
      frame.x = x
      placeOn(line, x)
      publish()
    }
    const next = choosePatrolDirection(corridor, x, towardsDrop)
    if (next && movement.walk(next)) direction = next
    return true
  }

  function recordContact(contact) {
    if (!contact?.grounded) return
    const line = registered.find((candidate) =>
      near(candidate.world.height, contact.supportHeight, 0.06),
    )
    if (line && !chain.has(line.id)) {
      chain.add(line.id)
      report('contacts', String(chain.size))
    }
  }

  return {
    update,
    recordContact,
    setLines(lines) {
      live = lines
      dirty = true
    },
    scroll(distance, now) {
      if (now - burstStarted > 420 || now - burstLatest > 170) {
        burstStarted = now
        burst = 0
      }
      burst += Math.abs(distance)
      burstLatest = now
    },
  }
}
