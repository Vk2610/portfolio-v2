import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { technologies } from '@/data/technologies'
import { createNetworkEngine } from './network-engine'
import { loadNetworkIcons } from './network-svg-renderer'
import { networkInteraction, technologyNodes } from './network-config'

const technologyList = technologies.map(({ label }) => label).join(', ')

export function NetworkSvg() {
  const captionId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  )
  const reduced = useReducedMotion() ?? false
  const { item } = staggeredEntrance('fade-up', reduced)

  useEffect(() => {
    const svg = svgRef.current
    const root = controlsRef.current
    const tooltip = tooltipRef.current
    if (!svg || !root || !tooltip) return
    const engine = createNetworkEngine(svg, { root, tooltip })

    if (!engine) {
      let active = true
      // Missing native SVG support should leave the figure caption as the visible alternative.
      queueMicrotask(() => {
        if (active) setStatus('unavailable')
      })
      return () => {
        active = false
      }
    }

    let active = true
    let inView = typeof IntersectionObserver === 'undefined'
    let iconsReady = false
    let revealed = false
    const motionPreference = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )

    function updatePlayback() {
      if (!active) return
      const visible = inView && !document.hidden
      engine?.setPlayback(visible, motionPreference?.matches ?? false)
      if (visible && iconsReady && !revealed) {
        revealed = true
        setStatus('ready')
      }
    }

    function resize() {
      if (!active || !root || !engine) return
      const { width, height } = root.getBoundingClientRect()
      engine.resize(width, height)
    }

    const sizes =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) => {
            if (!active || !entry) return
            engine.resize(entry.contentRect.width, entry.contentRect.height)
          })
    const visibility =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting
            updatePlayback()
          })

    sizes?.observe(root)
    visibility?.observe(root)
    document.addEventListener('visibilitychange', updatePlayback)
    window.addEventListener('resize', resize)
    motionPreference?.addEventListener('change', updatePlayback)
    resize()
    updatePlayback()

    void loadNetworkIcons(technologyNodes).then((icons) => {
      if (!active) return
      engine.setIcons(icons)
      iconsReady = true
      updatePlayback()
    })

    return () => {
      active = false
      sizes?.disconnect()
      visibility?.disconnect()
      document.removeEventListener('visibilitychange', updatePlayback)
      window.removeEventListener('resize', resize)
      motionPreference?.removeEventListener('change', updatePlayback)
      engine.destroy()
    }
  }, [])

  return (
    <figure aria-labelledby={captionId} className="absolute inset-0">
      <motion.div
        ref={controlsRef}
        className="absolute inset-0 motion-reduce:transform-none! motion-reduce:opacity-100!"
        variants={item}
        initial={reduced ? false : 'hidden'}
        animate={status === 'ready' ? 'visible' : 'hidden'}
      >
        <svg
          ref={svgRef}
          className="block size-full"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        />
        <div
          className="pointer-events-none absolute inset-0"
          hidden={status !== 'ready'}
        >
          {technologies.map(({ id, label, description }) => (
            <button
              key={id}
              data-network-node={id}
              type="button"
              aria-label={label}
              aria-describedby={`${captionId}-${id}`}
              className="pointer-events-auto absolute top-0 left-0 size-0 touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span id={`${captionId}-${id}`} className="sr-only">
                {description}
              </span>
            </button>
          ))}
        </div>
        <div
          ref={tooltipRef}
          hidden
          aria-hidden="true"
          style={{ animationDuration: `${networkInteraction.tooltipReveal}ms` }}
          className="tooltip-reveal type-caption pointer-events-none absolute z-30 w-max max-w-[min(14rem,calc(100vw-16px))] rounded-md border border-line bg-surface px-3 py-2 text-foreground"
        >
          <strong className="block" />
          <span className="text-secondary" />
        </div>
      </motion.div>
      <figcaption
        className={
          status === 'unavailable'
            ? 'type-caption grid h-full content-center gap-2 px-4 text-secondary'
            : 'sr-only'
        }
      >
        <span id={captionId} className="font-semibold">
          Technology network
        </span>
        <span>{technologyList}</span>
      </figcaption>
    </figure>
  )
}
