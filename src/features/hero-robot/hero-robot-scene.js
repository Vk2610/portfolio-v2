/* global window, document, performance, ResizeObserver, IntersectionObserver */
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
import { observePortfolioSurfaces } from '@/features/robot-surfaces/surface-observer'
import { createSurfacePhysicsWorld } from '@/features/robot-surfaces/surface-physics'

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
  host.append(renderer.domElement)

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

  const physics = {
    floorAt: () => 0,
    updateSurfaces: () => {},
    dispose: () => {},
  }
  const emotions = createEmotionController({
    now: () => performance.now(),
    onChange: () => startLoop(),
  })
  const movement = createMovement(robot, physics, emotions, physicsDefaults)
  const tracking = createHeadTracking(movement.rig, camera, () =>
    renderer.domElement.getBoundingClientRect(),
  )
  const magneticCursor = createMagneticRobotCursor()

  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let inView = true
  let raf = 0
  let disposed = false
  let lastTime = 0
  let cyclePhase = 'idle'
  let phaseRemaining = 5
  let walkDir = -1
  let limitX = 1.5
  let spawned = false
  let tap = null
  let hasPointer = false
  let lastPointerX = 0
  let lastPointerY = 0

  function updateCamera(width, height) {
    const aspect = width / Math.max(1, height)
    const viewHeight = modelHeight * 1.35
    const halfW = (viewHeight * aspect) / 2
    camera.left = -halfW
    camera.right = halfW
    camera.bottom = minY
    camera.top = minY + viewHeight
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)

    limitX = Math.max(0.25, Math.min(1.95, halfW - robotHalfWidth - 0.08))

    if (!spawned) {
      spawned = true
      robot.root.position.x = 0
    } else {
      robot.root.position.x = Math.max(
        -limitX,
        Math.min(limitX, robot.root.position.x),
      )
    }
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

    if (!reduced) {
      const statusBefore = movement.status()
      const canAdvanceCycle =
        !tap?.rotating &&
        emotionFrame.current === 'neutral' &&
        !movement.isLocked() &&
        statusBefore.grounded

      if (canAdvanceCycle) {
        if (cyclePhase === 'idle') {
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
          if (walkDir < 0 && x <= -limitX) {
            walkDir = 1
            movement.walk(1)
            movement.faceYaw(Math.PI / 2)
          } else if (walkDir > 0 && x >= limitX) {
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
      } else if (tap?.rotating) {
        movement.stop()
      } else {
        movement.stop()
        movement.faceYaw(0)
      }
    }

    movement.update(timeMs, dt, reduced)
    const status = movement.status()
    if (!tap?.rotating) {
      tracking.step(timeMs, dt, status.state, emotionFrame.current, reduced)
    }
    robot.root.position.x = Math.max(
      -limitX,
      Math.min(limitX, robot.root.position.x),
    )
    robot.root.updateMatrixWorld(true)
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
    if (!document.hidden && inView && !(motionQuery?.matches ?? false)) {
      raf = window.requestAnimationFrame(frame)
    }
  }

  function startLoop() {
    if (disposed || raf) return
    lastTime = 0
    stepSimulation(performance.now())
    if (!document.hidden && inView && !(motionQuery?.matches ?? false)) {
      raf = window.requestAnimationFrame(frame)
    }
  }

  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          syncPlacement()
          stepSimulation(performance.now())
        })
  resizeObserver?.observe(heading)
  resizeObserver?.observe(container)

  const intersectionObserver =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          inView = entry?.isIntersecting ?? true
          if (inView && !document.hidden) startLoop()
          else stopLoop()
        })
  intersectionObserver?.observe(container)

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
  document.addEventListener('visibilitychange', handleVisibility)
  motionQuery?.addEventListener('change', handleMotionChange)
  void document.fonts?.ready?.then(() => {
    if (!disposed) {
      syncPlacement()
      stepSimulation(performance.now())
    }
  })

  syncPlacement()
  startLoop()

  let surfacePhysics = null
  let latestSurfaces = []
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
    },
  })

  return () => {
    disposed = true
    stopLoop()
    stopObservingSurfaces()
    surfacePhysics?.dispose()
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
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
    document.removeEventListener('visibilitychange', handleVisibility)
    motionQuery?.removeEventListener('change', handleMotionChange)
    magneticCursor.destroy()
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
    renderer.domElement.remove()
  }
}
