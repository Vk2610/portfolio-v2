/* global window, document, performance */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { createFallPhysics, physicsDefaults } from './fall-physics.js'
import { createMovement, movementDefaults } from './movement.js'
import { createHeadTracking, trackingDefaults } from './head-tracking.js'

export function bindPreviewMovement({
  root,
  robot,
  scene,
  camera,
  canvas,
  listen,
  emotions,
  queueRefresh,
}) {
  let settings = { ...physicsDefaults }
  let platformHeight = 0
  const physics = createFallPhysics(robot, settings)
  const movement = createMovement(robot, physics, emotions, settings)
  const tracking = createHeadTracking(movement.rig, camera, () =>
    canvas.getBoundingClientRect(),
  )
  const platform = new Mesh(
    new BoxGeometry(),
    new MeshStandardMaterial({ color: '#393b49', roughness: 0.92 }),
  )
  platform.visible = false
  scene.add(platform)
  const debug = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      transparent: true,
      opacity: 0.58,
    }),
  )
  debug.frustumCulled = false
  debug.visible = false
  scene.add(debug)
  const debugToggle = root.querySelector('[data-robot-debug]')
  const trackingToggle = root.querySelector('[data-tracking-toggle]')
  const outputs = Object.fromEntries(
    [...root.querySelectorAll('[data-movement-output]')].map((el) => [
      el.dataset.movementOutput,
      el,
    ]),
  )
  const settingsFields = [
    ...root.querySelectorAll(
      '[data-physics-setting], [data-motion-setting], [data-tracking-setting]',
    ),
  ]

  const platformX = -0.75
  function syncPlatform() {
    platform.visible = platformHeight > 0
    platform.scale.set(3.7, 0.24, 2.6)
    platform.position.set(platformX, platformHeight - 0.12, 0)
    physics.updateSurfaces(
      platform.visible
        ? [
            {
              x: platformX,
              z: 0,
              width: 3.7,
              depth: 2.6,
              height: platformHeight,
            },
          ]
        : [],
    )
  }

  const actions = {
    idle: () => {
      if (movement.stop()) emotions.resetEmotion()
    },
    'walk-left': () => movement.walk(-1),
    'walk-right': () => movement.walk(1),
    stop: movement.stop,
    'turn-left': () => movement.turn(-1),
    'turn-right': () => movement.turn(1),
    jump: () => {
      if (!movement.isLocked()) emotions.setEmotion('happy', { override: true })
    },
    fold: () => {
      if (!movement.isLocked()) emotions.setEmotion('angry', { override: true })
    },
    dizzy: () => {
      if (!movement.isLocked()) emotions.triggerDizzy()
    },
    stand: movement.startRecovery,
    balance: () => movement.beginFall('front', { balance: true }),
    fall: () => movement.beginFall('front'),
    drop: () => movement.beginFall('front', { drop: true }),
    'fall-front': () => movement.beginFall('front', { balance: true }),
    'fall-back': () => movement.beginFall('back', { balance: true }),
    'fall-left': () => movement.beginFall('left', { balance: true }),
    'fall-right': () => movement.beginFall('right', { balance: true }),
    platform: () => {
      if (movement.isLocked()) return
      platformHeight = settings.dropHeight
      if (movement.stagePlatform(platformHeight, platformX)) syncPlatform()
    },
  }
  for (const button of root.querySelectorAll('[data-movement-action]')) {
    listen(button, 'click', () => {
      actions[button.dataset.movementAction]()
      queueRefresh()
    })
  }

  for (const input of settingsFields) {
    listen(input, 'change', () => {
      if (!input.validity.valid) return
      const { physicsSetting, motionSetting, trackingSetting } = input.dataset
      const value = input.valueAsNumber
      if (physicsSetting) {
        settings = { ...settings, [physicsSetting]: value }
        movement.configurePhysics({ [physicsSetting]: value })
      } else if (motionSetting) movement.configure({ [motionSetting]: value })
      else tracking.configure({ [trackingSetting]: value })
      queueRefresh()
    })
  }

  listen(debugToggle, 'change', () => {
    debug.visible = debugToggle.checked
    queueRefresh()
  })
  listen(trackingToggle, 'change', () => {
    tracking.configure({ enabled: trackingToggle.checked })
    queueRefresh()
  })
  listen(window, 'pointermove', (event) => {
    if (event.pointerType === 'touch' || event.buttons) return
    tracking.point(event.clientX, event.clientY, performance.now())
    queueRefresh()
  })
  listen(document.documentElement, 'pointerleave', (event) => {
    if (event.pointerType !== 'touch') tracking.clear()
  })
  listen(window, 'blur', tracking.clear)

  function display(key, value) {
    if (outputs[key].value !== value) outputs[key].value = value
  }

  return {
    movement,
    frame(time, dt, reduced) {
      movement.update(time, Math.min(dt, 0.08), reduced)
      const status = movement.status()
      const angles = tracking.step(
        time,
        dt,
        status.state,
        emotions.getCurrentEmotion(),
        reduced,
      )
      display('state', status.state)
      display('grounded', status.grounded ? 'Yes' : 'No')
      display('physics', status.physics)
      display('rest', status.orientation ?? '–')
      const labelAngle = (x) => (Math.abs(x) < 0.5 ? '0°' : Math.round(x) + '°')
      display('yaw', labelAngle(angles.yaw))
      display('pitch', labelAngle(angles.pitch))
      if (debug.visible) {
        const { vertices, colors } = physics.debug()
        const rgb = new Float32Array((colors.length / 4) * 3)
        for (let i = 0, j = 0; i < colors.length; i += 4, j += 3) {
          rgb[j] = colors[i]
          rgb[j + 1] = colors[i + 1]
          rgb[j + 2] = colors[i + 2]
        }
        debug.geometry.dispose()
        debug.geometry.setAttribute(
          'position',
          new BufferAttribute(vertices, 3),
        )
        debug.geometry.setAttribute('color', new BufferAttribute(rgb, 3))
      }
      return !reduced || status.state !== 'idle'
    },
    onTouch(event) {
      if (event.pointerType === 'touch')
        tracking.point(event.clientX, event.clientY, performance.now(), true)
    },
    reset() {
      settings = { ...physicsDefaults }
      movement.reset()
      movement.configure(movementDefaults)
      movement.configurePhysics(settings)
      tracking.configure(trackingDefaults)
      tracking.reset()
      platformHeight = 0
      syncPlatform()
      for (const input of settingsFields) {
        const { physicsSetting, motionSetting, trackingSetting } = input.dataset
        input.value = String(
          settings[physicsSetting] ??
            movementDefaults[motionSetting] ??
            trackingDefaults[trackingSetting],
        )
      }
      trackingToggle.checked = true
      debugToggle.checked = debug.visible = false
      emotions.resetEmotion()
    },
    dispose: physics.dispose,
  }
}
