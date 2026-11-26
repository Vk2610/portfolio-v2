import RAPIER from '@dimforge/rapier3d-compat'
import { preparePhysics } from '@/features/robot-preview/fall-physics.js'
import { computeSurfaceSignature, type WorldSurface } from './surface-registry'

const COLLIDER_HALF_HEIGHT = 0.04

export interface SurfacePhysicsWorld {
  sync: (surfaces: WorldSurface[]) => boolean
  floorAt: (x: number, z: number, below?: number) => number
  isUpwardSupport: (normalY: number) => boolean
  getColliders: () => ReadonlyArray<{
    surface: WorldSurface
    collider: RAPIER.Collider
  }>
  dispose: () => void
}

export async function createSurfacePhysicsWorld(
  initialSurfaces: WorldSurface[] = [],
): Promise<SurfacePhysicsWorld> {
  await preparePhysics()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  let entries: Array<{ surface: WorldSurface; collider: RAPIER.Collider }> = []
  let lastSignature = ''

  function rebuild(surfaces: WorldSurface[]) {
    for (const entry of entries) {
      world.removeCollider(entry.collider, false)
    }
    entries = surfaces.map((surface) => {
      const desc = RAPIER.ColliderDesc.cuboid(
        Math.max(0.02, surface.width / 2),
        COLLIDER_HALF_HEIGHT,
        Math.max(0.2, surface.depth / 2),
      )
        .setTranslation(surface.x, surface.y - COLLIDER_HALF_HEIGHT, surface.z)
        .setFriction(0.75)
        .setRestitution(0.1)
      return {
        surface,
        collider: world.createCollider(desc),
      }
    })
  }

  function sync(surfaces: WorldSurface[]): boolean {
    const signature = computeSurfaceSignature(surfaces)
    if (signature === lastSignature) return false
    lastSignature = signature
    rebuild(surfaces)
    return true
  }

  function floorAt(x: number, z: number, below = Infinity): number {
    let best = -Infinity
    for (const { surface } of entries) {
      if (
        surface.y <= below &&
        Math.abs(x - surface.x) <= surface.width / 2 &&
        Math.abs(z - surface.z) <= surface.depth / 2
      ) {
        best = Math.max(best, surface.y)
      }
    }
    return best
  }

  function isUpwardSupport(normalY: number): boolean {
    return normalY > 0.7
  }

  sync(initialSurfaces)

  return {
    sync,
    floorAt,
    isUpwardSupport,
    getColliders: () => entries,
    dispose: () => world.free(),
  }
}
