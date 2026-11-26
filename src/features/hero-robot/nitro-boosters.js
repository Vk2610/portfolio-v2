import {
  AdditiveBlending,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three'

export function createNitroBoosters(scene, sides) {
  const coreGeo = new ConeGeometry(0.072, 0.42, 12)
  coreGeo.rotateX(Math.PI)
  coreGeo.translate(0, -0.21, 0)

  const flameGeo = new ConeGeometry(0.17, 1.28, 16)
  flameGeo.rotateX(Math.PI)
  flameGeo.translate(0, -0.64, 0)

  const particleGeo = new SphereGeometry(0.038, 7, 7)

  const coreMat = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  })

  const flameMat = new MeshBasicMaterial({
    color: '#00E5FF',
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const tipMat = new MeshBasicMaterial({
    color: '#008CFF',
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const tipGeo = new ConeGeometry(0.118, 0.7, 16)
  tipGeo.rotateX(Math.PI)
  tipGeo.translate(0, -0.35, 0)

  const thrusters = []

  for (const side of sides) {
    const group = new Group()
    group.name = 'Nitro booster plume'
    group.position.set(0, -0.025, 0.02)
    group.visible = false

    const core = new Mesh(coreGeo, coreMat)
    core.renderOrder = 4
    const flame = new Mesh(flameGeo, flameMat)
    flame.renderOrder = 3
    const tip = new Mesh(tipGeo, tipMat)
    tip.position.y = -0.46
    tip.renderOrder = 4

    const nozzle = new Group()
    group.add(flame, tip, core, nozzle)
    side.leg.tip.add(group)
    thrusters.push({ group, core, flame, tip, nozzle })
  }

  const particlePool = []
  for (let i = 0; i < 12; i++) {
    const material = new MeshBasicMaterial({
      color: i % 3 === 0 ? '#ffffff' : '#38e8ff',
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const mesh = new Mesh(particleGeo, material)
    mesh.visible = false
    mesh.renderOrder = 3
    scene.add(mesh)
    particlePool.push({
      mesh,
      material,
      age: 0,
      life: 0.32,
      vx: 0,
      vy: -1.4,
      vz: 0,
      active: false,
    })
  }

  const worldPos = new Vector3()
  let spawnAccum = 0
  let poolIndex = 0
  let shownIntensity = 0
  let forced = false

  function update(dt, intensity, timeSec, reduced) {
    const target = forced ? 1 : Math.max(0, Math.min(1, intensity))
    shownIntensity += (target - shownIntensity) * (1 - Math.exp(-dt * 18))
    const clamped = shownIntensity
    const active = clamped > 0.01

    const flicker = reduced
      ? 1
      : 0.92 + 0.08 * Math.sin(timeSec * 46) + 0.04 * Math.cos(timeSec * 73)
    const lengthScale = (0.88 + 0.2 * clamped) * flicker
    const widthScale = 1.22 + 0.24 * clamped

    coreMat.opacity = Math.min(1, clamped * 1.15)
    flameMat.opacity = Math.min(0.96, clamped * 1.05)
    tipMat.opacity = Math.min(0.82, clamped * 0.9)

    for (const t of thrusters) {
      t.group.visible = active
      t.core.scale.set(widthScale, lengthScale, widthScale)
      t.flame.scale.set(
        widthScale * 1.06,
        lengthScale * 1.08,
        widthScale * 1.06,
      )
      t.tip.scale.set(widthScale, lengthScale, widthScale)
    }

    if (!reduced && target > 0.15) {
      spawnAccum += dt * (18 * clamped)
      while (spawnAccum >= 1) {
        spawnAccum -= 1
        const thruster = thrusters[poolIndex % thrusters.length]
        const particle = particlePool[poolIndex % particlePool.length]
        poolIndex++
        thruster.nozzle.getWorldPosition(worldPos)
        particle.mesh.position.copy(worldPos)
        particle.vx = (Math.random() - 0.5) * 0.38
        particle.vy = -1.5 - Math.random() * 0.8
        particle.vz = (Math.random() - 0.5) * 0.2
        particle.age = 0
        particle.life = 0.24 + Math.random() * 0.14
        particle.active = true
        particle.mesh.visible = true
      }
    }

    for (const p of particlePool) {
      if (!p.active) continue
      p.age += dt
      if (p.age >= p.life) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      const u = p.age / p.life
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
      const s = Math.max(0.2, 1 - u * 0.75)
      p.mesh.scale.setScalar(s)
      p.material.opacity = (1 - u) * 0.55 * Math.max(clamped, 0.2)
    }
  }

  function dispose() {
    for (const t of thrusters) {
      t.group.removeFromParent()
    }
    for (const p of particlePool) {
      p.mesh.removeFromParent()
      p.material.dispose()
    }
    coreGeo.dispose()
    flameGeo.dispose()
    tipGeo.dispose()
    particleGeo.dispose()
    coreMat.dispose()
    flameMat.dispose()
    tipMat.dispose()
  }

  function setForced(value) {
    forced = Boolean(value)
  }

  function diagnostics() {
    return {
      forced,
      intensity: shownIntensity,
      visible: thrusters.every(
        ({ group, core, flame }) =>
          group.visible && core.visible && flame.visible,
      ),
      worldPositions: thrusters.map(({ group }) => {
        const position = new Vector3()
        group.getWorldPosition(position)
        return position.toArray()
      }),
    }
  }

  return { update, dispose, setForced, diagnostics }
}
