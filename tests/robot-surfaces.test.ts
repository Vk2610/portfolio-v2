import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectDomSurfaces,
  domToWorldSurface,
  resolveHeroWorldOrigin,
} from '@/features/robot-surfaces/surface-registry'
import { createSurfacePhysicsWorld } from '@/features/robot-surfaces/surface-physics'
import { evaluatePlatformBounds } from '@/features/robot-surfaces/platform-movement'

describe('DOM surface detection and Rapier physics', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('collects visible surfaces, excludes hidden/inert elements, and converts scroll-invariant world coordinates', () => {
    const hero = document.createElement('div')
    hero.setAttribute('data-hero-robot', '')
    hero.setAttribute('aria-hidden', 'true')
    hero.setAttribute('data-robot-surface', 'hero-platform')
    hero.setAttribute('data-robot-surface-edge', 'bottom')

    const divider = document.createElement('hr')
    divider.setAttribute('data-robot-surface', 'section-divider')

    const hiddenTile = document.createElement('button')
    hiddenTile.setAttribute('data-robot-surface', 'tech-tile')
    hiddenTile.style.display = 'none'

    const inertWrapper = document.createElement('div')
    inertWrapper.setAttribute('inert', '')
    const inertCard = document.createElement('article')
    inertCard.setAttribute('data-robot-surface', 'project-card')
    inertWrapper.appendChild(inertCard)

    const excludedTechTile = document.createElement('button')
    excludedTechTile.setAttribute('data-robot-surface', 'tech-tile')
    const excludedProjectRow = document.createElement('button')
    excludedProjectRow.setAttribute('data-robot-surface', 'project-row')
    const excludedContactRow = document.createElement('div')
    excludedContactRow.setAttribute('data-robot-surface', 'contact-row')

    document.body.append(
      hero,
      divider,
      hiddenTile,
      inertWrapper,
      excludedTechTile,
      excludedProjectRow,
      excludedContactRow,
    )

    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 40,
      right: 400,
      bottom: 140,
      width: 300,
      height: 100,
      x: 100,
      y: 40,
      toJSON: () => ({}),
    })

    vi.spyOn(divider, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 340,
      right: 900,
      bottom: 341,
      width: 800,
      height: 1,
      x: 100,
      y: 340,
      toJSON: () => ({}),
    })

    vi.spyOn(hiddenTile, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    const origin = resolveHeroWorldOrigin(hero, 5)
    expect(origin).not.toBeNull()
    expect(origin?.pxPerWorldUnit).toBe(20)

    const domSurfaces = collectDomSurfaces(document)
    expect(domSurfaces.map((s) => s.id)).toEqual([
      'hero-platform-1',
      'section-divider-1',
    ])

    const worldSurfaces = domSurfaces.map((s) => domToWorldSurface(s, origin!))
    expect(worldSurfaces[0]).toMatchObject({ x: 0, y: 0, width: 15 })
    expect(worldSurfaces[1]).toMatchObject({ x: 12.5, y: -10, width: 40 })
  })

  it('builds Rapier colliders preserving genuine gaps and skips unchanged syncs', async () => {
    const physics = await createSurfacePhysicsWorld([
      {
        id: 'tile-1',
        kind: 'tech-tile',
        x: -2,
        y: -3,
        z: 0,
        width: 1.5,
        depth: 1.6,
        docLeft: 0,
        docTop: 0,
        pxWidth: 100,
      },
      {
        id: 'tile-2',
        kind: 'tech-tile',
        x: 2,
        y: -3,
        z: 0,
        width: 1.5,
        depth: 1.6,
        docLeft: 200,
        docTop: 0,
        pxWidth: 100,
      },
    ])

    try {
      expect(physics.getColliders()).toHaveLength(2)
      expect(physics.floorAt(-2, 0)).toBe(-3)
      expect(physics.floorAt(2, 0)).toBe(-3)
      expect(physics.floorAt(0, 0)).toBe(-Infinity)
      expect(physics.isUpwardSupport(1)).toBe(true)
      expect(physics.isUpwardSupport(0.2)).toBe(false)

      const rebuiltSame = physics.sync(
        physics.getColliders().map((entry) => entry.surface),
      )
      expect(rebuiltSame).toBe(false)
    } finally {
      physics.dispose()
    }
  })

  it('evaluates wide, narrow, and insufficient platform widths', () => {
    const base = {
      id: 'p1',
      kind: 'section-divider',
      x: 1,
      y: -5,
      z: 0,
      depth: 1.6,
      docLeft: 0,
      docTop: 0,
      pxWidth: 100,
    }
    const wide = evaluatePlatformBounds({ ...base, width: 6 }, 0.55)
    expect(wide.canStand).toBe(true)
    expect(wide.canWalk).toBe(true)
    expect(wide.minX).toBeLessThan(wide.maxX)

    const narrow = evaluatePlatformBounds({ ...base, width: 1.3 }, 0.55)
    expect(narrow.canStand).toBe(true)
    expect(narrow.canWalk).toBe(false)

    const tiny = evaluatePlatformBounds({ ...base, width: 0.8 }, 0.55)
    expect(tiny.canStand).toBe(false)
    expect(tiny.canWalk).toBe(false)
  })
})
