import type { Transition } from 'motion/react'

export function motionMilliseconds(token: string) {
  return Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  )
}

export function entranceTransition(
  duration: '--duration-slow' | '--duration-moderate',
): Transition {
  const easing = getComputedStyle(document.documentElement).getPropertyValue(
    '--ease-entrance',
  )
  const points = easing
    .slice(easing.indexOf('(') + 1, easing.indexOf(')'))
    .split(',')
    .map(Number)
  return {
    duration: motionMilliseconds(duration) / 1000,
    ease: [points[0], points[1], points[2], points[3]],
  }
}
