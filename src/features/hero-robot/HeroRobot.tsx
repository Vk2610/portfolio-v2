import { useEffect, useRef, type RefObject } from 'react'
import { mountHeroRobot } from './hero-robot-scene.js'

export function HeroRobot({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const container = containerRef.current
    const heading = document.getElementById('hero-title')
    if (!host || !container || !heading) return
    return mountHeroRobot(host, container, heading)
  }, [containerRef])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-hero-robot=""
      data-robot-surface="hero-platform"
      data-robot-surface-edge="bottom"
      className="pointer-events-none absolute z-10 select-none"
    />
  )
}
