/* global window, document, performance */
import { Raycaster, Vector2 } from 'three'
import { createEmotionController } from './emotions.js'

export function bindPreviewEmotions({
  root,
  robot,
  camera,
  canvas,
  render,
  listen,
}) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const stateText = root.querySelector('[data-emotion-state]')
  const countText = root.querySelector('[data-emotion-count]')
  const stateButtons = root.querySelectorAll('[data-emotion]')
  let frameId = 0
  let timerId = 0
  let lastState
  let lastCount
  const controller = createEmotionController({
    now: () => performance.now(),
    onChange: queueRefresh,
  })

  function stop() {
    window.cancelAnimationFrame(frameId)
    window.clearTimeout(timerId)
    frameId = 0
    timerId = 0
  }

  function refresh() {
    stop()
    if (document.hidden) return
    const time = performance.now()
    const frame = controller.frame(time, motion.matches)
    if (lastState !== frame.current) {
      lastState = frame.current
      stateText.value = frame.current[0].toUpperCase() + frame.current.slice(1)
      for (const button of stateButtons) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.emotion === frame.current),
        )
      }
    }
    if (lastCount !== frame.count) {
      lastCount = frame.count
      countText.value = String(frame.count)
    }
    robot.face.update(frame, time, motion.matches)
    render()
    if (frame.moving) frameId = window.requestAnimationFrame(refresh)
    else if (Number.isFinite(frame.next)) {
      timerId = window.setTimeout(refresh, Math.max(0, frame.next - time + 1))
    }
  }

  function queueRefresh() {
    window.clearTimeout(timerId)
    if (!frameId && !document.hidden)
      frameId = window.requestAnimationFrame(refresh)
  }

  for (const button of stateButtons) {
    listen(button, 'click', () =>
      controller.setEmotion(button.dataset.emotion, { override: true }),
    )
  }
  const actions = {
    tap: controller.registerInteraction,
    impact: controller.triggerDizzy,
    reset: controller.resetEmotion,
  }
  for (const button of root.querySelectorAll('[data-emotion-action]')) {
    listen(button, 'click', actions[button.dataset.emotionAction])
  }
  for (const input of root.querySelectorAll('[data-emotion-setting]')) {
    listen(input, 'change', () => {
      if (input.validity.valid)
        controller.configure({
          [input.dataset.emotionSetting]: input.valueAsNumber,
        })
    })
  }

  const pointer = new Vector2()
  const raycaster = new Raycaster()
  const hits = []
  let tap = null
  function hitsRobot(event) {
    const bounds = canvas.getBoundingClientRect()
    if (!(bounds.width && bounds.height)) return false
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    )
    camera.updateMatrixWorld()
    raycaster.setFromCamera(pointer, camera)
    hits.length = 0
    return raycaster.intersectObjects(robot.hitMeshes, false, hits).length > 0
  }

  function moved(event) {
    return (
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) >
      (event.pointerType === 'mouse' ? 5 : 9)
    )
  }
  listen(
    canvas,
    'pointerdown',
    (event) => {
      if (!event.isPrimary || event.button !== 0 || !hitsRobot(event)) {
        tap = null
        return
      }
      tap = { id: event.pointerId, x: event.clientX, y: event.clientY }
    },
    true,
  )
  listen(canvas, 'pointermove', (event) => {
    if (tap?.id === event.pointerId && moved(event)) tap = null
  })
  // Classify the tap before OrbitControls releases pointer capture.
  listen(
    canvas,
    'pointerup',
    (event) => {
      if (tap?.id !== event.pointerId) return
      const valid = !moved(event) && hitsRobot(event)
      tap = null
      if (valid) controller.registerInteraction()
    },
    true,
  )
  listen(canvas, 'pointercancel', () => {
    tap = null
  })
  listen(canvas, 'lostpointercapture', () => {
    tap = null
  })
  listen(motion, 'change', refresh)
  listen(document, 'visibilitychange', refresh)
  refresh()
  return stop
}
