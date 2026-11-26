/* global window, document, performance, CustomEvent, ResizeObserver */
import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { createRobot } from '@/features/robot-preview/robot.js'
import { createEmotionController } from '@/features/robot-preview/emotions.js'
import { physicsDefaults } from '@/features/robot-preview/fall-physics.js'
import { createMovement } from '@/features/robot-preview/movement.js'
import { createHeadTracking } from '@/features/robot-preview/head-tracking.js'
import { computeHeroRobotPlacement } from './hero-robot-placement'
import { createMagneticRobotCursor } from './magnetic-cursor'
import { createNitroBoosters } from './nitro-boosters.js'
import { createFlightController } from './flight-controller'
import { observePortfolioSurfaces } from '@/features/robot-surfaces/surface-observer'
import { createSurfacePhysicsWorld } from '@/features/robot-surfaces/surface-physics'
import { resolveHeroWorldOrigin } from '@/features/robot-surfaces/surface-registry'
import { evaluatePlatformBounds } from '@/features/robot-surfaces/platform-movement'
import { selectLandingPoint } from './landing-position'

function createStudioEnvironment(renderer) {
  const studio = new Scene()
  function panel(x, y, z, width, height, color, intensity) {
    const lightBox = new Mesh(
      new BoxGeometry(width, height, 0.02),
      new MeshBasicMaterial({ color }),
    )
    lightBox.material.color.multiplyScalar(intensity)
    lightBox.position.set(x, y, z)
    lightBox.lookAt(0, 2.5, 0)
    studio.add(lightBox)
  }
  panel(-3.8, 6.2, 4.2, 4, 2.9, '#eaf0ff', 1.8)
  panel(3.8, 4.8, 3.5, 1.8, 2.7, '#ffceb5', 1.5)
  panel(0.5, 6.7, -3.5, 6, 2.2, '#cdd8ff', 2.6)
  const generator = new PMREMGenerator(renderer)
  const result = generator.fromScene(studio, 0.04, 0.1, 25, {
    size: 128,
  })
  generator.dispose()
  studio.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry?.dispose()
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose())
      } else {
        object.material?.dispose()
      }
    }
  })
  return result
}

