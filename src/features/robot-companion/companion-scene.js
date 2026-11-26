/* global window, document, performance, AbortController */
import {
  ACESFilmicToneMapping,
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
  Vector3,
  WebGLRenderer,
} from 'three'
import { createRobot } from '../robot-preview/robot.js'
import { createEmotionController } from '../robot-preview/emotions.js'
import { createHeadTracking } from '../robot-preview/head-tracking.js'
import { createMovement } from '../robot-preview/movement.js'
import {
  companionScale,
  clearanceFor,
  pixelsPerUnit,
  watchSurfaces,
} from './surface-registry.js'
import { makePatrol } from './patrol.js'

const width = 184
const height = 196
const aboveFeet = 31
const interactive =
  'header,nav,a,button,input,select,textarea,label,summary,[role="button"],[role="tab"],[role="link"],[contenteditable],[data-cursor="network"]'

function lightScene(scene, renderer) {
  const studio = new Scene()
  const panels = [
    [-3.8, 6.2, 4.2, 4, 2.9, '#eaf0ff', 1.8],
    [3.8, 4.8, 3.5, 1.8, 2.7, '#ffceb5', 1.5],
    [0.5, 6.7, -3.5, 6, 2.2, '#cdd8ff', 2.6],
  ]
  for (const [x, y, z, w, h, color, intensity] of panels) {
    const panel = new Mesh(
      new BoxGeometry(w, h, 0.02),
      new MeshBasicMaterial({ color }),
    )
    panel.material.color.multiplyScalar(intensity)
    panel.position.set(x, y, z)
    panel.lookAt(0, 2.5, 0)
    studio.add(panel)
  }
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(studio, 0.04, 0.1, 25, { size: 128 })
  pmrem.dispose()
  for (const panel of studio.children) {
    panel.geometry.dispose()
    panel.material.dispose()
  }
  scene.environment = environment.texture
  scene.add(new HemisphereLight('#e4e9ff', '#ada1b0', 1.55))
  for (const [color, intensity, x, y, z] of [
    ['#f6edff', 2.25, -3, 6, 5],
    ['#ffc5ad', 1.25, 4, 4, 3],
    ['#82baff', 2.6, -3, 3.5, -3.5],
  ]) {
    const source = new DirectionalLight(color, intensity)
    source.position.set(x, y, z)
    scene.add(source)
  }
  return environment
}

