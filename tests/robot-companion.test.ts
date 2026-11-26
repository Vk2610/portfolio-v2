// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  choosePatrolDirection,
  dropSlots,
  visibleOverlap,
} from '../src/features/robot-companion/patrol.js'
import {
  pixelsPerUnit,
  toWorld,
  walkingCorridors,
} from '../src/features/robot-companion/surface-registry.js'

describe('portfolio robot surface mapping', () => {
  it('maps the actual endpoints and document height of a visible line', () => {
    const line = { left: 30, right: 450, y: 810 }
    const frame = { x: 270, y: 12_000 }
    const world = toWorld(line, frame, { z: 1, width: 2 })
    expect(frame.x + (world.x - world.width / 2) * pixelsPerUnit).toBeCloseTo(
      line.left,
    )
    expect(frame.x + (world.x + world.width / 2) * pixelsPerUnit).toBeCloseTo(
      line.right,
    )
    expect(frame.y - world.height * pixelsPerUnit).toBeCloseTo(line.y)
  })

  it('does not bridge two visible lines or walk through nearby content', () => {
    const first = { left: 16, right: 320, y: 700 }
    const obstacles = [
      { left: 86, right: 163, top: 644, bottom: 680 },
      { left: 236, right: 319, top: 420, bottom: 580 },
    ]
    const segments = walkingCorridors(first, obstacles, 21, 71)
    expect(segments).toEqual([
      [37, 62],
      [187, 299],
    ])
    const second = walkingCorridors(
      { left: 365, right: 600, y: 700 },
      obstacles,
      21,
      71,
    )
    expect(second).toEqual([[386, 579]])
    expect(
      walkingCorridors({ left: 150, right: 188, y: 700 }, [], 21, 71),
    ).toEqual([])
  })

  it('requires stopping room before walking and turns toward available clearance', () => {
    expect(choosePatrolDirection([29, 95], 94)).toBe(-1)
    expect(choosePatrolDirection([29, 95], 29)).toBe(1)
    expect(choosePatrolDirection([29, 55], 42)).toBe(0)
    expect(choosePatrolDirection(undefined, 42)).toBe(0)
  })

  it('queues falls only where two real corridors have shared landing room', () => {
    expect(
      visibleOverlap(
        [
          [0, 70],
          [140, 200],
        ],
        [
          [55, 110],
          [146, 187],
        ],
      ),
    ).toEqual([[146, 187]])
    expect(visibleOverlap([[0, 70]], [[73, 200]])).toEqual([])
    expect(dropSlots([[100, 260]])).toEqual([
      { left: 114, right: 160, heading: 1 },
      { left: 200, right: 246, heading: -1 },
    ])
    expect(dropSlots([[100, 200]])).toEqual([])
  })
})