export function mountHeroRobot(host, container, heading) {
  let renderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true })
  } catch {
    return () => {}
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.pointerEvents = 'none'
  const stageOverlay = document.createElement('div')
  stageOverlay.setAttribute('aria-hidden', 'true')
  stageOverlay.setAttribute('data-hero-robot-stage', '')
  stageOverlay.style.position = 'fixed'
  stageOverlay.style.inset = '0'
  stageOverlay.style.zIndex = '30'
  stageOverlay.style.pointerEvents = 'none'
  stageOverlay.style.overflow = 'hidden'
  stageOverlay.append(renderer.domElement)
  document.body.append(stageOverlay)

  const scene = new Scene()
  const lighting = createStudioEnvironment(renderer)
  scene.environment = lighting.texture
  scene.add(new HemisphereLight('#e4e9ff', '#ada1b0', 1.55))

  function addLight(color, intensity, x, y, z) {
    const source = new DirectionalLight(color, intensity)
    source.position.set(x, y, z)
    scene.add(source)
  }
  addLight('#f6edff', 2.25, -3, 6, 5)
  addLight('#ffc5ad', 1.25, 4, 4, 3)
  addLight('#82baff', 2.6, -3, 3.5, -3.5)

  const robot = createRobot()
  scene.add(robot.root)

  robot.root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(robot.root)
  const minY = bounds.min.y
  const modelHeight = Math.max(0.5, bounds.max.y - minY)
  const viewHeightWorld = modelHeight * 1.35
  const robotHalfWidth = Math.max(0.25, (bounds.max.x - bounds.min.x) / 2)
  host.dataset.worldHeight = String(viewHeightWorld)

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  let initialized = false
  let disposed = false
  let raf = 0
  let activeSurfaceY = 0
  let lastTime = 0
  let cyclePhase = 'idle'
  let phaseRemaining = 5
  let walkDir = -1
  let minX = -1.5
  let maxX = 1.5
  let canWalkPlatform = true
  let supportLost = false
  let activePlatformId = 'hero-platform-1'
  let worldOrigin = null
  let spawned = false
  let tap = null
  let hasPointer = false
  let lastPointerX = 0
  let lastPointerY = 0
  let latestSurfaces = []
  let prevFlightState = 'GROUNDED'
  let scrollDirection = 'none'
  let scrollVelocity = 0
  let lastScrollAt = 0
  let scrollStopTimer = 0
  let travelTarget = null
  let flightOrigin = null
  let landingDestination = null
  let lastTelemetryAt = 0
  let forceNitro = false

  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const physics = {
    floorAt: () => activeSurfaceY,
    updateSurfaces: () => {},
    dispose: () => {},
  }
  const emotions = createEmotionController({
    now: () => performance.now(),
    onChange: () => {
      if (initialized) startLoop()
    },
  })
  const movement = createMovement(robot, physics, emotions, physicsDefaults)
  const tracking = createHeadTracking(movement.rig, camera, () =>
    renderer.domElement.getBoundingClientRect(),
  )
  const magneticCursor = createMagneticRobotCursor()
  const nitroBoosters = createNitroBoosters(scene, movement.rig.sides)
  const flight = createFlightController()

  function updateCamera(width, height) {
    const aspect = width / Math.max(1, height)
    const halfW = (viewHeightWorld * aspect) / 2
    worldOrigin = resolveHeroWorldOrigin(host, viewHeightWorld)

    const vw = window.innerWidth || 1
    const vh = window.innerHeight || 1
    renderer.setSize(vw, vh, false)

    if (!spawned) {
      spawned = true
      const walkSpan = Math.max(0.5, (halfW - robotHalfWidth - 0.08) * 2)
      minX = -walkSpan / 2
      maxX = walkSpan / 2
      robot.root.position.x = 0
    }
  }

  function syncCameraToViewport() {
    if (!worldOrigin) return
    const vw = window.innerWidth || 1
    const vh = window.innerHeight || 1
    const scrollX = window.scrollX || window.pageXOffset || 0
    const scrollY = window.scrollY || window.pageYOffset || 0
    const { anchorDocX, anchorDocY, pxPerWorldUnit } = worldOrigin

    camera.left = (scrollX - anchorDocX) / pxPerWorldUnit
    camera.right = (scrollX + vw - anchorDocX) / pxPerWorldUnit
    camera.top = (anchorDocY - scrollY) / pxPerWorldUnit
    camera.bottom = (anchorDocY - (scrollY + vh)) / pxPerWorldUnit
    camera.updateProjectionMatrix()
  }

  function syncPlacement() {
    if (disposed) return
    const placement = computeHeroRobotPlacement(heading, container)
    if (!placement) return
    host.style.left = `${placement.left}px`
    host.style.top = `${placement.top}px`
    host.style.width = `${placement.width}px`
    host.style.height = `${placement.height}px`
    updateCamera(placement.width, placement.height)
  }

  function hitRobot(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect()
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return false
    }
    ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    return raycaster.intersectObjects(robot.hitMeshes, false).length > 0
  }

  function stepSimulation(timeMs) {
    const reduced = motionQuery?.matches ?? false
    const dt = lastTime ? Math.min((timeMs - lastTime) / 1000, 0.05) : 0.016
    lastTime = timeMs

    const emotionFrame = emotions.frame(timeMs, reduced)
    robot.face.update(emotionFrame, timeMs, reduced)

    const flightFrame = flight.step(dt, reduced)
    if (
      flightFrame.state === 'HOVERING' &&
      flight.getInactiveTime() >= 2.5 &&
      !landingDestination
    ) {
      const navClearance = 84
      const origin = worldOrigin
      const visibleLeft = window.scrollX
      const visibleRight = visibleLeft + window.innerWidth
      const clearancePx = modelHeight * origin.pxPerWorldUnit
      const candidates = latestSurfaces
        .map((surface) => {
          const viewportY = surface.docTop - window.scrollY
          const left = Math.max(surface.docLeft, visibleLeft)
          const right = Math.min(
            surface.docLeft + surface.pxWidth,
            visibleRight,
          )
          const visibleWorldWidth =
            Math.max(0, right - left) / origin.pxPerWorldUnit
          const bounds = evaluatePlatformBounds(surface, robotHalfWidth)
          const standingWidth = robotHalfWidth * 2 + 0.1
          const eligible =
            bounds.canStand &&
            visibleWorldWidth >= standingWidth &&
            viewportY >= navClearance &&
            viewportY <= window.innerHeight - 24 &&
            viewportY - navClearance >= clearancePx
          const visibleWorldLeft =
            (left - origin.anchorDocX) / origin.pxPerWorldUnit
          const visibleWorldRight =
            (right - origin.anchorDocX) / origin.pxPerWorldUnit
          const minX = Math.max(bounds.minX, visibleWorldLeft + robotHalfWidth)
          const maxX = Math.min(bounds.maxX, visibleWorldRight - robotHalfWidth)
          const point = selectLandingPoint(
            { minX: bounds.minX, maxX: bounds.maxX },
            { minX, maxX },
            robot.root.position.x,
            robot.root.position.y,
            surface.y,
          )
          return {
            surface,
            bounds,
            point,
            eligible,
            distance: point?.distance ?? Infinity,
          }
        })
        .filter((candidate) => candidate.eligible && candidate.point)
        .sort(
          (a, b) =>
            Number(b.point.directlyBelow) - Number(a.point.directlyBelow) ||
            a.distance - b.distance ||
            b.bounds.walkableWidth - a.bounds.walkableWidth,
        )
      const selected = candidates[0]
      if (selected && flight.approach()) {
        landingDestination = {
          platformId: selected.surface.id,
          x: selected.point.x,
          y: selected.surface.y,
          minX: selected.bounds.minX,
          maxX: selected.bounds.maxX,
          canWalk: selected.bounds.canWalk,
        }
        travelTarget = { x: landingDestination.x, y: landingDestination.y }
      }
    }
    if (flightFrame.isFlying && travelTarget && worldOrigin) {
      const follow = 1 - Math.exp(-dt * 5.5)
      robot.root.position.x += (travelTarget.x - robot.root.position.x) * follow
      robot.root.position.y +=
        (travelTarget.y + flightFrame.hoverOffset - robot.root.position.y) *
        follow
      robot.root.quaternion.identity()
    }
    if (
      ['DESCENDING', 'LANDING'].includes(prevFlightState) &&
      flightFrame.state === 'GROUNDED'
    ) {
      forceNitro = false
      nitroBoosters.setForced(false)
      window.dispatchEvent(
        new CustomEvent('portfolio:force-nitro-state', { detail: false }),
      )
      if (landingDestination) {
        activePlatformId = landingDestination.platformId
        activeSurfaceY = landingDestination.y
        minX = landingDestination.minX
        maxX = landingDestination.maxX
        canWalkPlatform = landingDestination.canWalk
        robot.root.position.set(landingDestination.x, landingDestination.y, 0)
        movement.stagePlatform(landingDestination.y, landingDestination.x)
        travelTarget = null
        landingDestination = null
        flightOrigin = null
      } else if (flightOrigin) {
        robot.root.position.set(flightOrigin.x, flightOrigin.y, flightOrigin.z)
        travelTarget = null
      }
      cyclePhase = 'idle'
      phaseRemaining = 5
      movement.stop()
      movement.faceYaw(0)
    }
    prevFlightState = flightFrame.state

    if (!reduced) {
      const statusBefore = movement.status()
      const canAdvanceCycle =
        !flightFrame.isFlying &&
        !tap?.rotating &&
        !supportLost &&
        emotionFrame.current === 'neutral' &&
        !movement.isLocked() &&
        statusBefore.grounded

      if (canAdvanceCycle) {
        if (!canWalkPlatform) {
          movement.stop()
          movement.faceYaw(0)
        } else if (cyclePhase === 'idle') {
          movement.stop()
          if (statusBefore.state === 'idle') {
            phaseRemaining -= dt
          }
          if (phaseRemaining <= 0) {
            cyclePhase = 'walking'
            phaseRemaining = 5 + Math.random() * 2
            movement.walk(walkDir)
            movement.faceYaw(walkDir * (Math.PI / 2))
          }
        } else {
          phaseRemaining -= dt
          const x = robot.root.position.x
          if (walkDir < 0 && x <= minX) {
            walkDir = 1
            movement.walk(1)
            movement.faceYaw(Math.PI / 2)
          } else if (walkDir > 0 && x >= maxX) {
            walkDir = -1
            movement.walk(-1)
            movement.faceYaw(-Math.PI / 2)
          } else if (statusBefore.state === 'idle') {
            movement.walk(walkDir)
            movement.faceYaw(walkDir * (Math.PI / 2))
          }
          if (phaseRemaining <= 0) {
            cyclePhase = 'idle'
            phaseRemaining = 5
            movement.stop()
            movement.faceYaw(0)
          }
        }
      } else if (flightFrame.isFlying) {
        movement.stop()
        movement.faceYaw(0)
      } else if (tap?.rotating) {
        movement.stop()
      } else {
        movement.stop()
        movement.faceYaw(0)
      }
    }

    // Flight owns the complete pose while airborne. The movement controller
    // is resumed only once the flight controller reports a grounded frame.
    if (flightFrame.isFlying) {
      movement.rig.rest()
    } else {
      movement.update(timeMs, dt, reduced)
    }
    if (flightFrame.isFlying) {
      if (!travelTarget)
        robot.root.position.y = activeSurfaceY + flightFrame.hoverOffset
      const { rig } = movement
      if (flightFrame.kneeBend > 0) {
        rig.body.position.y -= flightFrame.kneeBend * 0.24 * rig.body.scale.x
        rig.neck.position.y -= flightFrame.kneeBend * 0.24 * rig.body.scale.x
      }
      for (const side of rig.sides) {
        if (flightFrame.kneeBend > 0) {
          rig.offset(side.leg.upper, -flightFrame.kneeBend * 1.15, 0, 0)
          rig.offset(side.leg.joint, flightFrame.kneeBend * 2.15, 0, 0)
          rig.offset(side.leg.tip, -flightFrame.kneeBend * 0.75, 0, 0)
        } else if (flightFrame.legExtend > 0) {
          rig.offset(side.leg.upper, -flightFrame.legExtend * 0.45, 0, 0)
          rig.offset(side.leg.joint, flightFrame.legExtend * 0.75, 0, 0)
        }
        rig.levelFoot(side.leg, 1)
        if (flightFrame.armSpread > 0) {
          rig.offset(
            side.arm.upper,
            -0.14 * flightFrame.armSpread,
            0,
            side.sign * flightFrame.armSpread,
          )
          rig.offset(side.arm.joint, -0.22 * flightFrame.armSpread, 0, 0)
        }
      }
    }
    nitroBoosters.update(
      dt,
      flightFrame.boosterIntensity,
      timeMs / 1000,
      reduced,
    )

    const status = movement.status()
    if (!tap?.rotating) {
      tracking.step(timeMs, dt, status.state, emotionFrame.current, reduced)
    }
    if (!flightFrame.isFlying)
      robot.root.position.x = Math.max(
        minX,
        Math.min(maxX, robot.root.position.x),
      )
    robot.root.updateMatrixWorld(true)
    syncCameraToViewport()
    if (import.meta.env.DEV) {
      if (timeMs - lastTelemetryAt >= 100) {
        lastTelemetryAt = timeMs
        window.dispatchEvent(
          new CustomEvent('portfolio:robot-telemetry', {
            detail: {
              platformId: activePlatformId,
              state: flightFrame.isFlying ? flightFrame.state : status.state,
              minX,
              maxX,
              supportLost,
              flightState: flightFrame.state,
              hoverHeight: flightFrame.hoverOffset,
              boosterIntensity: flightFrame.boosterIntensity,
              scrollDirection,
              scrollVelocity,
              scrollInactiveMs: flight.getInactiveTime() * 1000,
              viewportPosition: {
                x: robot.root.position.x,
                y: robot.root.position.y,
              },
              targetPosition: travelTarget,
              booster: nitroBoosters.diagnostics(),
            },
          }),
        )
      }
    }
    if (tap?.rotating && tap.pointerType !== 'touch' && !reduced) {
      magneticCursor.setHover(true)
    } else if (hasPointer && !reduced) {
      magneticCursor.setHover(hitRobot(lastPointerX, lastPointerY))
    } else {
      magneticCursor.setHover(false)
    }
    magneticCursor.step(timeMs, dt, emotionFrame.mix[3] ?? 0, reduced)
    renderer.render(scene, camera)
  }

  function stopLoop() {
    if (raf) {
      window.cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function frame(timeMs) {
    raf = 0
    if (disposed) return
    stepSimulation(timeMs)
    if (!document.hidden && !(motionQuery?.matches ?? false)) {
      raf = window.requestAnimationFrame(frame)
    }
  }

  function startLoop() {
    if (!initialized || disposed || raf) return
    lastTime = 0
    stepSimulation(performance.now())
    if (!document.hidden && !(motionQuery?.matches ?? false)) {
      raf = window.requestAnimationFrame(frame)
    }
  }

  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (!initialized || disposed) return
          syncPlacement()
          stepSimulation(performance.now())
        })
  resizeObserver?.observe(heading)
  resizeObserver?.observe(container)

  const handlePointerMove = (event) => {
    if (tap && tap.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
      if (!tap.rotating && moved > 5) {
        tap.rotating = true
        tap.lastX = event.clientX
        movement.stop()
        tracking.clear()
      }
      if (tap.rotating) {
        if (event.cancelable) event.preventDefault()
        const dx = event.clientX - tap.lastX
        tap.lastX = event.clientX
        movement.rotateBy(dx * 0.012)
        if (tap.pointerType !== 'touch') {
          hasPointer = true
          lastPointerX = event.clientX
          lastPointerY = event.clientY
        }
        magneticCursor.setPointer(event.clientX, event.clientY)
        startLoop()
        return
      }
    }
    if (event.pointerType === 'touch') return
    hasPointer = true
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    magneticCursor.setPointer(event.clientX, event.clientY)
    if (!event.buttons) {
      tracking.point(event.clientX, event.clientY, performance.now())
    }
  }
  const handlePointerDown = (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      tap = null
      return
    }
    if (
      !flight.isFlying() &&
      !movement.isLocked() &&
      movement.status().grounded &&
      hitRobot(event.clientX, event.clientY)
    ) {
      tap = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        pointerType: event.pointerType,
        rotating: false,
      }
      if (event.pointerType === 'touch') {
        magneticCursor.touchPress(event.clientX, event.clientY)
      } else {
        hasPointer = true
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        magneticCursor.setPointer(event.clientX, event.clientY)
        magneticCursor.setHover(true)
        magneticCursor.setPressed(true)
      }
    } else {
      tap = null
    }
  }
  const finishPointerInteraction = (event, cancelled = false) => {
    if (!tap || tap.id !== event.pointerId) return
    const wasRotating = tap.rotating
    const pointerType = tap.pointerType
    const withinTapThreshold =
      !cancelled &&
      !wasRotating &&
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 5
    tap = null

    if (pointerType === 'touch') {
      magneticCursor.touchRelease()
    } else {
      magneticCursor.setPointer(event.clientX, event.clientY)
      if (!cancelled && hitRobot(event.clientX, event.clientY)) {
        magneticCursor.releaseBurst()
      } else {
        magneticCursor.setPressed(false)
        magneticCursor.setHover(false)
      }
    }

    if (wasRotating) {
      cyclePhase = 'idle'
      phaseRemaining = 5
      movement.stop()
      movement.faceYaw(0)
      startLoop()
      return
    }

    if (withinTapThreshold && !motionQuery?.matches && !movement.isLocked()) {
      if (pointerType === 'touch') {
        tracking.point(event.clientX, event.clientY, performance.now(), true)
      }
      emotions.registerInteraction()
      startLoop()
    }
  }
  const handlePointerUp = (event) => finishPointerInteraction(event, false)
  const handlePointerCancel = (event) => finishPointerInteraction(event, true)
  const handlePointerLeave = (event) => {
    if (event.pointerType !== 'touch') {
      hasPointer = false
      tracking.clear()
      magneticCursor.setPressed(false)
      magneticCursor.setHover(false)
    }
  }
  const handleBlur = () => {
    tap = null
    hasPointer = false
    tracking.clear()
    magneticCursor.setPressed(false)
    magneticCursor.setHover(false)
  }
  const handleResize = () => {
    syncPlacement()
    stepSimulation(performance.now())
  }
  let previousScrollY = window.scrollY
  const handleScroll = () => {
    const now = performance.now()
    const current = window.scrollY
    const delta = current - previousScrollY
    previousScrollY = current
    if (Math.abs(delta) < 3) return
    const elapsed = Math.max(1, now - (lastScrollAt || now - 16))
    lastScrollAt = now
    scrollDirection = delta > 0 ? 'down' : 'up'
    scrollVelocity = (delta / elapsed) * 1000
    window.clearTimeout(scrollStopTimer)

    if (flight.getState() === 'GROUNDED') {
      cyclePhase = 'idle'
      phaseRemaining = 5
      movement.stop()
      movement.faceYaw(0)
      travelTarget = { x: robot.root.position.x, y: robot.root.position.y }
      flightOrigin = robot.root.position.clone()
      flight.startTakeoff()
    }
    flight.setScrolling(true)
    landingDestination = null
    if (worldOrigin) {
      const px = window.innerWidth * 0.72
      const py = window.innerHeight * 0.68
      travelTarget = {
        x:
          (window.scrollX + px - worldOrigin.anchorDocX) /
          worldOrigin.pxPerWorldUnit,
        y:
          (worldOrigin.anchorDocY - (window.scrollY + py)) /
          worldOrigin.pxPerWorldUnit,
      }
    }
    startLoop()
    scrollStopTimer = window.setTimeout(() => {
      flight.setScrolling(false)
      startLoop()
    }, 180)
  }
  const handleVisibility = () => {
    if (document.hidden) stopLoop()
    else startLoop()
  }
  const handleMotionChange = () => {
    stopLoop()
    startLoop()
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: false })
  window.addEventListener('pointerdown', handlePointerDown, { passive: true })
  window.addEventListener('pointerup', handlePointerUp, { passive: true })
  window.addEventListener('pointercancel', handlePointerCancel, {
    passive: true,
  })
  window.addEventListener('blur', handleBlur)
  document.documentElement.addEventListener('pointerleave', handlePointerLeave)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  motionQuery?.addEventListener('change', handleMotionChange)
  void document.fonts?.ready?.then(() => {
    if (initialized && !disposed) {
      syncPlacement()
      stepSimulation(performance.now())
    }
  })

  initialized = true
  syncPlacement()
  startLoop()

  let surfacePhysics = null
  void createSurfacePhysicsWorld().then((world) => {
    if (disposed) {
      world.dispose()
      return
    }
    surfacePhysics = world
    if (latestSurfaces.length > 0) {
      surfacePhysics.sync(latestSurfaces)
    }
  })
  const stopObservingSurfaces = observePortfolioSurfaces({
    getViewHeightWorld: () => viewHeightWorld,
    onSurfacesChange: (surfaces) => {
      latestSurfaces = surfaces
      surfacePhysics?.sync(surfaces)
      const current = surfaces.find((s) => s.id === activePlatformId)
      if (!current) {
        supportLost = true
        canWalkPlatform = false
        return
      }
      const evaluated = evaluatePlatformBounds(current, robotHalfWidth)
      supportLost = !evaluated.canStand
      canWalkPlatform = evaluated.canWalk
      activeSurfaceY = current.y
      minX = evaluated.minX
      maxX = evaluated.maxX
      robot.root.position.x = Math.max(
        minX,
        Math.min(maxX, robot.root.position.x),
      )
      robot.root.position.y = activeSurfaceY
    },
  })

  const handlePlaceRobot = (event) => {
    if (!import.meta.env.DEV) return
    const targetId = event.detail?.platformId
    if (!targetId) return
    const target = latestSurfaces.find((s) => s.id === targetId)
    if (!target) return
    const evaluated = evaluatePlatformBounds(target, robotHalfWidth)
    if (!evaluated.canStand) return
    flight.reset()
    prevFlightState = 'GROUNDED'
    activePlatformId = target.id
    supportLost = false
    canWalkPlatform = evaluated.canWalk
    activeSurfaceY = target.y
    minX = evaluated.minX
    maxX = evaluated.maxX
    cyclePhase = 'idle'
    phaseRemaining = 5
    movement.stagePlatform(target.y, target.x)
    movement.stop()
    movement.faceYaw(0)
    startLoop()
  }
  const handleForceNitro = (event) => {
    if (!import.meta.env.DEV) return
    forceNitro = Boolean(event.detail?.enabled)
    nitroBoosters.setForced(forceNitro)
    startLoop()
  }
  const handleFlightTakeoff = () => {
    if (!import.meta.env.DEV) return
    if (flight.startTakeoff()) {
      movement.stop()
      movement.faceYaw(0)
      startLoop()
    }
  }
  const handleFlightLand = () => {
    if (!import.meta.env.DEV) return
    if (flight.startLanding()) {
      if (flightOrigin) travelTarget = { x: flightOrigin.x, y: flightOrigin.y }
      startLoop()
    }
  }
  if (import.meta.env.DEV) {
    window.addEventListener('portfolio:place-robot', handlePlaceRobot)
    window.addEventListener('portfolio:flight-takeoff', handleFlightTakeoff)
    window.addEventListener('portfolio:flight-land', handleFlightLand)
    window.addEventListener('portfolio:force-nitro', handleForceNitro)
  }

  return () => {
    disposed = true
    initialized = false
    stopLoop()
    stopObservingSurfaces()
    if (import.meta.env.DEV) {
      window.removeEventListener('portfolio:place-robot', handlePlaceRobot)
      window.removeEventListener(
        'portfolio:flight-takeoff',
        handleFlightTakeoff,
      )
      window.removeEventListener('portfolio:flight-land', handleFlightLand)
      window.removeEventListener('portfolio:force-nitro', handleForceNitro)
    }
    surfacePhysics?.dispose()
    resizeObserver?.disconnect()
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
    window.removeEventListener('blur', handleBlur)
    document.documentElement.removeEventListener(
      'pointerleave',
      handlePointerLeave,
    )
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('scroll', handleScroll)
    window.clearTimeout(scrollStopTimer)
    document.removeEventListener('visibilitychange', handleVisibility)
    motionQuery?.removeEventListener('change', handleMotionChange)
    magneticCursor.destroy()
    nitroBoosters.dispose()
    physics.dispose()
    lighting.dispose()
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose())
        } else {
          object.material?.dispose()
        }
      }
    })
    renderer.dispose()
    stageOverlay.remove()
  }
}
