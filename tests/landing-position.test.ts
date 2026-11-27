import { describe, expect, it } from 'vitest'
import { selectLandingPoint } from '../src/features/hero-robot/landing-position'

describe('direction-aware landing selection', () => {
  const platform = { minX: 0, maxX: 10 }

  it('selects directly below without horizontal movement', () => {
    const result = selectLandingPoint(platform, platform, 4, 8, 2, 'down')
    expect(result?.x).toBe(4)
    expect(result?.directlyBelow).toBe(true)
    expect(result?.inTravelDirection).toBe(true)
  })

  it('accepts eligible platforms above both the robot head and feet', () => {
    expect(
      selectLandingPoint(platform, platform, 4, 8, 9, 'up')?.inTravelDirection,
    ).toBe(true)
    expect(
      selectLandingPoint(platform, platform, 4, 7, 8, 'up')?.directlyBelow,
    ).toBe(true)
  })

  it('prioritizes upper candidates while traveling up and lower candidates while traveling down', () => {
    const upper = selectLandingPoint(platform, platform, 5, 8, 12, 'up')!
    const lower = selectLandingPoint(platform, platform, 5, 8, 3, 'up')!
    expect(upper.inTravelDirection).toBe(true)
    expect(lower.inTravelDirection).toBe(false)
    expect(
      selectLandingPoint(platform, platform, 5, 8, 3, 'down')
        ?.inTravelDirection,
    ).toBe(true)
  })

  it('uses the visible safe segment and minimum horizontal adjustment', () => {
    const result = selectLandingPoint(
      platform,
      { minX: 6, maxX: 8 },
      9,
      10,
      2,
      'down',
    )
    expect(result?.x).toBe(8)
    expect(result?.directlyBelow).toBe(false)
  })
})
