import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import '@/animations/typography.css'

const revealTiming = {
  hero: { duration: '850ms', stagger: 135 },
  section: { duration: 'var(--duration-slow)', stagger: 75 },
} as const
const decodeRefresh = 40
const decodeDuration = 550
const decodePool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function useTypographyEntrance<T extends HTMLElement>(onMount: boolean) {
  const ref = useRef<T>(null)
  const reduced = useReducedMotion()
  const [entered, setEntered] = useState(onMount)

  useEffect(() => {
    const element = ref.current
    if (
      entered ||
      reduced ||
      !element ||
      typeof IntersectionObserver === 'undefined'
    )
      return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setEntered(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [entered, reduced])

  return { ref, active: entered && !reduced }
}

export function RevealHeading({
  as: Heading = 'h2',
  id,
  className,
  children,
}: {
  as?: 'h1' | 'h2'
  id: string
  className: string
  children: string
}) {
  const hero = Heading === 'h1'
  const { ref, active } = useTypographyEntrance<HTMLHeadingElement>(hero)
  const { duration, stagger } = revealTiming[hero ? 'hero' : 'section']
  let wordIndex = 0

  return (
    <Heading
      ref={ref}
      id={id}
      aria-label={children}
      data-cursor={hero ? 'heading' : undefined}
      data-reveal={active}
      className={`type-reveal ${className}`}
      style={{ '--type-reveal-duration': duration } as CSSProperties}
    >
      {children.split(/(\s+)/).map((part, index) =>
        /^\s+$/.test(part) ? (
          <Fragment key={index}>{part}</Fragment>
        ) : (
          <span
            key={index}
            className="type-reveal-piece"
            style={
              {
                '--type-reveal-delay': `${wordIndex++ * stagger}ms`,
              } as CSSProperties
            }
          >
            <span>{part}</span>
          </span>
        ),
      )}
    </Heading>
  )
}

export function DecodeIdentifier({
  children,
  className,
  onMount = false,
}: {
  children: string
  className: string
  onMount?: boolean
}) {
  const { ref, active } = useTypographyEntrance<HTMLParagraphElement>(onMount)
  const display = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = display.current
    if (!active || !element) return
    const letters = children.match(/[A-Z]/g)?.length ?? 0
    if (!letters) return
    const start = performance.now()
    const update = () => {
      let index = 0
      const resolved = Math.floor(
        ((performance.now() - start) / decodeDuration) * letters,
      )
      element.textContent = children.replace(/[A-Z]/g, (letter) =>
        index++ < resolved
          ? letter
          : decodePool[Math.floor(Math.random() * decodePool.length)],
      )
    }
    update()
    const interval = window.setInterval(update, decodeRefresh)
    const finish = () => {
      window.clearInterval(interval)
      element.textContent = children
    }
    const timeout = window.setTimeout(finish, decodeDuration)
    return () => {
      window.clearTimeout(timeout)
      finish()
    }
  }, [active, children])

  return (
    <p ref={ref} className={`whitespace-nowrap ${className}`}>
      <span className="sr-only select-none">{children}</span>
      <span ref={display} aria-hidden="true">
        {children}
      </span>
    </p>
  )
}
