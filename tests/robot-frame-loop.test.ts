import { expect, it, vi } from 'vitest'
import { createRobotFrameLoop } from '@/features/hero-robot/robot-frame-loop'
import { advanceFlightPosition } from '@/features/hero-robot/flight-motion'

it('reverses smoothly from the current non-Hero position and velocity', () => {
  const position = { x: 6, y: -20 }
  const velocity = { x: 0, y: 0 }
  advanceFlightPosition(position, velocity, 6, -25, 0.05)
  const before = position.y
  expect(before).toBeLessThan(-20)
  expect(velocity.y).toBeLessThan(0)
  advanceFlightPosition(position, velocity, 6, -15, 0.001)
  expect(position.y).toBeLessThan(before)
  for (let i = 0; i < 120; i++)
    advanceFlightPosition(position, velocity, 6, -15, 1 / 60)
  expect(position).toEqual({ x: 6, y: expect.closeTo(-15, 5) })
})

it('coalesces layout invalidations, rejects reentrant requests, and disposes queued frames', () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  let id = 0
  const update = vi.fn(() => loop.schedule())
  const loop = createRobotFrameLoop(
    (callback) => {
      callbacks.set(++id, callback)
      return id
    },
    (frame) => {
      callbacks.delete(frame)
    },
    update,
    () => true,
  )
  loop.schedule()
  loop.schedule()
  loop.schedule()
  expect(callbacks.size).toBe(1)
  expect(update).not.toHaveBeenCalled()
  const first = callbacks.get(1)!
  callbacks.delete(1)
  first(100)
  expect(update).toHaveBeenCalledExactlyOnceWith(100, 1 / 60)
  expect(callbacks.size).toBe(1)
  const stale = callbacks.get(2)!
  loop.dispose()
  stale(500)
  loop.schedule()
  expect(callbacks.size).toBe(0)
  expect(update).toHaveBeenCalledTimes(1)
})
