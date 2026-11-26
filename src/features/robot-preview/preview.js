/* global window, ResizeObserver, AbortController */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRobot, defaultScales } from './robot.js'
import { bindPreviewEmotions } from './preview-emotions.js'
import { bindPreviewMovement } from './preview-movement.js'
import { preparePhysics } from './fall-physics.js'

const presets = {
  front: [0, 0.025],
  side: [Math.PI / 2, 0],
  back: [Math.PI, 0.025],
  'three-quarter': [Math.PI / 5, 0.13],
  high: [0, Math.PI / 6],
  low: [0, -Math.PI / 6],
  isometric: [Math.PI / 4, Math.PI / 4],
  top: [0, Math.PI / 2 - 0.001],
  bottom: [0, -Math.PI / 2 + 0.001],
  close: [Math.PI / 5, 0.13],
}

function environment(renderer) {
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
    object.geometry?.dispose()
    object.material?.dispose()
  })
  return result
}

function contactShadow(x, z, width, depth, opacity) {
  const shadow = new Mesh(
    new PlaneGeometry(width, depth),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { opacity: { value: opacity } },
      vertexShader: `
        varying vec2 coord;
        void main() {
          coord = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 coord;
        uniform float opacity;
        void main() {
          float r = length(coord);
          float falloff = exp(-3.5 * r * r) * (1.0 - smoothstep(0.55, 1.0, r));
          gl_FragColor = vec4(0.022, 0.027, 0.05, opacity * falloff);
        }
      `,
    }),
  )
  shadow.position.set(x, -0.025, z)
  shadow.rotation.x = -Math.PI / 2
  return shadow
}

