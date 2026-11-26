// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Group, Scene } from 'three'
import { createNitroBoosters } from '../src/features/hero-robot/nitro-boosters.js'

describe('nitro booster lifecycle', () => {
  it('stays hidden while grounded, ignites on flight and fades completely at landing', () => {
    const scene = new Scene()
    const sides = [-1, 1].map(() => {
      const tip = new Group()
      scene.add(tip)
      return { leg: { tip } }
    })
    const boosters = createNitroBoosters(scene, sides)
    try {
      boosters.update(1 / 60, 0, 0, false)
      expect(boosters.diagnostics().visible).toBe(false)
      boosters.update(0.2, 1, 0.2, false)
      expect(boosters.diagnostics().visible).toBe(true)
      expect(boosters.diagnostics().worldPositions).toHaveLength(2)
      for (let i = 0; i < 45; i++) boosters.update(1 / 60, 0, 1 + i / 60, false)
      expect(boosters.diagnostics().visible).toBe(false)
      expect(boosters.diagnostics().intensity).toBeLessThan(0.01)
      boosters.setForced(true)
      boosters.update(1 / 60, 0, 2, false)
      expect(boosters.diagnostics().visible).toBe(true)
      boosters.setForced(false)
      boosters.update(0.5, 0, 2.5, false)
      expect(boosters.diagnostics().visible).toBe(false)
    } finally {
      boosters.dispose()
    }
  })
})
