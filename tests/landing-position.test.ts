import { describe, expect, it } from 'vitest'
import { selectLandingPoint } from '../src/features/hero-robot/landing-position'

describe('direct vertical landing selection', () => {
  it('preserves current X when a safe platform is directly below', () => {
    const point = selectLandingPoint(
      { minX: 0, maxX: 10 },
      { minX: 0, maxX: 10 },
      4.2,
      8,
      2,
    )
    expect(point).toEqual({ x: 4.2, directlyBelow: true, distance: 6 })
  })

  it('chooses vertical alignment over a closer horizontal fallback', () => {
    const directlyBelow = selectLandingPoint(
      { minX: 0, maxX: 10 },
      { minX: 0, maxX: 10 },
      4,
      10,
      2,
    )
    const fallback = selectLandingPoint(
      { minX: 0, maxX: 2 },
      { minX: 0, maxX: 2 },
      4,
      3,
      2,
    )
    expect(directlyBelow?.directlyBelow).toBe(true)
    expect(fallback?.directlyBelow).toBe(false)
    expect(directlyBelow!.x).toBe(4)
  })

  it('uses only the visible safe segment for partial platforms', () => {
    const point = selectLandingPoint(
      { minX: 0, maxX: 10 },
      { minX: 6, maxX: 8 },
      9,
      8,
      2,
    )
    expect(point).toEqual({
      x: 8,
      directlyBelow: false,
      distance: Math.hypot(1, 6),
    })
  })

  it('rejects platforms above the robot or with no safe overlap', () => {
    expect(
      selectLandingPoint({ minX: 0, maxX: 1 }, { minX: 2, maxX: 3 }, 2, 8, 1),
    ).toBeNull()
    expect(
      selectLandingPoint({ minX: 0, maxX: 4 }, { minX: 0, maxX: 4 }, 2, 1, 2),
    ).toBeNull()
  })
})