function showPreview(root) {
  const stage = root.querySelector('#stage')
  const fields = Object.keys(defaultScales).map((key) => ({
    key,
    input: root.querySelector(`#${key}`),
    output: root.querySelector(`output[for="${key}"]`),
  }))
  const viewButtons = [...root.querySelectorAll('[data-view]')]

  const listeners = new AbortController()
  const listen = (element, type, action, capture = false) =>
    element.addEventListener(type, action, {
      signal: listeners.signal,
      capture,
    })

  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.domElement.setAttribute('aria-hidden', 'true')
  stage.append(renderer.domElement)
  const scene = new Scene()
  const lighting = environment(renderer)
  scene.environment = lighting.texture
  scene.add(new HemisphereLight('#e4e9ff', '#ada1b0', 1.55))

  function light(color, intensity, x, y, z) {
    const source = new DirectionalLight(color, intensity)
    source.position.set(x, y, z)
    scene.add(source)
  }
  light('#f6edff', 2.25, -3, 6, 5)
  light('#ffc5ad', 1.25, 4, 4, 3)
  light('#82baff', 2.6, -3, 3.5, -3.5)

  const robot = createRobot()
  scene.add(robot.root)
  const ground = new Mesh(
    new PlaneGeometry(18, 12),
    new MeshStandardMaterial({
      color: '#151924',
      roughness: 0.95,
      transparent: true,
      opacity: 0.21,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.036
  scene.add(ground)
  const shadow = contactShadow(0, -0.05, 3.25, 2.3, 0.62)
  const feetShadows = [-1, 1].map((side) =>
    contactShadow(side * 0.27, 0.04, 0.85, 0.9, 0.77),
  )
  scene.add(shadow, ...feetShadows)

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40)
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enablePan = false
  orbit.minZoom = 0.55
  orbit.maxZoom = 2.6
  orbit.minPolarAngle = 0.001
  orbit.maxPolarAngle = Math.PI - 0.001
  let selectedView = 'three-quarter'
  let gestureStart = null
  const zoomLevel = root.querySelector('#zoom-level')
  const zoomOut = root.querySelector('#zoom-out')
  const zoomIn = root.querySelector('#zoom-in')
  const turntable = root.querySelector('#turntable')
  const angleReadout = root.querySelector('#turntable-angle')
  let modelHeight = 3.8
  let headWorldScale = 1
  let restingCameraY = modelHeight / 2
  let controls
  let appliedScales = { ...defaultScales }
  const footLocations = ['Left foot', 'Right foot'].map((name) =>
    robot.root.getObjectByName(name),
  )
  const footPosition = new Vector3()
  const lookCenter = new Vector3()
  const cameraRight = new Vector3()

  function render() {
    const floor = controls?.movement.movement.status().floor ?? 0
    shadow.position.set(
      robot.root.position.x,
      floor - 0.022 + (floor > 0 ? 0.033 : 0),
      robot.root.position.z - 0.05,
    )
    shadow.material.uniforms.opacity.value =
      0.62 / (1 + 1.4 * Math.max(0, robot.root.position.y - floor))
    for (let index = 0; index < feetShadows.length; index++) {
      footLocations[index].getWorldPosition(footPosition)
      const shoeShadow = feetShadows[index]
      shoeShadow.position.set(
        footPosition.x,
        shadow.position.y + 0.002,
        footPosition.z + 0.04,
      )
      shoeShadow.material.uniforms.opacity.value =
        0.68 / (1 + 9 * Math.max(0, footPosition.y - floor - 0.22))
    }
    // Reframe only near the edge so walking still reads as travel.
    if (!gestureStart && selectedView !== 'close') {
      const width = camera.right / camera.zoom
      const right = cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
      const localX = lookCenter
        .copy(robot.root.position)
        .sub(orbit.target)
        .dot(right)
      const room = Math.max(0.32, width - 1.42 * headWorldScale)
      if (Math.abs(localX) > room + 0.008) {
        const shift = localX - Math.sign(localX) * room
        orbit.target.addScaledVector(right, shift * 0.22)
        camera.position.addScaledVector(right, shift * 0.22)
      }
      const verticalRoom = Math.max(
        0,
        camera.top / camera.zoom - modelHeight / 2 - 0.24,
      )
      const desiredY =
        restingCameraY + Math.max(0, robot.root.position.y - verticalRoom)
      const shiftY = (desiredY - orbit.target.y) * 0.18
      if (Math.abs(shiftY) > 0.001) {
        orbit.target.y += shiftY
        camera.position.y += shiftY
      }
    }
    zoomLevel.value = `${Math.round(camera.zoom * 100)}%`
    zoomIn.disabled = camera.zoom >= orbit.maxZoom
    zoomOut.disabled = camera.zoom <= orbit.minZoom
    renderer.render(scene, camera)
  }

  function selectView(view) {
    selectedView = view
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view === view))
    }
  }

  function positionCamera(azimuth, elevation) {
    const radius = 9
    camera.position
      .copy(orbit.target)
      .add(
        new Vector3(
          radius * Math.cos(elevation) * Math.sin(azimuth),
          radius * Math.sin(elevation),
          radius * Math.cos(elevation) * Math.cos(azimuth),
        ),
      )
    orbit.update()
    render()
  }

  function displayAngle(degrees) {
    turntable.value = String(degrees)
    angleReadout.value = `${degrees}°`
  }

  orbit.addEventListener('start', () => {
    gestureStart = [orbit.getAzimuthalAngle(), orbit.getPolarAngle()]
  })
  orbit.addEventListener('end', () => {
    gestureStart = null
  })
  orbit.addEventListener('change', () => {
    const degrees = ((orbit.getAzimuthalAngle() * 180) / Math.PI + 360) % 360
    displayAngle((Math.round(degrees / 22.5) % 16) * 22.5)
    // Scroll and pinch zoom do not invalidate a camera preset.
    if (
      gestureStart &&
      selectedView &&
      (Math.abs(gestureStart[0] - orbit.getAzimuthalAngle()) > 0.001 ||
        Math.abs(gestureStart[1] - orbit.getPolarAngle()) > 0.001)
    ) {
      selectView(null)
    }
    render()
  })

  for (const button of viewButtons) {
    listen(button, 'click', () => {
      selectView(button.dataset.view)
      camera.zoom = selectedView === 'close' ? 1.62 : 1
      camera.updateProjectionMatrix()
      updateScales()
      positionCamera(...presets[selectedView])
    })
  }
  listen(turntable, 'input', () => {
    const degrees = Number(turntable.value)
    selectView(null)
    camera.zoom = 1
    camera.updateProjectionMatrix()
    updateScales()
    positionCamera((degrees * Math.PI) / 180, 0.025)
  })

  function zoom(factor) {
    camera.zoom = Math.min(
      orbit.maxZoom,
      Math.max(orbit.minZoom, camera.zoom * factor),
    )
    camera.updateProjectionMatrix()
    orbit.update()
    render()
  }

  listen(zoomIn, 'click', () => zoom(1.16))
  listen(zoomOut, 'click', () => zoom(1 / 1.16))
  for (const [id, direction] of [
    ['turn-left', -1],
    ['turn-right', 1],
  ]) {
    listen(root.querySelector(`#${id}`), 'click', () => {
      selectView(null)
      positionCamera(
        orbit.getAzimuthalAngle() + (direction * Math.PI) / 12,
        Math.PI / 2 - orbit.getPolarAngle(),
      )
    })
  }

  function updateScales() {
    const scales = {}
    for (const { key, input, output } of fields) {
      const percentage = Number(input.value)
      scales[key] = percentage / 100
      output.value = `${percentage}%`
    }
    if (Object.keys(scales).some((key) => scales[key] !== appliedScales[key])) {
      appliedScales = scales
      robot.setScales(scales)
      controls?.movement.movement.proportionsChanged()
    }
    headWorldScale = scales.head * scales.overall
    const groundScale = (scales.overall * scales.body) / defaultScales.body
    shadow.scale.setScalar(groundScale)
    for (const [index, foot] of feetShadows.entries()) {
      foot.scale.setScalar(groundScale)
      foot.position.x = (index === 0 ? -1 : 1) * 0.27 * groundScale
    }
    modelHeight =
      (scales.body * 2.63 - 0.018 * scales.head + 2.22 * scales.head) *
      scales.overall
    const nextTarget =
      modelHeight / 2 +
      (selectedView === 'close' ? 0.91 * scales.head * scales.overall : 0)
    restingCameraY = nextTarget
    camera.position.y += nextTarget - orbit.target.y
    orbit.target.y = nextTarget
    resize()
    orbit.update()
    render()
  }

  for (const { input } of fields) listen(input, 'input', updateScales)

  function reset() {
    controls?.reset()
    for (const { key, input } of fields)
      input.value = String(defaultScales[key] * 100)
    camera.zoom = 1
    orbit.target.x = orbit.target.z = 0
    camera.updateProjectionMatrix()
    selectView('three-quarter')
    updateScales()
    positionCamera(...presets[selectedView])
  }

  listen(root.querySelector('#reset'), 'click', reset)
  function resize() {
    const { clientWidth: width, clientHeight: height } = stage
    if (!width || !height) return
    const aspect = width / height
    // Reserve room above the antenna tips so dizziness never jumps the camera.
    const span = Math.max(
      2.72,
      modelHeight / 2 + 0.79 * headWorldScale,
      1.64 / aspect,
    )
    camera.left = -span * aspect
    camera.right = span * aspect
    camera.top = span
    camera.bottom = -span
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(stage)
  reset()
  controls = bindPreviewEmotions({
    root,
    robot,
    camera,
    canvas: renderer.domElement,
    render,
    listen,
    createMovementControls: (emotions, queueRefresh) =>
      bindPreviewMovement({
        root,
        robot,
        scene,
        camera,
        canvas: renderer.domElement,
        listen,
        emotions,
        queueRefresh,
      }),
  })
  return () => {
    controls.dispose()
    listeners.abort()
    observer.disconnect()
    orbit.dispose()
    const materials = new Set()
    const geometries = new Set()
    scene.traverse((object) => {
      if (object.geometry && !object.isSprite) geometries.add(object.geometry)
      if (object.material) materials.add(object.material)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) {
      material.map?.dispose()
      material.dispose()
    }
    lighting.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
}

export function mountPreview(root) {
  const status = root.querySelector('#render-status')
  let mounted = true
  let cleanup
  status.hidden = false
  status.textContent = 'Loading the robot preview…'
  preparePhysics()
    .then(() => {
      if (!mounted) return
      cleanup = showPreview(root)
      status.hidden = true
    })
    .catch((error) => {
      if (!mounted) return
      status.textContent =
        'The character preview could not start. WebGL 2 and WebAssembly are required.'
      window.console.error(error)
    })
  return () => {
    mounted = false
    cleanup?.()
  }
}
