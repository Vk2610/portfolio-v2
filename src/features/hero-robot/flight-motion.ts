export function advanceFlightPosition(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  targetX: number,
  targetY: number,
  dt: number,
) {
  const frequency = 11
  const decay = Math.exp(-frequency * dt)
  for (const axis of ['x', 'y'] as const) {
    const goal = axis === 'x' ? targetX : targetY
    const offset = position[axis] - goal
    const rate = velocity[axis] + frequency * offset
    position[axis] = goal + (offset + rate * dt) * decay
    velocity[axis] = (velocity[axis] - frequency * rate * dt) * decay
  }
}
