import { useInView } from 'motion/react'
import { useRef } from 'react'

export function SectionDivider() {
  const ref = useRef<HTMLHRElement>(null)
  const entered = useInView(ref, { once: true })
  return (
    <hr
      ref={ref}
      className={`border-line ${entered ? 'line-expansion' : ''}`}
    />
  )
}
