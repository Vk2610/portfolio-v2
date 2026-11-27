export function createRobotFrameLoop(
  request: (callback: FrameRequestCallback) => number,
  cancel: (id: number) => void,
  update: (time: number, dt: number) => void,
  shouldContinue: () => boolean,
) {
  let pending: number | null = null
  let previous: number | null = null
  let running = false
  let disposed = false

  function schedule() {
    if (!disposed && !running && pending === null) pending = request(frame)
  }

  function frame(time: number) {
    pending = null
    if (disposed) return
    running = true
    try {
      const dt =
        previous === null
          ? 1 / 60
          : Math.max(0, Math.min(0.05, (time - previous) / 1000))
      previous = time
      update(time, dt)
    } finally {
      running = false
    }
    if (shouldContinue()) schedule()
  }

  function stop() {
    if (pending !== null) cancel(pending)
    pending = previous = null
  }

  return {
    schedule,
    stop,
    dispose() {
      disposed = true
      stop()
    },
  }
}
