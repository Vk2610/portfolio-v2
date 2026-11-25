import type { Variants } from 'motion/react'
import { entranceTransition, motionMilliseconds } from './transitions'

export function staggeredEntrance(
  pattern: 'fade-up' | 'elements',
  reduced: boolean,
) {
  const group: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduced ? 0 : motionMilliseconds('--stagger') / 1000,
      },
    },
  }
  const item: Variants = {
    hidden: reduced
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: pattern === 'fade-up' ? 16 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0 }
        : entranceTransition(
            pattern === 'fade-up' ? '--duration-slow' : '--duration-moderate',
          ),
    },
  }
  return { group, item }
}
