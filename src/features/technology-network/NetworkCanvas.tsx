import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { technologies } from '@/data/technologies'
import { createNetworkEngine, loadNetworkIcons } from './network-engine'

const technologyList = technologies.map(({ label }) => label).join(', ')

export function NetworkCanvas() {
  const captionId = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  )
  const reduced = useReducedMotion() ?? false
  const { item } = staggeredEntrance('fade-up', reduced)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = createNetworkEngine(canvas)

    if (!engine) {
      let active = true
      // A missing context should leave the figure caption as the visible alternative.
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
      if (!active || !canvas || !engine) return
      const { width, height } = canvas.getBoundingClientRect()
      engine.resize(width, height, window.devicePixelRatio)
    }

    const sizes =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    const visibility =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting
            updatePlayback()
          })

    sizes?.observe(canvas)
    visibility?.observe(canvas)
    document.addEventListener('visibilitychange', updatePlayback)
    window.addEventListener('resize', resize)
    motionPreference?.addEventListener('change', updatePlayback)
    resize()
    updatePlayback()

    void loadNetworkIcons().then((icons) => {
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
        className="absolute inset-0 motion-reduce:transform-none! motion-reduce:opacity-100!"
        variants={item}
        initial={reduced ? false : 'hidden'}
        animate={status === 'ready' ? 'visible' : 'hidden'}
      >
        <canvas
          ref={canvasRef}
          className="block size-full"
          aria-hidden="true"
        />
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
