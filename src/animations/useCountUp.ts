import { useEffect, useRef } from 'react'

const duration = 900
const stagger = 100

export function useCountUp(values: readonly string[], active: boolean) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (!active || typeof requestAnimationFrame !== 'function') return
    const counters = values.flatMap((value, index) => {
      const match = /^(\d+)(.*)$/.exec(value)
      const element = refs.current[index]
      if (!element || !match) return []
      const [, digits, suffix] = match
      return [
        {
          element,
          value,
          target: Number(digits),
          padding: digits.startsWith('0') ? digits.length : 1,
          suffix,
          delay: index * stagger,
        },
      ]
    })
    if (!counters.length) return
    let frame: number
    const start = performance.now()

    function tick(now: number) {
      let pending = false
      for (const counter of counters) {
        const progress = Math.max(
          0,
          Math.min(1, (now - start - counter.delay) / duration),
        )
        const eased = 1 - (1 - progress) ** 3
        const text =
          progress === 1
            ? counter.value
            : String(Math.floor(counter.target * eased)).padStart(
                counter.padding,
                '0',
              ) + counter.suffix
        if (counter.element.textContent !== text)
          counter.element.textContent = text
        pending ||= progress < 1
      }
      if (pending) frame = requestAnimationFrame(tick)
    }

    tick(start)
    return () => {
      cancelAnimationFrame(frame)
      for (const counter of counters)
        counter.element.textContent = counter.value
    }
  }, [active, values])

  return refs
}