function disposeModel(scene) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  scene.traverse((part) => {
    if (part.geometry && !part.isSprite) geometries.add(part.geometry)
    if (part.material) materials.add(part.material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) {
    if (material.map) textures.add(material.map)
    material.dispose()
  }
  for (const texture of textures) texture.dispose()
}

export async function mountCompanion(layer, main, signal) {
  if (!window.WebGL2RenderingContext || signal.aborted) return
  const { createFallPhysics, physicsDefaults, preparePhysics } =
    await import('../robot-preview/fall-physics.js')
  if (signal.aborted) return
  await preparePhysics()
  if (signal.aborted) return
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(width, height)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  const canvas = renderer.domElement
  canvas.style.visibility = 'hidden'
  layer.append(canvas)

  const scene = new Scene()
  const environment = lightScene(scene, renderer)
  const robot = createRobot()
  const overall = window.innerWidth < 640 ? 0.63 : companionScale
  const clearance = clearanceFor(overall)
  robot.setScales({ head: 1, body: 0.6, overall })
  scene.add(robot.root)
  const camera = new OrthographicCamera(
    -width / pixelsPerUnit / 2,
    width / pixelsPerUnit / 2,
    height / pixelsPerUnit / 2,
    -height / pixelsPerUnit / 2,
    0.05,
    42,
  )
  const frame = {
    x: 0,
    y: Math.max(12000, document.documentElement.scrollHeight + 3000),
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const emotions = createEmotionController({
    now: () => performance.now(),
    onChange: queue,
  })
  const world = createFallPhysics(robot, physicsDefaults)
  const behaviorPhysics = {
    ...world,
    advance(dt) {
      const result = world.advance(dt)
      patrol.recordContact(result)
      return result
    },
  }
  const movement = createMovement(
    robot,
    behaviorPhysics,
    emotions,
    physicsDefaults,
  )
  const tracking = createHeadTracking(movement.rig, camera, () => paintBounds)
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const headCenter = new Vector3()
  const hits = []
  let paintBounds = { left: 0, top: 0, width, height }
  let paintable = false
  let tap = null
  let raf = 0
  let last = 0
  let measuredAt = -Infinity
  let needsMeasure = true
  let disposed = false
  let finishedBelowPage = false
  let navBottom = 0
  let viewWidth = document.documentElement.clientWidth
  let viewHeight = window.innerHeight
  let currentScrollX = window.scrollX
  let currentScrollY = window.scrollY
  let documentBottom = document.documentElement.scrollHeight
  const registry = watchSurfaces(main, invalidate, clearance)
  const events = new AbortController()
  signal.addEventListener('abort', done, { once: true })

  function report(name, value) {
    if (layer.dataset[name] !== value) layer.dataset[name] = value
  }
  const patrol = makePatrol({
    robot,
    movement,
    physics: world,
    frame,
    report,
    clearance,
  })

  function queue() {
    if (!raf && !disposed && !document.hidden)
      raf = window.requestAnimationFrame(tick)
  }
  function invalidate() {
    needsMeasure = true
    queue()
  }
  function listen(target, type, listener) {
    target.addEventListener(type, listener, {
      passive: true,
      signal: events.signal,
    })
  }

  function placeCamera(dizzy) {
    const { x, y, z } = robot.root.position
    const screenX = frame.x + x * pixelsPerUnit - currentScrollX
    const screenY = frame.y - y * pixelsPerUnit - currentScrollY
    paintBounds = {
      left: screenX - width / 2,
      top: screenY - height / 2 - aboveFeet,
      width,
      height,
    }
    // The transparent crop has padding for poses and rings. Cull against
    // the character, so a sliver of empty canvas never costs a WebGL draw.
    robot.look.localToWorld(headCenter.set(0, 0.976, 0))
    const headY = frame.y - headCenter.y * pixelsPerUnit - currentScrollY
    const visualTop = Math.min(screenY - 15, headY - (dizzy ? 61 : 34))
    const visualBottom = Math.max(screenY + 24, headY + 34)
    paintable =
      screenX > -width &&
      screenX < viewWidth + width &&
      visualBottom > navBottom &&
      visualTop < viewHeight &&
      frame.y - y * pixelsPerUnit < documentBottom + height
    canvas.style.visibility = paintable ? 'visible' : 'hidden'
    canvas.style.transform = `translate(${paintBounds.left}px, ${paintBounds.top}px)`
    if (!paintable) return
    camera.position.set(x, y + aboveFeet / pixelsPerUnit, z + 14)
    camera.updateMatrixWorld(true)
  }

  function tick(now) {
    raf = 0
    if (disposed || document.hidden) {
      last = 0
      return
    }
    if (
      !motion.matches &&
      !paintable &&
      !needsMeasure &&
      last &&
      now - last < 30
    ) {
      queue()
      return
    }
    const dt = last ? Math.min(0.08, (now - last) / 1000) : 1 / 60
    last = now
    if (needsMeasure && now - measuredAt >= 100) {
      measuredAt = now
      needsMeasure = false
      documentBottom = document.documentElement.scrollHeight
      navBottom =
        document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
      patrol.setLines(registry.measure())
    }
    const view = { top: currentScrollY, bottom: currentScrollY + viewHeight }
    if (!finishedBelowPage && patrol.update(now, view, motion.matches)) {
      movement.update(now, dt, motion.matches)
      if (
        frame.y - robot.root.position.y * pixelsPerUnit >
        documentBottom + height * 3
      ) {
        finishedBelowPage = true
      }
      const emotion = emotions.frame(now, motion.matches)
      placeCamera(emotion.current === 'dizzy' || emotion.mix[2] > 0)
      tracking.step(
        now,
        dt,
        movement.status().state,
        emotion.current,
        motion.matches,
      )
      robot.face.update(emotion, now, motion.matches)
      if (paintable) renderer.render(scene, camera)
    }
    if (
      !finishedBelowPage &&
      (!motion.matches || movement.isLocked() || needsMeasure)
    )
      queue()
  }

  function scroll() {
    const delta = window.scrollY - currentScrollY
    if (tap && Math.abs(window.scrollY - tap.scrollY) > 4) tap = null
    currentScrollY = window.scrollY
    currentScrollX = window.scrollX
    if (!motion.matches && delta) patrol.scroll(delta, performance.now())
    queue()
  }

  function hit(event) {
    if (
      !paintable ||
      event.clientY < navBottom ||
      event.target?.closest?.(interactive)
    )
      return false
    const x = (event.clientX - paintBounds.left) / width
    const y = (event.clientY - paintBounds.top) / height
    if (x < 0 || x > 1 || y < 0 || y > 1) return false
    pointer.set(x * 2 - 1, 1 - y * 2)
    robot.root.updateMatrixWorld(true)
    raycaster.setFromCamera(pointer, camera)
    hits.length = 0
    return raycaster.intersectObjects(robot.hitMeshes, false, hits).length > 0
  }

  listen(window, 'scroll', scroll)
  listen(window, 'resize', () => {
    viewWidth = document.documentElement.clientWidth
    viewHeight = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    invalidate()
    scroll()
  })
  listen(main, 'animationend', invalidate)
  listen(main, 'transitionend', invalidate)
  listen(document, 'visibilitychange', () => {
    last = 0
    if (document.hidden) {
      window.cancelAnimationFrame(raf)
      raf = 0
      tap = null
      tracking.clear()
    } else invalidate()
  })
  listen(motion, 'change', () => {
    tracking.clear()
    queue()
  })
  listen(window, 'blur', () => {
    tap = null
    tracking.clear()
    queue()
  })
  listen(document.documentElement, 'pointerleave', () => {
    tracking.clear()
    queue()
  })
  listen(window, 'pointerdown', (event) => {
    tap =
      !motion.matches &&
      event.isPrimary &&
      event.button === 0 &&
      !movement.isLocked() &&
      hit(event)
        ? {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            scrollY: currentScrollY,
          }
        : null
  })
  listen(window, 'pointermove', (event) => {
    if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8)
      tap = null
    if (
      !motion.matches &&
      event.pointerType !== 'touch' &&
      !event.buttons &&
      paintable
    ) {
      tracking.point(event.clientX, event.clientY, performance.now())
      queue()
    }
  })
  listen(window, 'pointerup', (event) => {
    const valid =
      tap &&
      tap.id === event.pointerId &&
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 8
    tap = null
    if (!valid || motion.matches || movement.isLocked() || !hit(event)) return
    if (event.pointerType === 'touch')
      tracking.point(event.clientX, event.clientY, performance.now(), true)
    emotions.registerInteraction()
    queue()
  })
  listen(window, 'pointercancel', () => {
    tap = null
  })
  listen(canvas, 'webglcontextlost', () => {
    done()
  })
  queue()

  function done() {
    if (disposed) return
    disposed = true
    events.abort()
    signal.removeEventListener('abort', done)
    window.cancelAnimationFrame(raf)
    registry.dispose()
    world.dispose()
    disposeModel(scene)
    environment.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
  return done
}
